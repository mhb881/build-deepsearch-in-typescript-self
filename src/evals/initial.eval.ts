import { evalite } from "evalite";
import { askDeepSearch } from "~/deepsearch";
import type { UIMessage } from "ai";

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
    ];
  },

  // 2. 评测执行任务：直接将输入透传给纯函数 askDeepSearch
  task: async (input) => {
    return await askDeepSearch(input);
  },

  // 3. 打分器：当前先跑通真实业务链路，留空 scorers 观察生成结果
  scorers: [],
});
