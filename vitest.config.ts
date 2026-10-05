import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    // 确保在任何测试执行前，先行将 .env 中的环境变量注入全局 process.env
    setupFiles: ["src/evals/setup.ts"],
    // 将超时时间放宽到 120 秒（2分钟），给 Agent 搜索、抓取和推理充足时间
    testTimeout: 120_000,
    // 禁用并发，强制按序列执行，避免触发大模型 API 的 15 RPM 静默限流
    sequence: {
      concurrent: false,
    },
  },
  // 注入 TypeScript 路径别名解析插件，对齐 tsconfig.json 中的 "~/*"
  plugins: [tsconfigPaths()],
});
