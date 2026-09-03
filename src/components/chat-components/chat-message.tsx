import { isToolUIPart } from "ai";
import { Markdown } from "./chat-markdown";
import type { ChatUIMessage, ChatUIPart } from "~/lib/types/ai-types";
import TextPart from "./text-part";
import ToolPart from "./tool-part";

interface ChatMessageProps {
  message: ChatUIMessage;
  userName: string;
}

interface MessagePartRendererProps {
  part: ChatUIPart;
}
function MessagePartRenderer({ part }: MessagePartRendererProps) {
  // 2️⃣ 模板字面量类型：tool-${name} 和 data-${name}
  //    switch 无法穷尽，必须用类型守卫
  if (isToolUIPart(part)) {
    return <ToolPart part={part} />;
  }

  // data-${name} 同理（本节不要求）
  if (part.type.startsWith("data-")) {
    return null;
  }

  switch (part.type) {
    case "text":
      return <TextPart part={part} />;

    // 本节不要求处理，保留结构便于扩展
    case "reasoning":
    case "source-url":
    case "source-document":
    case "file":
    case "reasoning-file":
    case "step-start":
    case "custom":
      return null;

    default:
      // TypeScript 穷尽检查：如果这里报错，说明有遗漏的 part 类型
      return null;
  }
}

export const ChatMessage = ({ message, userName }: ChatMessageProps) => {
  const role = message.role;
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI
            ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
            : "bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="prose dark:prose-invert max-w-none">
          {message.parts.map((part, index) => (
            <MessagePartRenderer key={`${message.id}-${index}`} part={part} />
          ))}
        </div>
      </div>
    </div>
  );
};
