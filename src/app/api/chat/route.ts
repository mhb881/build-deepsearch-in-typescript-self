import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { eq } from "drizzle-orm";
import { searchWeb } from "~/lib/ai-tools/searchWeb";
import { model } from "~/lib/ai/model";
import type { ChatUIMessage } from "~/lib/types/ai-types";
import { extractChatTitle } from "~/lib/utils/ai-utils";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { upsertChat } from "~/server/db/chat";
import { chats } from "~/server/db/schema";
import { checkRateLimit, logRequest } from "~/server/rate-limit";

const MAX_REQUESTS_PER_DAY = 10;
// 系统提示词
const systemPrompt = `You are a helpful assistant with access to a web search tool.
RULES:
1. Always search the web for up-to-date information when relevant.
2. If you're unsure about something, search the web to verify.
3. Do NOT make up information. If you cannot find an answer, say so.
4. You MUST cite your sources using inline Markdown links in your response. Format: [descriptive text](URL).
5. Attempt to always cite sources inline rather than listing them at the end.
6. If search results are insufficient, say so honestly.`;

export const maxDuration = 80;
export async function POST(req: Request) {
  // ─── 1. 认证守卫 (后端) ───
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "User not authenticated" }), {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // ─── 2. 速率限制检查：超限返回 429，管理员自动放行 ───
  const { allowed } = await checkRateLimit(session.user.id);
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_DAY} requests per day.`,
      }),
      {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  /**
   * ─── 3. 解析请求体 ───
   * 前端 useChat 发送的是 UIMessage[]
   */
  // const { messages }: { messages: ChatUIMessage[]; chadId?: string } =
  //   await req.json();
  const body = (await req.json()) as {
    messages: ChatUIMessage[];
    chatId?: string;
  };
  const { messages, chatId } = body;

  if (!messages || messages.length === 0) {
    return new Response("No messages provided", { status: 400 });
  }

  // ─── 4. 两阶段持久化之【阶段 1：前置防断流创建】 ───
  let curChatId = chatId;
  let isNewChat = false;

  // 自动从最后一条用户消息生成标题概要（截取前 50 字）
  const lastMessage = messages[messages.length - 1];
  const fallBackTitle = extractChatTitle(lastMessage);

  if (!curChatId) {
    isNewChat = true;
    // 场景 A：客户端未传 chatId ──► 生成新 UUID 并立即在数据库建表存入用户提问
    const newChatId = crypto.randomUUID();

    await upsertChat({
      userId: session.user.id,
      chatId: newChatId,
      title: fallBackTitle,
      chatMessages: messages,
    });
    curChatId = newChatId;
  } else {
    // 场景 B：客户端传了 chatId ──► 快速验证所有权，防止越权写入
    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, curChatId),
    });

    if (!chat || chat.userId !== session.user.id) {
      return new Response("Chat not found or unauthorized", { status: 404 });
    }
  }

  // 记录请求日志
  await logRequest(session.user.id);

  // 5. 将 UI 层消息转换为模型层消息
  const modelMessages = await convertToModelMessages(messages);

  // ─── 6. ⭐️ AI SDK 7 现代标准：构建自定义 UI Message Stream ───
  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: messages, // ⭐️ 传入原始消息，自动开启聚合模式
    execute: async ({ writer }) => {
      // 通知客户端 Assistant 消息帧开始
      writer.write({ type: "start" });

      // 若为新建会话，下发瞬态自定义数据事件（仅通知客户端 onData，不存入消息 parts 历史）
      if (isNewChat) {
        writer.write({
          type: "data-chat-created",
          data: { chatId: curChatId, title: fallBackTitle },
          transient: true,
        });
      }

      // 执行模型推理
      const result = streamText({
        model,
        instructions: systemPrompt,
        messages: modelMessages,
        tools: {
          searchWeb,
        },
        // v7 中 maxSteps → stopWhen: isStepCount(n)
        stopWhen: isStepCount(10),
        // v7：onFinish → onEnd
        onEnd: ({ usage, responseMessages }) => {
          // console.log("Generation ended:", text);
          // console.log("Token usage:", usage);
          // 在调用过程中生成的响应消息，即从 AI 传来的新消息
          // console.log("Response messages:", responseMessages);
        },
      });

      // 将模型推理事件流转换为 UI 消息流并合并
      // sendStart: false 避免重复发送 start 帧
      writer.merge(
        // toUIMessageStream 负责“把模型 stream 转成 UI Message Stream”
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
        }),
      );
    },
    onEnd: async ({ messages: updatedMessage, isAborted }) => {
      /*
       ⭐️ 两阶段持久化之【阶段 2：流结束自动聚合入库】

      AI SDK 7 已经自动完成工具调用、工具结果与模型回答的因果树合并
      我们不需要使用 v4 提供的 appendResponseMessages API 来手动合并消息
      所以直接使用 upsertChat 来更新数据库中的消息列表
       */

      // 这里是已经合并后的消息列表，包含用户提问和模型回答，标题也是用最新的
      const lastMessage = updatedMessage[updatedMessage.length - 1];
      if (!lastMessage) return;
      const fallBackTitle = extractChatTitle(lastMessage);

      try {
        // 保存完整聊天记录
        await upsertChat({
          userId: session.user.id,
          chatId: curChatId,
          title: fallBackTitle,
          chatMessages: updatedMessage,
        });
      } catch (error) {
        console.error("Failed to persist chat messages onEnd:", error);
      }
    },
  });

  /**
   * 7. 将模型结果转换成 useChat 能直接消费的 UI Message Stream
   * createUIMessageStreamResponse 负责“把 UI Message Stream 包装成 HTTP Response”
   */
  return createUIMessageStreamResponse({ stream });
}
