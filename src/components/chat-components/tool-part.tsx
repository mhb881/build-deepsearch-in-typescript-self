"use client";

import { Loader2, CheckCircle2, XCircle, Ban, PauseCircle } from "lucide-react";
import { getToolName, type DynamicToolUIPart, type ToolUIPart } from "ai";
import type { MyTools } from "~/lib/ai-tools/tools";
import { getToolMeta, ToolOutputDisplay } from "./tools";

type AnyToolPart = ToolUIPart<MyTools> | DynamicToolUIPart;

/**
 * ToolPart: AI 工具调用生命周期壳层组件
 * 职责：专职处理 Vercel AI SDK 的状态机变化（流式输入、准备执行、等待审批、报错、完成），
 * 并将具体的工具展示分发至 tools/ 子系统。
 */
function ToolPart({ part }: { part: AnyToolPart }) {
  const toolName = getToolName(part);
  const { label, icon: ToolIcon } = getToolMeta(toolName);

  switch (part.state) {
    case "input-streaming":
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
          <span>正在分析需要调用什么工具…</span>
        </div>
      );

    case "input-available":
      return (
        <div className="my-2 flex items-center justify-between rounded-lg border border-blue-200/70 bg-blue-50/60 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span>
              正在调用 <span className="font-semibold">{label}</span>
              <span className="ml-1 text-xs opacity-75">({toolName})</span>
            </span>
          </div>
          <ToolIcon className="h-4 w-4 opacity-60" />
        </div>
      );

    case "approval-requested":
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
          <PauseCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span>
            <span className="font-medium">{label}</span> 等待用户批准
          </span>
        </div>
      );

    case "approval-responded":
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <CheckCircle2 className="h-4 w-4 text-gray-500" />
          <span>
            <span className="font-medium">{label}</span> 已响应批准
          </span>
        </div>
      );

    case "output-available": {
      const output = part.output;
      return (
        <div className="my-2 rounded-xl border border-gray-200 bg-gray-50/90 p-3 text-sm transition-all dark:border-gray-800 dark:bg-gray-900/60">
          <div className="mb-2.5 flex items-center justify-between border-b border-gray-200/60 pb-2 dark:border-gray-800/60">
            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
              <ToolIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{label}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({toolName})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>执行完成</span>
            </div>
          </div>

          {/* 展示工具输出，根据 toolName 分发至 tools/ 子系统 */}
          <ToolOutputDisplay toolName={toolName} output={output} />
        </div>
      );
    }

    case "output-error": {
      const errorText = part.errorText;
      return (
        <div className="my-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>
            <span className="font-medium">{label}</span> 执行失败：{errorText}
          </span>
        </div>
      );
    }

    case "output-denied":
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <Ban className="h-4 w-4" />
          <span>
            <span className="font-medium">{label}</span> 已被拒绝执行
          </span>
        </div>
      );

    default:
      return null;
  }
}

export default ToolPart;
