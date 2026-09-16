import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   * 定义 服务端 环境变量的 Zod schema（不会暴露给浏览器）
   */
  server: {
    REDIS_URL: z.url(), // Redis 连接地址（必须是有效 URL）
    // 认证密钥
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string() // 生产环境：必填字符串
        : z.string().optional(), // 开发/测试环境：可选
    DATABASE_URL: z.url(), // 数据库连接地址（必须是有效 URL）
    NODE_ENV: z // Node.js 运行环境
      .enum(["development", "test", "production"])
      .default("development"), // 默认为 development

    // Discord Auth
    AUTH_DISCORD_ID: z.string(),
    AUTH_DISCORD_SECRET: z.string(),

    // Serper API Key
    SERPER_API_KEY: z.string(),

    // Gemini API Key
    GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
    // SiliconFlow API Key
    SILICONFLOW_API_KEY: z.string(),

    // Langfuse API Key
    LANGFUSE_SECRET_KEY: z.string(),
    LANGFUSE_PUBLIC_KEY: z.string(),
    LANGFUSE_BASE_URL: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   * 定义 客户端 环境变量（必须以 NEXT_PUBLIC_ 开头）
   */
  client: {},

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   * 将 process.env.XXX 手动映射进去（因为 Next.js edge runtime 不能直接解构 process.env）
   */
  runtimeEnv: {
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
    // Serper API Key
    SERPER_API_KEY: process.env.SERPER_API_KEY,
    // Discord Auth
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    // Langfuse API Key
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   * 当设置 SKIP_ENV_VALIDATION 环境变量时跳过验证（用于 Docker 构建）
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   * 将空字符串视为 undefined，避免空值通过验证
   */
  emptyStringAsUndefined: true,
});
/*
为什么需要这个文件？
类型安全：提供 TypeScript 类型推断，避免拼写错误
运行时验证：应用启动时检查环境变量是否正确配置
开发体验：在 IDE 中获得自动补全和错误提示
防止部署错误：在生产环境中强制要求必要的环境变量
这是一个典型的 T3 Stack 项目中的环境变量管理模式，非常适合 Next.js 应用程序。
 */
