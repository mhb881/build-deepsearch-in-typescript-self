"use client";

import { Globe, AlertTriangle } from "lucide-react";
import type { ScrapePagesOutput } from "../types";
import { ScrapePageItem } from "./scrape-page-item";

interface ScrapePagesViewProps {
  output: ScrapePagesOutput;
}

export function ScrapePagesView({ output }: ScrapePagesViewProps) {
  const results = output.results ?? [];
  const successCount = results.filter((r) => r.success).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5 font-medium">
          {/* <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> */}
          <span>
            已解析 {results.length} 个页面 ({successCount}/{results.length}{" "}
            成功)
          </span>
        </div>
        {output.error && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            部分失败
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {results.map((item, index) => (
          <ScrapePageItem key={`${item.url}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}
