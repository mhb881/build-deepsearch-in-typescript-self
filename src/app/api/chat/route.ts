import {
  observe,
  propagateAttributes,
  updateActiveObservation,
} from "@langfuse/tracing";
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { eq } from "drizzle-orm";
import { after } from "next/server";

import { streamFromDeepSearch } from "~/deepsearch";
import { env } from "~/env";
import { langfuseSpanProcessor, withDbSpan } from "~/lib/telemetry";
import type { ChatUIMessage } from "~/lib/types/ai-types";
import { extractChatTitle } from "~/lib/utils/ai-utils";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { upsertChat } from "~/server/db/chat";
import { chats } from "~/server/db/schema";
import { checkRateLimit, logRequest } from "~/server/rate-limit";

export const maxDuration = 80;
const MAX_REQUESTS_PER_DAY = 10;

async function handler(req: Request) {
  // 1. 认证守卫
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return new Response(
      JSON.stringify({
        error: "User not authenticated",
      }),
      {
        status: 401,
        statusText: "Unauthorized",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  // 2. 速率限制检查
  const { allowed } = await checkRateLimit(session.user.id);

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_DAY} requests per day.`,
      }),
      {
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  // 3. 解析请求参数
  const body = (await req.json()) as {
    messages: ChatUIMessage[];
    chatId?: string;
  };
  const { messages, chatId } = body;

  if (!messages?.length) {
    return new Response("No messages provided", {
      status: 400,
    });
  }

  // 4. 前置确定会话 ID（消除时序断层）
  const isNewChat = !chatId;
  const curChatId = chatId ?? crypto.randomUUID();

  const lastMessage = messages[messages.length - 1];
  const fallbackTitle = extractChatTitle(lastMessage);

  // 5. 注入 Langfuse 追踪属性并启动业务执行流程
  return propagateAttributes(
    {
      traceName: "deepsearch-chat",
      sessionId: curChatId,
      userId: session.user.id,
      // 清洗高基数标签：仅保留静态环境与应用分类，用户名归位到 userId
      tags: [env.NODE_ENV, "agent"],
      metadata: {
        isNewChat: String(isNewChat),
      },
    },
    async () => {
      // ⭐️ 核心防御 1：在上下文完整的入口处捕获根跨度实例，供闭包引用
      const rootSpan = otelTrace.getActiveSpan();

      const userQueryText =
        lastMessage?.parts.find((p) => p.type === "text")?.text ??
        fallbackTitle;

      // 记录根观测节点的结构化输入摘要
      updateActiveObservation({
        input: userQueryText, // ⭐️ 列表页将直接展示用户的问题
        metadata: {
          chatId: curChatId,
          messageCount: messages.length,
        },
      });

      // 6. 阶段 1 持久化（或所有权核验）
      if (isNewChat) {
        await withDbSpan({
          name: "create-new-chat",
          type: "span",
          input: {
            chatId: curChatId,
            messageCount: messages.length,
          },
          fn: () =>
            upsertChat({
              userId: session.user.id,
              chatId: curChatId,
              title: fallbackTitle,
              chatMessages: messages,
            }),
        });
      } else {
        const chat = await withDbSpan({
          name: "verify-chat-ownership",
          type: "retriever", // 明确标记为只读检索类型
          input: {
            chatId: curChatId,
          },
          fn: () =>
            db.query.chats.findFirst({
              where: eq(chats.id, curChatId),
            }),
        });

        if (!chat || chat.userId !== session.user.id) {
          updateActiveObservation({
            level: "ERROR",
            statusMessage: "Chat not found or unauthorized",
          });

          return new Response("Chat not found or unauthorized", {
            status: 404,
          });
        }
      }

      // 记录请求日志
      await logRequest(session.user.id);
      // 将 UI 层消息转换为模型层消息
      const modelMessages = await convertToModelMessages(messages);

      // 7. 构建 UI 消息流
      const stream = createUIMessageStream<ChatUIMessage>({
        originalMessages: messages,

        execute: async ({ writer }) => {
          writer.write({
            type: "start",
          });

          // 若为新建会话，下发瞬态自定义数据事件（仅通知客户端 onData，不存入消息 parts 历史）
          if (isNewChat) {
            writer.write({
              type: "data-chat-created",
              data: {
                chatId: curChatId,
                title: fallbackTitle,
              },
              transient: true,
            });
          }

          // ⭐️ 核心瘦身重构：直接调用抽离后的独立执行器！
          const result = streamFromDeepSearch({
            messages: modelMessages,
            telemetry: {
              isEnabled: true,
              functionId: "deepsearch-chat",
            },
            abortSignal: req.signal,
            onError: ({ error }) => {
              console.error("[AI stream error]", error);
            },
          });

          //  将模型推理事件流转换为 UI 消息流并合并
          writer.merge(
            // toUIMessageStream 负责“把模型 stream 转成 UI Message Stream”
            toUIMessageStream({
              stream: result.stream,
              sendStart: false, // false 避免重复发送 start 帧
            }),
          );
        },

        onEnd: async ({
          messages: updatedMessages,
          isAborted,
          finishReason,
        }) => {
          // ⭐️ 核心防御 2：将 onEnd 包裹在根跨度上下文内，确保 save-chat-history 100% 挂载在根节点下
          const activeContext = rootSpan
            ? otelTrace.setSpan(otelContext.active(), rootSpan)
            : otelContext.active();

          await otelContext.with(activeContext, async () => {
            const finalMessage = updatedMessages[updatedMessages.length - 1];
            if (!finalMessage) {
              rootSpan?.end();
              return;
            }

            const updatedTitle = extractChatTitle(finalMessage);

            try {
              // 阶段 2 持久化：更新完整对话记录
              await withDbSpan({
                name: "save-chat-history",
                type: "span",
                input: {
                  chatId: curChatId,
                  messageCount: updatedMessages.length,
                },
                fn: () =>
                  upsertChat({
                    userId: session.user.id,
                    chatId: curChatId,
                    title: updatedTitle,
                    chatMessages: updatedMessages,
                  }),
              });

              // 记录最终输出摘要
              const finalAiText =
                finalMessage?.parts.find((p) => p.type === "text")?.text ?? "";

              updateActiveObservation({
                output: finalAiText, // ⭐️ 列表页直接展示 AI 的回复
                metadata: {
                  chatId: curChatId,
                  messageCount: updatedMessages.length,
                  isAborted,
                  finishReason,
                  persisted: true,
                },
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              updateActiveObservation({
                level: "ERROR",
                statusMessage: errorMessage,
                output: {
                  chatId: curChatId,
                  persisted: false,
                },
              });

              console.error("Failed to persist chat messages onEnd:", error);
            } finally {
              // ⭐️ 核心防御 3：无论成功还是异常，显式结束闭包捕获的根跨度
              // observe(..., { endOnExit: false }) 不会自动结束，
              // 因此流完成后显式结束 root observation。
              rootSpan?.end();
            }
          });
        },
      });

      // 8. 注册响应后异步刷盘任务
      after(async () => {
        try {
          await langfuseSpanProcessor.forceFlush();
        } catch (e) {
          console.error("[langfuse] flush failed", e);
        }
      });

      return createUIMessageStreamResponse({
        stream,
      });
    },
  );
}

/**
 * ⭐️ 顶层观测包装：
 * endOnExit: false
 * → Route Handler 返回 Response 后不要立即结束 root observation
 * → 等 UI stream 真正结束时，再手动 end()
 * → 确保流式响应返回 HTTP 响应头后，根跨度继续等待流传输完成
 *
 * captureInput/Output: false 避免抓取不可序列化的网络流原始对象
 */
export const POST = observe(handler, {
  name: "deepsearch-chat",
  endOnExit: false,
  captureInput: false,
  captureOutput: false,
});
