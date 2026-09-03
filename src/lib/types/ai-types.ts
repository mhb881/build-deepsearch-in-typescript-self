import type { UIMessage, UIDataTypes, UIMessagePart } from "ai";
import type { MyTools } from "../ai-tools/tools";

/** 带工具类型的消息：part.type === 'tool-searchWeb' 时，output 会被精确推断 */
export type ChatUIMessage = UIMessage<unknown, UIDataTypes, MyTools>;
export type ChatUIPart = UIMessagePart<UIDataTypes, MyTools>;
