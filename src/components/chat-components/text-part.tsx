import type { ChatUIPart } from "~/lib/types/ai-types";
import { Markdown } from "./chat-markdown";

interface TextPartProps {
  part: Extract<ChatUIPart, { type: "text" }>;
}

function TextPart({ part }: TextPartProps) {
  return (
    <div>
      <Markdown>{part.text}</Markdown>
    </div>
  );
}

export default TextPart;
