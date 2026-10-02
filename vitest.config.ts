import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    // 确保在任何测试执行前，先行将 .env 中的环境变量注入全局 process.env
    setupFiles: ["dotenv/config"],
  },
  // 注入 TypeScript 路径别名解析插件，对齐 tsconfig.json 中的 "~/*"
  plugins: [tsconfigPaths()],
});
