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
import { auth } from "~/server/auth";

// 系统提示词
const systemPrompt = `You are a helpful assistant with access to a web search tool.
RULES:
1. Always search the web for up-to-date information when relevant.
2. Cite your sources inline using markdown links, e.g. [source](url).
3. If you're unsure about something, search the web to verify.
4. Do NOT make up information. If you cannot find an answer, say so.`;
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

  // 1. 前端 useChat 发送的是 UIMessage[]
  //   const body = (await req.json()) as {
  //     id: string;
  //     messages: UIMessage[];
  //     trigger: string;
  //   };
  //   const messages = body.messages;
  const { messages }: { messages: UIMessage[] } = await req.json();

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
    onEnd: ({ text, usage }) => {
      // console.log("Generation ended:", text);
      console.log("Token usage:", usage);
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
