import type { UIMessage, UIMessagePart } from "ai";
import type { MyTools } from "../ai-tools/tools";

/**
 * ⭐️ AI SDK 7 自定义 UI 数据流事件映射表
 * 键名对应事件类型 "data-${NAME}"，值为 payload 结构
 */
export type ChatUIDataTypes = {
  "chat-created": {
    chatId: string;
  };
};

/** 带工具类型的消息：part.type === 'tool-searchWeb' 时，output 会被精确推断 */
export type ChatUIMessage = UIMessage<unknown, ChatUIDataTypes, MyTools>;
export type ChatUIPart = UIMessagePart<ChatUIDataTypes, MyTools>;
