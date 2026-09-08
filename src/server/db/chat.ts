/*
这是 Next.js 官方强烈建议的最佳实践。
在文件第一行加入 import "server-only";，
能防止未来有人在客户端组件（"use client"）中意外 import { getChats }，
构建时会直接提示拦截，避免服务端代码/数据库凭据被打包到前端。
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from ".";
import { chats, messages } from "./schema";
import type { ChatUIMessage } from "~/lib/types/ai-types";

/*
1. 获取用户的所有会话列表（供侧边栏使用）
 */
export const getChats = async (opts: { userId: string }) => {
  const { userId } = opts;
  return await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
  });
};

/*
2. 获取单个会话的完整历史（含排序后的 messages）
必须带上 userId 防止越权访问他人聊天（IDOR 漏洞）
 */
export const getChat = async (opts: { userId: string; chatId: string }) => {
  const { userId, chatId } = opts;

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.userId, userId), eq(chats.id, chatId)),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.order)], // 严格按照 order 升序排列
      },
    },
  });

  return chat ?? null;
};

/*
3. 创建或更新一个聊天
upsertChat：创建一个聊天，并带上它的全部消息。若该聊天不属于当前登录用户，应当失败。若聊天已存在，则删除所有已有消息并用新的替换；若聊天不存在，则用传入的 id 创建一个新聊天。
 */
export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  chatMessages: ChatUIMessage[];
}) => {
  // 原则：如果 Agent 在做数据库相关事情的时候，你必须检查 AI 写的权限验证操作是否正确
  const { userId, chatId, title, chatMessages } = opts;

  await db.transaction(async (tx) => {
    // 1. 检查聊天是否存在且属于当前登录用户
    const existingChat = await tx.query.chats.findFirst({
      where: eq(chats.id, chatId),
    });

    if (existingChat) {
      // 2a. 聊天存在但是不属于当前登录用户，抛出错误
      // 黑客可能会利用一个未登录用户 userId 构造一个 chatId 来访问其他用户的聊天，这会导致 IDOR 漏洞
      if (existingChat.userId !== userId) {
        // ✅ 模糊化错误信息，防止 ID 枚举攻击
        throw new Error("Chat not found");
      }

      // 更新已有聊天的更新时间和标题（无需单独在末尾 update）
      await tx
        .update(chats)
        .set({ title, updatedAt: new Date() })
        .where(eq(chats.id, chatId));

      // 删除旧消息，准备全量替换
      await tx.delete(messages).where(eq(messages.chatId, chatId));
    } else {
      // 2b. 不存在 → 创建新聊天
      await tx.insert(chats).values({ id: chatId, userId, title });
    }

    // 3. 批量插入新消息
    if (chatMessages.length > 0) {
      // 插入新消息
      await tx.insert(messages).values(
        chatMessages.map((msg, index) => ({
          id: msg.id,
          chatId,
          role: msg.role,
          parts: msg.parts,
          order: index,
        })),
      );
    }

    // 4. 这里可以减少一次多余的数据库写操作（updatedAt 逻辑微调）
    // await tx
    //   .update(chats)
    //   .set({ updatedAt: new Date() })
    //   .where(eq(chats.id, chatId));
  });
};
