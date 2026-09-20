/*
Next.js 启动的时候就会执行：
.env.local
    ↓
HTTPS_PROXY=http://127.0.0.1:10808

instrumentation.ts
    ↓
ProxyAgent
    ↓
setGlobalDispatcher()
    ↓
Node.js/Undici fetch
    ↓
Better Auth
    ↓
Discord
 */
import { env } from "./env";
import { runProxy } from "./lib/proxy";

export async function register() {
  // ⭐️ 核心守卫：仅在 Node.js 服务端运行时激活遥测与代理
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 本地网络代理配置（用于外部大模型 API / OAuth 穿透）
    runProxy();

    // 2. 动态导入 OpenTelemetry 与 Langfuse 遥测模块（避免污染客户端打包）
    const { registerOTel } = await import("@vercel/otel");
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");
    const { registerTelemetry } = await import("ai");
    const { LangfuseVercelAiSdkIntegration } =
      await import("@langfuse/vercel-ai-sdk");
    // const { NodeSDK } = await import("@opentelemetry/sdk-node");

    // 3. 注册 OpenTelemetry 并挂载 LangfuseSpanProcessor
    registerOTel({
      serviceName: "deepsearch-course",
      spanProcessors: [
        new LangfuseSpanProcessor({
          environment: env.NODE_ENV, // ⭐️ 全局绑定当前部署环境（development / production）
        }),
      ],
    });

    // 纯手动
    // const sdk = new NodeSDK({
    //   serviceName: "deepsearch-course",
    //   spanProcessors: [new LangfuseSpanProcessor()],
    // });
    // sdk.start();

    // 4. 将 Langfuse 遥测集成器挂载到 AI SDK 7 全局生命周期中
    registerTelemetry(new LangfuseVercelAiSdkIntegration());

    console.log(
      `[Instrumentation] Langfuse 遥测管道就绪 (Environment: ${env.NODE_ENV}) 🚀`,
    );
  }
}
