import { scrapePages } from "./scrapePages";
import { searchWeb } from "./searchWeb";
import { type InferUITools, type ToolSet } from "ai";

export const tools = {
  searchWeb,
  scrapePages,
} satisfies ToolSet;
export type MyTools = InferUITools<typeof tools>;
