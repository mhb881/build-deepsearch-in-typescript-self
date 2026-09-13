// src/app/(chat)/layout.tsx
import type { ReactNode } from "react";
import Sidebar from "~/components/chat-components/chat-sidebar";
import { ChatContextProvider } from "~/components/chat-components/context/chat-context";
import { getSession } from "~/server/auth/session";
import { getChats } from "~/server/db/chat";

async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const isAuthenticated = !!session?.user; // 第一个取反是转换为 boolean 类型

  const userId = session?.user.id;

  /**
   * 由于我们使用的是 Next.js 服务器端渲染，所以获取数据的操作都要在 server component 中进行
   * 然后通过 props 传递给 client component
   */

  // ⭐️ 只在 Layout 里查一次当前用户的聊天列表
  // 动态从数据库拉取当前登录用户的会话列表
  const chats = isAuthenticated && userId ? await getChats({ userId }) : [];

  return (
    <ChatContextProvider initialChats={chats}>
      <div className="flex h-screen bg-white dark:bg-gray-950">
        {/* ⭐️ Sidebar 驻留在布局里：切换会话时不卸载、不重新挂载 */}
        <Sidebar
          isAuthenticated={isAuthenticated}
          userImage={session?.user?.image}
        />
        {/* 右侧动态页面内容 */}
        <main className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
          {children}
        </main>
      </div>
    </ChatContextProvider>
  );
}

export default ChatLayout;
