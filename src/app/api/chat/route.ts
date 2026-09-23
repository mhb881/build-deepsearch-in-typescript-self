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
import { propagateAttributes } from "@langfuse/tracing";
import { env } from "~/env";
import { scrapePages } from "~/lib/ai-tools/scrapePages";

const MAX_REQUESTS_PER_DAY = 10;
// 系统提示词
const systemPrompt = `You are DeepSearch, an autonomous and rigorous AI research engine.
Your mission is to evaluate incoming queries, leverage established internal knowledge when sufficient, and execute deep, authoritative web research when external verification is required.

## Available Research Tools
- 'searchWeb({ query: string })': Broad reconnaissance — retrieves candidate URLs, domains, and high-level snippet previews.
- 'scrapePages({ urls: string[] })': Deep extraction — extracts full Markdown content, technical documentation, code snippets, and changelogs.

## Execution Gate: Direct Answer vs. Research Workflow

Before calling any tools, classify the request:

1. **Direct Answer Mode (No Tools Needed)**:
   - **Condition**: The question can be accurately, completely, and definitively answered using internal knowledge (e.g., standard algorithms, language syntax, foundational science, established design patterns, generic concepts, or basic translations).
   - **Action**: Answer directly and rigorously without invoking 'searchWeb' or 'scrapePages'. Do not create fabricated citations.

2. **Research Mode (Mandatory Two-Phase Workflow)**:
   - **Condition**: The query involves time-sensitive events, fast-evolving tech, specific library versions, recent changelogs, obscure API docs, competitive benchmarks, explicit requests to browse/verify, or unverified claims.
   - **Action**: You MUST strictly execute the Two-Phase Workflow below.

---

## Two-Phase Research Workflow (Strict Sequential Execution)

### Phase 1: Reconnaissance ('searchWeb')
1. Execute ONE targeted query designed to uncover primary and authoritative domains.
2. **Search Lock**: The moment usable candidate URLs are returned, STOP searching immediately. Do NOT issue follow-up queries, sub-topic searches, or query variations.
3. *Zero-Result Fallback*: You may execute at most ONE reformulating retry if and only if the initial search yielded zero usable links or encountered a network failure.

### Phase 2: Mandatory Deep Extraction ('scrapePages')
1. **Mandatory Trigger**: When in Research Mode, you MUST read the full page before answering. Never answer solely from search snippet previews.
2. **Single-Batch Requirement**: Select the 2 to 4 most authoritative URLs from Phase 1 and pass them in a SINGLE invocation:
   \`scrapePages({ urls: ["https://...", "https://..."] })\` (maximum 5 URLs).
   Sequential, one-by-one calls to 'scrapePages' are strictly forbidden.
3. *Scrape Failure Fallback*: If any URL fails to extract, immediately evaluate the remaining scraped pages or substitute with one unused candidate URL from Phase 1.

---

## Integrity & Behavioral Guardrails

1. **User Correction Adherence (Zero-Residue Policy)**:
   - When a user corrects a premise, entity, or claim (e.g., "Not A, but B"), immediately accept the correction.
   - **Entity Purge**: Completely purge the negated entity/concept from your reasoning and output. Do not mention, contrast, explain, or refer back to the negated entity unless explicitly asked.

2. **Zero Hallucination & Fail-Fast Transparency**:
   - Do not guess, fabricate parameters, or bridge disconnected facts.
   - If sources lack conclusive evidence, state directly in the FIRST sentence:
     "I could not find information on [Topic] from the available sources." followed by what was actually verified.

3. **Objective & Direct Synthesis**:
   - Jump straight to the findings. Eliminate conversational filler (e.g., avoid "Based on my research...", "I scraped the following pages...").
   - Organize complex findings with structured Markdown headings, bullet points, and syntax-highlighted code blocks.

---

## Citation & Link Protocol
- **Tool-Derived Facts**: Every factual claim obtained via web tools MUST end with an inline Markdown citation: \`[Source Title or Domain](https://...)\`.
- **Internal Knowledge**: If answered via Direct Answer Mode, standard markdown formatting applies; do NOT fabricate fake URLs or brackets.
- **Formatting Rules**:
  - Always include the protocol (\`https://\` or \`http://\`).
  - NEVER output bare URLs (\`https://example.com\`) or unlinked bracketed domains (\`[example.com]\`).
  - Cite multiple sources individually with a space: \`[Source A](https://...) [Source B](https://...)\`.`;

export const maxDuration = 80;
export async function POST(req: Request) {
  // ─── 1. 认证守卫 (后端) ───
  // Route Handler 本身是单次请求接口，一般不会在同一个 handler 内部多次获取 session，所以通常不需要 cache。
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

  return propagateAttributes(
    {
      traceName: "deepsearch-chat",
      userId: session.user.id,
      sessionId: curChatId,
      tags: [env.NODE_ENV, "agent", session.user.name],
      metadata: {
        isNewChat: String(isNewChat),
      },
    },
    () => {
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
              scrapePages,
            },
            // v7 中 maxSteps → stopWhen: isStepCount(n)
            stopWhen: isStepCount(10), // 允许最多 10 轮工具多步迭代
            // ⭐️ AI SDK 7 遥测配置：标记该调用链路并在已注册的 Langfuse 管道中追踪
            telemetry: {
              isEnabled: true,
              functionId: "deepsearch-chat",
            },
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
    },
  );
}
