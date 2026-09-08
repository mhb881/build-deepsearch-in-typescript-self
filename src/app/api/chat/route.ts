import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { searchWeb } from "~/lib/ai-tools/searchWeb";
import { model } from "~/lib/ai/model";
import type { ChatUIMessage } from "~/lib/types/ai-types";
import { auth } from "~/server/auth";
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
  // ─── 1. 认证守卫 ─── (后端)
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

  // 速率限制检查：超限返回 429，管理员自动放行
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

  // 1. 前端 useChat 发送的是 UIMessage[]
  const { messages }: { messages: ChatUIMessage[]; chadId?: string } =
    await req.json();

  // 记录请求到数据库
  await logRequest(session.user.id);

  // 2. 将 UI 层消息转换为模型层消息
  const modelMessages = await convertToModelMessages(messages);

  // 3. 调用模型进行流式生成
  const result = streamText({
    model,
    instructions: systemPrompt,
    messages: modelMessages,
    tools: {
      searchWeb,
    },
    // ✅ 步骤 7：v7 中 maxSteps → stopWhen: isStepCount(n)
    stopWhen: isStepCount(10),
    // ✅ v7：onFinish → onEnd
    onEnd: ({ usage, responseMessages }) => {
      // console.log("Generation ended:", text);
      console.log("Token usage:", usage);
      // 在调用过程中生成的响应消息，即从 AI 传来的新消息
      console.log("Response messages:", responseMessages);
    },
  });

  // 4. 将模型结果转换成 useChat 能直接消费的 UI Message Stream
  // createUIMessageStreamResponse(...) 负责“把 UI Message Stream 包装成 HTTP Response”
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      // toUIMessageStream(...) 负责“把模型 stream 转成 UI Message Stream”
      stream: result.stream,
    }),
  });
}
