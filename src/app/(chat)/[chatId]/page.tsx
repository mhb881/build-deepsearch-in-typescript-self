// src/app/(chat)/[chatId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { ChatPage } from "~/components/chat-components/chat";
import { mapDBMessagesToUIMessages } from "~/lib/utils/ai-utils";
import { getSession } from "~/server/auth/session";
import { getChat } from "~/server/db/chat";

export default async function ExistingChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  // Next.js 15+ 中 params 是 Promise
  const session = await getSession();
  const { chatId } = await params;

  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id;

  if (!isAuthenticated || !userId) {
    return redirect("/");
  }

  // 若 URL 带有指定会话 ID，从数据库提取该聊天的完整历史
  const activeChat =
    isAuthenticated && userId && chatId
      ? await getChat({ userId, chatId })
      : null;

  if (!activeChat) {
    notFound(); // 不存在或无权访问直接 404
  }

  // 将数据库消息实体映射对齐为 AI SDK 7 的 ChatUIMessage 规范
  const initialMessages = activeChat
    ? mapDBMessagesToUIMessages(activeChat.messages)
    : [];

  return (
    <ChatPage
      key={chatId} // ⭐️ 切换不同历史对话时，自然重置消息状态
      userName={session.user.name ?? "User"}
      isAuthenticated={true}
      chatId={chatId}
      initialMessages={initialMessages}
    />
  );
}
