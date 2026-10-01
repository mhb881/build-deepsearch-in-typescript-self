import {
  startActiveObservation,
  type LangfuseObservationType,
  type LangfuseSpan,
  type LangfuseRetriever,
} from "@langfuse/tracing";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { env } from "~/env";

/**
 * 全局单例 Langfuse Span Processor
 *
 * 使用 Langfuse 的默认 smart filter：
 * - Langfuse 自己的 observations
 * - gen_ai.* spans
 * - 已知 LLM instrumentation spans
 *
 * DB Observation 直接使用 @langfuse/tracing，因此无需额外 shouldExportSpan 白名单。
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  environment: env.NODE_ENV,
});

/**
 * 数据库操作统一追踪封装。
 *
 * 设计原则：
 * 1. SELECT → retriever
 * 2. INSERT / UPDATE / DELETE → span
 * 3. 不记录完整数据库结果，避免把 DB 数据直接写入 Langfuse
 * 4. 错误通过 Langfuse observation 的 level/statusMessage 标记
 */
export async function withDbSpan<T>({
  name,
  type = "span",
  input,
  fn,
}: {
  name: string;
  type?: Extract<LangfuseObservationType, "span" | "retriever">;
  input?: Record<string, unknown>;
  fn: () => Promise<T>;
}): Promise<T> {
  // 抽出通用的观测执行与数据记录逻辑
  const run = async (observation: LangfuseSpan | LangfuseRetriever) => {
    if (input) {
      observation.update({
        input,
      });
    }

    try {
      const result = await fn();

      // 不记录原始 DB result。
      // 对 SELECT 只记录是否命中，对写操作只记录成功状态。
      observation.update({
        output: {
          success: true,
          ...(type === "retriever"
            ? { found: result !== undefined && result !== null }
            : {}),
        },
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      observation.update({
        level: "ERROR",
        statusMessage: errorMessage,
        output: {
          success: false,
        },
      });

      throw error;
    }
  };

  // ⭐️ 分流匹配各自独立的重载签名，解决 TypeScript 联合类型无法命中重载的问题
  if (type === "retriever") {
    return startActiveObservation(name, run, { asType: "retriever" });
  }

  return startActiveObservation(name, run, { asType: "span" });
}
