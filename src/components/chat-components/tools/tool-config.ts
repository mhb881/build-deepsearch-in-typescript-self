import { Search, Globe, Code2, type LucideIcon } from "lucide-react";

export interface ToolMeta {
  label: string;
  icon: LucideIcon;
  description?: string;
}

// ─── 工具元信息映射字典 ───
export const TOOL_CONFIG: Record<string, ToolMeta> = {
  searchWeb: {
    label: "网页搜索",
    icon: Search,
    description: "检索互联网相关资料",
  },
  scrapePages: {
    label: "页面抓取",
    icon: Globe,
    description: "抓取并解析网页正文",
  },
};

export function getToolMeta(toolName: string): ToolMeta {
  return (
    TOOL_CONFIG[toolName] ?? {
      label: toolName,
      icon: Code2,
      description: "执行自定义工具",
    }
  );
}
