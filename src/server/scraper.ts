import { setTimeout } from "node:timers/promises";

import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import TurndownService from "turndown";

import { cacheWithRedis } from "./redis/redis";

export const DEFAULT_MAX_RETRIES = 3;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;

export interface CrawlSuccessResponse {
  success: true;
  data: string;
}

export interface CrawlErrorResponse {
  success: false;
  error: string;
}

export type CrawlResponse = CrawlSuccessResponse | CrawlErrorResponse;

export interface BulkCrawlSuccessResponse {
  success: true;
  results: {
    url: string;
    result: CrawlSuccessResponse;
  }[];
}

export interface BulkCrawlErrorResponse {
  success: false;
  results: {
    url: string;
    result: CrawlResponse;
  }[];
  error: string;
}

export type BulkCrawlResponse =
  BulkCrawlSuccessResponse | BulkCrawlErrorResponse;

export interface CrawlOptions {
  maxRetries?: number;
}

export interface BulkCrawlOptions extends CrawlOptions {
  urls: string[];
}

// 1. 初始化 Turndown 转换服务
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

// SSRF 安全校验：禁止访问内网保留地址与本地回环
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 2. 清洗 HTML 并提取核心正文
const extractArticleText = (html: string) => {
  const $ = cheerio.load(html); // 返回一个函数

  // 移除不需要的元素
  $("script, style, nav,header,footer,iframe,noscript").remove();

  // 优先匹配常见文章容器选择器
  const articlesSelectors = [
    "article",
    '[role="main"]',
    ".post-content",
    ".article-content",
    "main",
    ".content",
    "div.article",
    "div.content",
    "div.post-content",
    "div.post-body",
    "div.post-main",
  ];

  let content = "";
  for (const selector of articlesSelectors) {
    const element = $(selector); // 一个 cheerio 包装对象（类数组对象）
    if (element.length) {
      content = turndownService.turndown(element.html() || "");
      break;
    }
  }

  if (!content) {
    content = turndownService.turndown($("body").html() || "");
  }

  return content.trim();
};

// 3. 校验 robots.txt 抓取权限
const checkRobotsTxt = async (url: string): Promise<boolean> => {
  // 如何使用 https://www.npmjs.com/package/robots-parser
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    const response = await fetch(robotsUrl);

    if (!response.ok) {
      // 如果网站根本没有 robots.txt，默认允许抓取
      return true;
    }

    const robotsTxt = await response.text();
    const robots = robotsParser(robotsUrl, robotsTxt);

    // ⭐️ 模拟常见合规爬虫 User-Agent（这里沿用视频中的 LinkedInBot）
    return robots.isAllowed(url, "LinkedInBot") ?? true;
  } catch (error) {
    // 若请求 robots.txt 出现网络异常，默认宽松允许
    return true;
  }
};

// 4. 单站点抓取（包装 Redis 缓存与指数退避重试）
export const crawlWebsite = cacheWithRedis(
  "crawlWebsite",
  async (options: CrawlOptions & { url: string }): Promise<CrawlResponse> => {
    const { url, maxRetries = DEFAULT_MAX_RETRIES } = options;

    // 校验 URL 是否安全
    if (!isSafeUrl(url)) {
      throw new Error(
        `Security Exception: URL '${url}' points to an invalid or private network address.`,
      );
    }

    // 先核对 robots.txt 抓取权限
    const isAllowed = await checkRobotsTxt(url);
    if (!isAllowed) {
      return {
        success: false,
        error: `Crawling not allowed by robots.txt for: ${url}`,
      };
    }

    // 指数退避重试
    let attempts = 0;
    while (attempts < maxRetries) {
      // 10秒超时熔断
      const controller = new AbortController();
      // 这里是 Node.js 的 setTimeout，返回 Promise Promise<unknown>
      const promise = setTimeout(10000, controller.abort());

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-agent":
              "Mozilla/5.0 (compatible; DeepSearchBot/1.0; +https://example.com/bot)",
          },
        });

        // 如果响应状态码为 200，说明成功获取到 HTML
        if (response.ok) {
          const html = await response.text();
          const articleText = extractArticleText(html);
          return {
            success: true,
            data: articleText,
          };
        }

        // 否则，启动指数退避重试
        attempts++;
        if (attempts === maxRetries) {
          return {
            success: false,
            error: `Failed to fetch website after ${maxRetries} attempts: ${response.status} ${response.statusText}`,
          };
        }

        // ⭐️ 指数退避计算延迟时间：0.5s, 1s, 2s, 4s, 最大 8s
        const delay = Math.min(
          MIN_DELAY_MS * Math.pow(2, attempts),
          MAX_DELAY_MS,
        );
        await setTimeout(delay);
      } catch (error) {
        attempts++;
        if (attempts === maxRetries) {
          return {
            success: false,
            error: `Network error after ${maxRetries} attempts: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }

        const delay = Math.min(
          MIN_DELAY_MS * Math.pow(2, attempts),
          MAX_DELAY_MS,
        );
        await setTimeout(delay);
      } finally {
        // 清理定时器
        controller.abort(); // Promise 直接 reject，抛出 AbortError
      }
    }

    return {
      success: false,
      error: "Maximum retry attempts reached",
    };
  },
);

// 5. 批量抓取入口
export const bulkCrawlWebsites = async (
  options: BulkCrawlOptions,
): Promise<BulkCrawlResponse> => {
  const { urls, maxRetries = DEFAULT_MAX_RETRIES } = options;

  // 使用 Promise.all 并发请求全部 URL
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      result: await crawlWebsite({ url, maxRetries }),
    })),
  );

  const allSuccessful = results.every((r) => r.result.success);

  if (!allSuccessful) {
    const errors = results
      .filter((r) => !r.result.success)
      .map((r) => `${r.url}: ${(r.result as CrawlErrorResponse).error}`)
      .join("\n");

    return {
      results,
      success: false,
      error: `Failed to crawl some websites:\n${errors}`,
    };
  }

  return {
    results,
    success: true,
  } as BulkCrawlResponse;
};
