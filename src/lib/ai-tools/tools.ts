import { searchWeb } from "./searchWeb";
import { type InferUITools, type ToolSet } from "ai";

export const tools = {
  searchWeb,
} satisfies ToolSet;
export type MyTools = InferUITools<typeof tools>;
