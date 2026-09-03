import { env } from "~/env";
import Redis from "ioredis";

export const redis = new Redis(env.REDIS_URL);

const CACHE_EXPIRY_SECONDS = 60 * 60 * 6;
const CACHE_KEY_SEPARATOR = ":";

/**
 * 从参数中剥离不可序列化的运行时属性（如 AbortSignal），
 * 只保留可序列化的业务参数用于生成缓存键。
 */
function stripNonSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  // if (value instanceof AbortSignal) return undefined;
  if (Array.isArray(value)) return value.map(stripNonSerializable);
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    cleaned[k] = stripNonSerializable(v);
  }
  return cleaned;
}

/**
 * 缓存高阶函数：为任意异步函数添加 Redis 缓存能力
 *
 * 执行流程：
 * 1. 根据 keyPrefix + 业务参数序列化 生成唯一缓存键（自动排除 AbortSignal 等运行时对象）
 * 2. 查询 Redis 缓存，命中则直接反序列化返回
 * 3. 未命中则执行原始函数，将结果序列化存入 Redis（设置 6h 过期），然后返回
 */
// redis.ts — 增强版 cacheWithRedis
export const cacheWithRedis = <TFunc extends (...args: any[]) => Promise<any>>(
  keyPrefix: string,
  fn: TFunc,
  options?: {
    /** 自定义键生成函数，默认 JSON.stringify 全部参数 */
    keyFn?: (...args: Parameters<TFunc>) => string;
    /** 缓存过期秒数，默认 6 小时 */
    ttl?: number;
  },
): TFunc => {
  const ttl = options?.ttl ?? CACHE_EXPIRY_SECONDS;

  return (async (...args: Parameters<TFunc>) => {
    /*
    生成缓存键：前缀 + 分隔符 + 参数的 JSON 序列化，确保不同参数对应不同缓存
    例如调用 searchSerper({ q: "typescript", num: 10 }, undefined) 时，缓存键为：
    serper:["/search",{"method":"POST","body":"{\"q\":\"typescript\",\"num\":10}","signal":null}]
     */
    const key = options?.keyFn
      ? `${keyPrefix}:${options.keyFn(...args)}`
      : `${keyPrefix}:${JSON.stringify(args.map(stripNonSerializable))}`;
    console.log(key);

    const cachedResult = await redis.get(key);
    if (cachedResult !== null) {
      // 缓存命中：反序列化后直接返回，跳过原始函数调用
      console.log(`Cache hit for ${key}`);
      return JSON.parse(cachedResult);
    }

    // 缓存未命中：执行原始函数获取结果
    const result = await fn(...args);
    // 将结果序列化后存入 Redis，并设置过期时间（EX = 过期秒数）
    await redis.set(key, JSON.stringify(result), "EX", ttl);
    return result;
  }) as TFunc;
};
