// src/app/(chat)/[chatId]/loading.tsx
import { Loader2 } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white dark:bg-gray-950">
      {/* <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 shadow-xs dark:bg-gray-900 dark:text-gray-400">
        <span>正在加载对话历史...</span>
      </div> */}
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
    </div>
  );
}
