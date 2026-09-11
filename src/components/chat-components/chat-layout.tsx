"use client";
import { ChatPage } from "~/app/chat";
import type { ChatUIMessage } from "~/lib/types/ai-types";
import { useState } from "react";
import Sidebar from "../sidebar";
import type { SimpleChat } from "~/lib/types/types";

interface ChatLayoutProps {
  initialChats: SimpleChat[];
  userName: string;
  isAuthenticated: boolean;
  userImage?: string | null;
  chatId: string | undefined;
  initialMessages: ChatUIMessage[];
}

function ChatLayout({
  initialChats,
  userName,
  isAuthenticated,
  userImage,
  chatId,
  initialMessages,
}: ChatLayoutProps) {
  // ⭐️ 1. 内部只记录“本轮前端刚刚新建的那一个 Chat”
  const [createdChat, setCreatedChat] = useState<SimpleChat | null>(null);
  // ⭐️ 2. 完全在渲染期派生数据
  // 如果服务端返回的数据里已经包含了该 chat，就无需再拼接本地的
  const serverHasChat = initialChats.some(
    (chat) => chat.id === createdChat?.id,
  );
  const chats =
    createdChat && !serverHasChat
      ? [createdChat, ...initialChats]
      : initialChats;

  // ⭐️ 3. activeId 也是纯派生值，不需要 useState 也不需要 useEffect
  const currentActiveId = chatId ?? createdChat?.id;
  const handleChatCreated = (newChat: SimpleChat) => {
    setCreatedChat(newChat); // 只记录新建的这一个
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* ─── Sidebar 区域 ─── */}
      <Sidebar
        chats={chats}
        activeId={currentActiveId}
        isAuthenticated={isAuthenticated}
        userImage={userImage}
      />
      {/* ─── 聊天主体 ─── */}
      <ChatPage
        key={chatId ?? "new"}
        userName={userName}
        isAuthenticated={isAuthenticated}
        chatId={chatId}
        initialMessages={initialMessages}
        onChatCreated={handleChatCreated} // ⭐️ 传入回调函数
      />
    </div>
  );
}

export default ChatLayout;
