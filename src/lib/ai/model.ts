import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const googleModel = google("gemini-3.5-flash-lite");
/*
使用 SiliconFlow 模型生成文本示例：
model: siliconflow.chatModel(
  "Pro/deepseek-ai/DeepSeek-R1",
),
模型：
"deepseek-ai/DeepSeek-V4-Flash"
 */
const siliconflow = createOpenAICompatible({
  name: "siliconflow",
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});
const siliconflowModel = siliconflow.chatModel("deepseek-ai/DeepSeek-V4-Flash");

export const model = googleModel;
