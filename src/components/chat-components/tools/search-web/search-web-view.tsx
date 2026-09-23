"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { SearchWebResultItem } from "../types";

interface SearchWebViewProps {
  output: SearchWebResultItem[];
}

export function SearchWebView({ output }: SearchWebViewProps) {
  const [showAll, setShowAll] = useState(false);
  const displayItems = showAll ? output : output.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5 font-medium">
          {/* <Search className="h-3.5 w-3.5 text-blue-500" /> */}
          <span>搜索到 {output.length} 条相关结果</span>
        </div>
        {output.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {showAll ? "收起" : `展开更多 (${output.length - 3})`}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {displayItems.map((item, i) => (
          <div
            key={`${item.link}-${i}`}
            className="rounded-lg border border-gray-200/90 bg-white p-2.5 transition-colors dark:border-gray-800 dark:bg-gray-900"
          >
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <span className="line-clamp-1">{item.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {item.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
