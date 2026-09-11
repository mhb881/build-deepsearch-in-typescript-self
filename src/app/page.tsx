// 这个是 server component
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { auth } from "~/server/auth";
import { headers } from "next/headers";
import { ChatPage } from "./chat.tsx";
import { AuthButton } from "../components/auth/auth-button.tsx";
import { getChat, getChats } from "~/server/db/chat.ts";
import { mapDBMessagesToUIMessages } from "~/lib/utils/ai-utils.ts";
import { cn } from "~/lib/utils/utils.ts";
import ChatLayout from "~/components/chat-components/chat-layout.tsx";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string }>;
}) {
  // On the server:  使用 auth 而不是 authClient
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userName = session?.user?.name ?? "Guest";
  const isAuthenticated = !!session?.user; // 第一个 ! 将值取反并转为布尔值
  const userId = session?.user?.id;
  const { chatId } = await searchParams;
  const curChatId = chatId;

  /**
   * 由于我们使用的是 Next.js 服务器端渲染，所以获取数据的操作都要在 server component 中进行
   * 然后通过 props 传递给 client component
   */

  // 动态从数据库拉取当前登录用户的会话列表
  const chats = isAuthenticated && userId ? await getChats({ userId }) : [];

  // 若 URL 带有指定会话 ID，从数据库提取该聊天的完整历史
  const activeChat =
    isAuthenticated && userId && curChatId
      ? await getChat({ userId, chatId: curChatId })
      : null;

  // 将数据库消息实体映射对齐为 AI SDK 7 的 ChatUIMessage 规范
  const initialMessages = activeChat
    ? mapDBMessagesToUIMessages(activeChat.messages)
    : [];

  return (
    <ChatLayout
      initialChats={chats}
      userName={userName}
      isAuthenticated={isAuthenticated}
      userImage={session?.user?.image}
      chatId={curChatId}
      initialMessages={initialMessages}
    />
  );
}
