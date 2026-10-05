import type { UIMessage } from "ai";
import { evalite } from "evalite";

import { askDeepSearch } from "~/deepsearch";

evalite("Deep Search Eval", {
  // 1. 测试数据集：提供两个具有代表性的技术调研问题
  data: async (): Promise<{ input: UIMessage[] }[]> => {
    return [
      {
        input: [
          {
            id: "1",
            role: "user",
            parts: [
              {
                type: "text",
                text: "What is the latest version of TypeScript?",
              },
            ],
          },
        ],
      },
      {
        input: [
          {
            id: "2",
            role: "user",
            parts: [
              {
                type: "text",
                text: "What are the main features of Next.js 16?",
              },
            ],
          },
        ],
      },
      {
        input: [
          {
            id: "3",
            role: "user",
            parts: [
              {
                type: "text",
                text: "Compare, react, and view JS.",
              },
            ],
          },
        ],
      },
      {
        input: [
          {
            id: "4",
            role: "user",
            parts: [
              {
                type: "text",
                text: "Best practices for handling authentication in Next.js.",
              },
            ],
          },
        ],
      },
    ];
  },

  // 2. 评测执行任务：直接将输入透传给纯函数 askDeepSearch
  task: async (input) => {
    return await askDeepSearch(input);
  },

  // 3. 确定性打分器：断言模型回答中必须包含 Markdown 格式链接 [text](url)
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // 匹配 Markdown 格式链接：[链接文本](https://...)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
        // 更好的做法：确保模型引用的每一个网址都明确带有安全的 http:// 或 https:// 协议头
        const validUrlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
        const containsLinks = validUrlRegex.test(output);
        return containsLinks ? 1 : 0;
      },
    },
  ],
});
