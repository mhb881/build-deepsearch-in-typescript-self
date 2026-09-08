import { db } from "~/server/db";
import { requestLog, user as userTable } from "~/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

/**
 * 每日最大请求次数限制
 * 可根据业务需求调整：免费用户 10-20 次，付费用户 50-100 次
 */
const MAX_REQUESTS_PER_DAY = 20; // 测试

/**
 * 检查用户的速率限制状态
 *
 * @param userId - 用户的唯一标识符（来自认证 session）
 * @returns 包含是否允许请求和是否为管理员的布尔值
 *
 * 执行流程：
 * 1. 查询用户是否为管理员 → 管理员直接放行（无限制）
 * 2. 统计该用户今天（00:00:00 之后）的请求数量
 * 3. 比较请求数与上限，返回是否允许
 *
 * 使用场景：
 * - 在 API 路由中调用 AI 前检查
 * - 防止免费用户滥用付费服务（如 Serper API）
 * - 保护后端资源不被恶意消耗
 */
export async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; isAdmin: boolean }> {
  const [currentUser] = await db
    .select({ isAdmin: userTable.isAdmin })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (currentUser?.isAdmin) {
    return { allowed: true, isAdmin: true };
  }

  // 统计该用户今天（00:00:00 之后）的请求数量
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(requestLog)
    .where(
      and(eq(requestLog.userId, userId), gte(requestLog.createdAt, today)),
    );

  const count = result[0]?.count ?? 0;

  const allowed = Number(count) < MAX_REQUESTS_PER_DAY;
  return { allowed, isAdmin: false };
}

/**
 * 记录一次用户请求到数据库
 *
 * @param userId - 发起请求的用户 ID
 *
 * 设计说明：
 * - 每次成功的 API 调用都应该记录（在调用 AI 之前记录）
 * - 记录时间使用数据库默认的 now()，确保时区一致
 * - 不需要返回值，失败时让调用方处理错误
 *
 * 数据用途：
 * - 实时统计今日已用请求次数
 * - 分析用户行为模式（可选）
 * - 计费依据（如果按用量收费）
 */
export async function logRequest(userId: string) {
  await db.insert(requestLog).values({
    userId,
  });
}
