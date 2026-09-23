/**
 * src/lib/ai-tools/scrapePages.ts
 * 声明供 AI SDK 调用的网页抓取工具
 */

import { tool } from "ai";
import { z } from "zod";
import { bulkCrawlWebsites } from "~/server/scraper";

export const scrapePages = tool({
  description:
    "Read and extract the full markdown text of specific web pages. MANDATORY: After using searchWeb, you MUST call this tool on the most relevant URLs to read full articles, technical documentation, and code before generating an answer.",
  inputSchema: z.object({
    urls: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe("The list of URLs to scrape full article content from"),
  }),
  execute: async ({ urls }) => {
    const results = await bulkCrawlWebsites({ urls });

    if (!results.success) {
      return {
        error: results.error,
        results: results.results.map(({ url, result }) => ({
          url,
          success: result.success,
          data: result.success ? result.data : result.error,
        })),
      };
    }

    // 全部抓取成功分支：此时 TypeScript 已将 results 收窄为 BulkCrawlSuccessResponse
    // 每个 result 必定是 CrawlSuccessResponse，只含有 data 属性（无 error 属性），直接取 result.data
    return {
      results: results.results.map(({ url, result }) => ({
        url,
        success: result.success,
        data: result.data,
      })),
    };
  },
});
