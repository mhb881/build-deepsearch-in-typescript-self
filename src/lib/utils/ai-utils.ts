// lib/utils/ai-utils.ts
import type { ChatUIMessage } from "../types/ai-types";
import type { DB } from "~/server/db/schema";

export const extractChatTitle = (lastMessage?: ChatUIMessage) => {
  // 自动从最后一条用户消息生成标题概要（截取前 50 字）
  const firstTextPart = lastMessage?.parts.find((i) => i.type === "text");
  const fallBackTitle =
    (firstTextPart && "text" in firstTextPart
      ? firstTextPart.text
      : "新对话"
    ).slice(0, 50) + "...";
  return fallBackTitle;
};

export interface NewChatCreatedPayload {
  chatId: string;
}
export function isNewChatCreatedData(
  part: unknown,
): part is { type: "data-chat-created"; data: NewChatCreatedPayload } {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "data-chat-created" &&
    "data" in part &&
    typeof (part as { data: unknown }).data === "object" &&
    (part as { data: Record<string, unknown> }).data !== null &&
    typeof (part as { data: { chatId?: unknown } }).data.chatId === "string"
  );
}

export function mapDBMessagesToUIMessages(
  dbMessages: DB.Message[],
): ChatUIMessage[] {
  return dbMessages.map((msg) => ({
    id: msg.id, // ⭐️ 核心：复用数据库主键，严禁调用 randomUUID()！
    role: msg.role as "user" | "assistant" | "system",
    // 🛡️ 防御性兜底：确保一定是数组
    parts: Array.isArray(msg.parts)
      ? // ⭐️ 纯 Part 反序列化，无 content 冗余
        (msg.parts as ChatUIMessage["parts"])
      : [],
  }));
}
