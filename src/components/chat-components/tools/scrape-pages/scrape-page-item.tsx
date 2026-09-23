"use client";

import { useState } from "react";
import {
  Globe,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ScrapeResultItem } from "../types";

interface ScrapePageItemProps {
  item: ScrapeResultItem;
}

export function ScrapePageItem({ item }: ScrapePageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  let hostname = item.url;
  try {
    hostname = new URL(item.url).hostname;
  } catch {
    // 降级使用原始 url
  }

  const charCount = item.data?.length ?? 0;

  return (
    <div className="rounded-lg border border-gray-200/90 bg-white p-2.5 transition-colors dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-xs font-medium text-gray-800 hover:text-blue-600 hover:underline dark:text-gray-200 dark:hover:text-blue-400"
            title={item.url}
          >
            {hostname}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.success ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              成功 (约{" "}
              {charCount > 1000
                ? `${(charCount / 1000).toFixed(1)}k`
                : charCount}{" "}
              字)
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              抓取失败
            </span>
          )}

          {item.success && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <span>{isExpanded ? "收起" : "预览"}</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 展开的 Markdown 正文预览 */}
      {isExpanded && item.success && (
        <div className="mt-2 rounded border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-950/60">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 font-medium">
              <FileText className="h-3 w-3" />
              抓取正文预览 (Markdown)
            </span>
            <span>{charCount} 字符</span>
          </div>
          <pre className="max-h-44 overflow-y-auto font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {item.data}
          </pre>
        </div>
      )}

      {/* 失败时的提示 */}
      {!item.success && (
        <div className="mt-1.5 rounded bg-rose-50/80 p-2 text-[11px] text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          {item.data || "抓取网页正文失败"}
        </div>
      )}
    </div>
  );
}
