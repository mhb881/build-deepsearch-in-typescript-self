import { setTimeout } from "node:timers/promises";

import { redis } from "./redis";

export interface RateLimitConfig {
  /** 允许的最大请求次数 */
  maxRequests: number;
  /** 时间窗口大小（毫秒） */
  windowMs: number;
  /** Redis 键名前缀，方便区分业务 */
  keyPrefix?: string;
  /** 允许的最大重试次数 */
  maxRetries?: number;
  /** 允许在服务端就地等待的最大毫秒数（超过此值直接拒绝，防止 Serverless 504 超时） */
  maxServerWaitMs?: number;
}

export interface RateLimitResult {
  /** 当前请求是否允许执行 */
  allowed: boolean;
  /** 窗口内剩余可用次数 */
  remaining: number;
  /** 窗口重置时间戳（Unix 毫秒） */
  resetTime: number;
  /** 当前窗口已被占用的总请求次数 */
  totalHits: number;
  /** 距离窗口重置还需等待的毫秒数（方便直接转成 HTTP Retry-After 响应头） */
  retryAfterMs: number;
  /**
   * 按需等待并重试的闭包函数（包含 Jitter 错峰唤醒与超时熔断保护）
   * 只有当你主动调用 await res.waitAndRetry() 时，它才会去等待
   */
  retry: () => Promise<boolean>;
}

/**
 * 全局速率限制器（以写代查，原子单次往返）
 */
export async function checkGlobalRateLimit(
  opts: RateLimitConfig,
): Promise<RateLimitResult> {
  const {
    maxRequests,
    windowMs,
    keyPrefix = "global_rate_limit",
    maxRetries = 3,
    maxServerWaitMs = 10_000,
  } = opts;

  // 先来算出当前窗口的开始时间
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  // 确认当前窗口的重置时间
  const resetTime = windowStart + windowMs;

  // 进来之后，计算距离窗口重置还需等待的毫秒数
  const retryAfterMs = Math.max(0, resetTime - now);
  const key = `${keyPrefix}:${windowStart}`;

  // 存储当前窗口已被占用的总请求次数
  let count: number;

  try {
    const pipeline = redis.pipeline();
    // 原子增加当前窗口已被占用的总请求次数
    pipeline.incr(key);
    // 设置当前窗口的过期时间为窗口大小（秒）
    pipeline.expire(key, Math.ceil(windowMs / 1000), "NX");

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Redis pipeline returned null");
    }

    const [incrErr, incrVal] = results[0] as [Error | null, number];
    if (incrErr) throw incrErr;

    count = incrVal;
  } catch (error) {
    console.error(
      "Redis rate limit failed, executing fail-open policy:",
      error,
    );
    // 故障放行兜底（Fail-Open）：Redis 异常时绝不阻断核心业务
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime,
      totalHits: 0,
      retryAfterMs: 0,
      retry: async () => true,
    };
  }

  // 检查当前请求是否允许执行
  const allowed = count <= maxRequests;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - count),
    resetTime,
    totalHits: count,
    retryAfterMs,
    // ⭐️ 核心动作 3：返回带保护机制的重试执行器（惰性求值，按需调用）
    retry: async () => {
      return await executeRetryLoop({
        opts,
        retryAfterMs,
      });
    },
  };
}

/**
 * 独立的重试执行器（扁平 for 循环，内嵌 Jitter 与防 Serverless 超时熔断）
 */
async function executeRetryLoop({
  opts,
  retryAfterMs,
}: {
  opts: RateLimitConfig;
  retryAfterMs: number;
}): Promise<boolean> {
  const { maxRetries = 3, maxServerWaitMs = 10_000 } = opts;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 防御 1：若等待时间超出允许的服务端上限（如需要等 30 秒，上限 10 秒），果断认怂，坚决不挂起
    if (retryAfterMs > maxServerWaitMs) {
      console.warn(
        `[RateLimit] 等待时长 (${retryAfterMs}ms) 超出服务端安全上限 (${maxServerWaitMs}ms)，终止等待`,
      );
      return false;
    }

    // 防御 2：增加 0 ~ 300ms 随机抖动（Jitter），错峰唤醒，彻底瓦解“惊群效应”
    const jitter = Math.floor(Math.random() * 300);
    await setTimeout(retryAfterMs + jitter);

    // 等待结束后，在新窗口内重新发起原子消费
    const nextResult = await checkGlobalRateLimit({
      ...opts,
      maxRetries: 0, // 避免内部子调用无限递归衍生子重试
    });
    if (nextResult.allowed) return true;

    // 更新下一轮等待时间
    retryAfterMs = nextResult.retryAfterMs;
  }

  return false;
}
