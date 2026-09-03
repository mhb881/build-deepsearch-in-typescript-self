import {
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  PauseCircle,
  Search,
  ExternalLink,
} from "lucide-react";
import { getToolName, type DynamicToolUIPart, type ToolUIPart } from "ai";
import type { MyTools } from "~/lib/ai-tools/tools";

type AnyToolPart = ToolUIPart<MyTools> | DynamicToolUIPart;

function ToolPart({ part }: { part: AnyToolPart }) {
  const toolName = getToolName(part);

  switch (part.state) {
    case "input-streaming":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在分析需要调用什么工具…</span>
        </div>
      );

    case "input-available":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            准备调用 <span className="font-medium">{toolName}</span>
          </span>
        </div>
      );

    case "approval-requested":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          <PauseCircle className="h-4 w-4" />
          <span>
            <span className="font-medium">{toolName}</span> 等待用户批准
          </span>
        </div>
      );

    case "approval-responded":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            <span className="font-medium">{toolName}</span> 已响应批准
          </span>
        </div>
      );

    case "output-available": {
      const output = part.output;
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toolName} 执行完成</span>
          </div>
          <ToolOutputDisplay toolName={toolName} output={output} />
        </div>
      );
    }

    case "output-error": {
      const errorText = part.errorText;
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">{toolName}</span> 执行失败：
            {errorText}
          </span>
        </div>
      );
    }

    case "output-denied":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <Ban className="h-4 w-4" />
          <span>
            <span className="font-medium">{toolName}</span> 已被拒绝执行
          </span>
        </div>
      );

    default:
      return null;
  }
}

export default ToolPart;

function ToolOutputDisplay({
  toolName,
  output,
}: {
  toolName: string;
  output: unknown;
}) {
  if (toolName === "searchWeb" && Array.isArray(output)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Search className="h-3 w-3" />
          <span>搜索到 {output.length} 条结果</span>
        </div>
        <div className="space-y-2">
          {output
            .slice(0, 3)
            .map(
              (
                item: { link: string; title: string; snippet: string },
                i: number,
              ) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {item.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                    {item.snippet}
                  </p>
                </div>
              ),
            )}
        </div>
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}
