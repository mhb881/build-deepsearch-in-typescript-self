interface ToolFallbackViewProps {
  output: unknown;
}

/**
 * 兜底 JSON 代码查看器（未知工具回退）
 */
export function ToolFallbackView({ output }: ToolFallbackViewProps) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}
