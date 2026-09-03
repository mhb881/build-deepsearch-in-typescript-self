// src/lib/ai-tools/searchWeb.tools

// tool: Vercel AI SDK 的工具声明函数，用于定义可供 AI 模型调用的结构化工具
import { tool } from "ai";
// z: Zod 校验库，用于定义输入参数的运行时 schema（同时为 AI 模型提供参数说明）
import { z } from "zod";
// searchSerper: 封装了 Serper API（Google 搜索服务）的请求函数，支持 Redis 缓存和请求取消
import { searchSerper } from "~/serper";

// 声明一个名为 searchWeb 的 AI 工具，AI 模型可根据 description 决定是否调用此工具
export const searchWeb = tool({
  // 工具的文本描述，AI 模型会看到这段文字来理解该工具的用途
  description: "Search the web for information",
  // 输入参数 schema：定义工具接受的参数结构及语义描述
  // query: 搜索关键词字符串，.describe() 的内容会作为 AI 模型的参数提示
  inputSchema: z.object({
    query: z.string().describe("The query to search the web for"),
  }),
  // 工具的实际执行函数
  // - { query }: 从 inputSchema 校验后的输入中解构出搜索关键词
  // - { abortSignal }: 框架提供的取消信号，用户中途取消时可中断网络请求
  execute: async ({ query }, { abortSignal }) => {
    // 调用 Serper API 发起 Google 搜索，请求最多 10 条自然搜索结果
    // abortSignal 传入以支持请求取消（如用户取消搜索时中断 fetch）
    const results = await searchSerper({ q: query, num: 10 }, abortSignal);
    // 从响应的 organic（自然搜索结果数组）中提取精简信息
    // 使用 ?? [] 做空值兜底，防止 organic 为 undefined 时报错
    // 每条结果只保留 title（标题）、link（链接）、snippet（摘要）三个字段
    // 丢弃 sitelinks、position、date 等字段，减少返回给 AI 模型的数据量
    return (results.organic ?? []).map((result) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
    }));
  },
});
