import { setTimeout } from "node:timers/promises";

import { redis } from "./redis";

/**
 * 速率限制配置参数
 */
interface RateLimitConfig {
  /* 允许的最大请求次数 */
  maxRequests: number;
  /* 时间窗口大小（毫秒） */
  windowMs: number;
  /* Redis 键名前缀，方便区分不同业务场景（如 chat、evals） */
  keyPrefix?: string;
  /* 超限时最大允许重试的次数，防止死循环 */
  maxRetries?: number;
}

/**
 * 速率限制检查结果
 */
interface RateLimitResult {
  /** 当前请求是否允许执行 */
  allowed: boolean;
  /** 当前时间窗口内剩余可用次数 */
  remaining: number;
  /** 当前窗口结束并重置的 Unix 毫秒时间戳 */
  resetTime: number;
  /** 当前窗口内已被占用的总请求次数 */
  totalHits: number;
  /** 自动等待窗口重置并重新检查的重试闭包 */
  retry: () => Promise<boolean>;
}

/**
 * 原子性记录一次请求（占用一次配额）
 * 作用：**记录一次请求，把当前时间窗口内的请求计数 +1**
 * 使用 Redis Pipeline 在单次网络往返中同时完成自增与过期时间绑定
 * 这个函数**只负责计数，不做判断是否超限**
 *
 * `redis.pipeline()`：把多条 Redis 命令打包，一次性发给 Redis，减少多次网络往返开销。
 *
 * INCR key
 * 如果 key 不存在 → 创建 key，值初始化为 1
 * key 存在 → 值 +1
 * 原子命令：**INCR 本身是原子操作**，多并发请求不会出现竞态条件。
 *
 * `EXPIRE key seconds`：给 key 设置过期时间
 * `Math.ceil(windowMs / 1000)`：把毫秒转成向上取整的秒数，因为 Redis EXPIRE 的单位是秒。
 * 目的：窗口过期之后，Redis 自动删除这个限流 key，避免堆积大量历史窗口 key 占用内存。
 *
 * `INCR` 和 `EXPIRE` 是两条独立命令，打包在 pipeline 只是减少网络 RTT，**不是原子事务！**
 * 如果执行 INCR 成功，但是 EXPIRE 失败（Redis 异常），这个 key 会永久存在，不会过期，计数永远不清零。
 * 解决办法：使用 Lua 脚本，把两条命令放到 Redis 单条原子脚本执行。
 */
async function recordGlobalRateLimit({
  windowMs,
  keyPrefix = "rate_limit",
}: Pick<RateLimitConfig, "windowMs" | "keyPrefix">): Promise<void> {
  const now = Date.now();
  // 计算当前时间槽的起始毫秒时间戳
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${keyPrefix}:${windowStart}`;

  try {
    const pipeline = redis.pipeline();
    // 键不存在时自动从 1 开始累加，键存在时数值加 1
    pipeline.incr(key);
    // 设置过期时间为窗口秒数，确保窗口过后 Redis 自动清理内存
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Redis pipeline execution returned null or undefined");
    }
  } catch (error) {
    console.error("Failed to record rate limit in Redis:", error);
    throw error;
  }
}

/**
 * 非破坏性检查当前请求是否允许执行
 *
 * 仅读取当前计数值，不产生写入副作用；若超限，生成带有自动休眠逻辑的 retry 闭包
 */
async function checkGlobalRateLimit({
  maxRequests,
  windowMs,
  keyPrefix = "rate_limit",
  maxRetries = 3,
}: RateLimitConfig): Promise<RateLimitResult> {
  // 对齐到当前时间槽的起始毫秒时间戳
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${keyPrefix}:${windowStart}`;

  try {
    const currentCount = await redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    const allowed = count < maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const resetTime = windowStart + windowMs;

    let retryCount = 0;

    const retry = async (): Promise<boolean> => {
      if (!allowed) {
        const waitTime = resetTime - Date.now();
        if (waitTime > 0) {
          await setTimeout(waitTime);
        }

        // 等待完毕后，重新检查限流状态
        const retryResult = await checkGlobalRateLimit({
          maxRequests,
          windowMs,
          keyPrefix,
          maxRetries,
        });

        if (!retryResult.allowed) {
          // 检查是否已经耗尽最大重试次数
          if (retryCount >= maxRetries) {
            return false;
          }
          retryCount++;
          // 递归进入下一轮等待
          return await retryResult.retry();
        }
        return true;
      }

      return true;
    };

    return {
      allowed,
      remaining,
      resetTime,
      totalHits: count,
      retry,
    };
  } catch (error) {
    console.error(
      "Rate limit check failed, executing fail-open policy:",
      error,
    );
    // 故障放行兜底（Fail-Open）：Redis 挂掉时不能阻断用户业务
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: windowStart + windowMs,
      totalHits: 0,
      retry: async () => true,
    };
  }
}

/**
 * 如何使用？
 * // ⭐️ 3. 第二道防线：系统级大模型全局即时频控检查（Redis 跨进程共享）
 *const rateLimitCheck = await checkGlobalRateLimit(globalRateLimitConfig);
 *if (!rateLimitCheck.allowed) {
 *  console.log("Global LLM rate limit exceeded, waiting for window reset...");
 *  // 触发平滑休眠等待，直到窗口重置后自动重试
 *  const isAllowedAfterRetry = await rateLimitCheck.retry();
 *  if (!isAllowedAfterRetry) {
 *    // 若经过 3 次重试依然无法获取配额，最终返回 429
 *    return new Response(
 *      JSON.stringify({
 *        error:
 *          "System is busy, global rate limit exceeded. Please try again later.",
 *      }),
 *      { status: 429, headers: { "Content-Type": "application/json" } },
 *    );
 *  }
 *}
 * ⭐️ 4. 确认获得配额后，原子记录本次调用
 * await recordGlobalRateLimit(globalRateLimitConfig);
 */
