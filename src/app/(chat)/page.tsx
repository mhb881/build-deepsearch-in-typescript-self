// src/app/(chat)/page.tsx
import { getSession } from "~/server/auth/session";
import { ChatPage } from "../../components/chat-components/chat";

export default async function NewChatPage({}) {
  // On the server:  使用 auth 而不是 authClient
  const session = await getSession();
  const userName = session?.user?.name ?? "Guest";
  const isAuthenticated = !!session?.user; // 第一个 ! 将值取反并转为布尔值

  // ⭐️ 访问 / 时，纯粹是一个空白对话
  return (
    <ChatPage
      userName={userName}
      isAuthenticated={isAuthenticated}
      chatId={undefined}
      initialMessages={[]}
    />
  );
}
