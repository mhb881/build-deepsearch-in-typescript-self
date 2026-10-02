import { evalite } from "evalite";
import { Levenshtein } from "autoevals";

evalite("My Eval", {
  // 一个返回测试数据数组的函数
  // - TODO: 替换成你的测试数据
  data: async () => {
    return [{ input: "Hello", expected: "Hello World!" }];
  },
  // 要执行的任务
  // - TODO: 替换成你的 LLM 调用
  task: async (input) => {
    return input + " Brian!";
  },
  // 这个 eval 的评分方法
  scorers: [Levenshtein],
});
