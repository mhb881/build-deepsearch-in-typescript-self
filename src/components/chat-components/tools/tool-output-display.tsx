"use client";

import type { ScrapePagesOutput, SearchWebResultItem } from "./types";
import { SearchWebView } from "./search-web/search-web-view";
import { ScrapePagesView } from "./scrape-pages/scrape-pages-view";
import { ToolFallbackView } from "./tool-fallback-view";

interface ToolOutputDisplayProps {
  toolName: string;
  output: unknown;
}

/**
 * 多态分发器（根据 toolName 派发对应视图）
 */
export function ToolOutputDisplay({
  toolName,
  output,
}: ToolOutputDisplayProps) {
  // 1. searchWeb 工具输出展示
  if (toolName === "searchWeb" && Array.isArray(output)) {
    return <SearchWebView output={output as SearchWebResultItem[]} />;
  }

  // 2. scrapePages 工具输出展示
  if (
    toolName === "scrapePages" &&
    output &&
    typeof output === "object" &&
    "results" in output &&
    Array.isArray((output as ScrapePagesOutput).results)
  ) {
    return <ScrapePagesView output={output as ScrapePagesOutput} />;
  }

  // 3. 兜底 JSON 查看器
  return <ToolFallbackView output={output} />;
}
