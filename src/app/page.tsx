// 这个是 server component
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { auth } from "~/server/auth";
import { headers } from "next/headers";
import { ChatPage } from "./chat.tsx";
import { AuthButton } from "../components/auth/auth-button.tsx";

const chats = [
  {
    id: "1",
    title: "My First Chat",
  },
];

const activeChatId = "1";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string; id?: string }>;
}) {
  // On the server:  使用 auth 而不是 authClient
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userName = session?.user?.name ?? "Guest";
  const isAuthenticated = !!session?.user; // 第一个 ! 将值取反并转为布尔值

  const { chatId, id } = await searchParams;
  const curChatId = chatId ?? id;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Your Chats
            </h2>
            {isAuthenticated && (
              <Link
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                title="New Chat"
              >
                <PlusIcon className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        <div className="-mt-1 flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 space-y-2 overflow-y-auto px-4 pt-1 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div key={chat.id} className="flex items-center gap-2">
                <Link
                  href={`/?chatId=${chat.id}`}
                  className={`flex-1 rounded-lg p-3 text-left text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none dark:text-gray-300 ${
                    chat.id === activeChatId
                      ? "bg-gray-200 dark:bg-gray-700"
                      : "dark:hover:bg-gray-750 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {chat.title}
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {isAuthenticated
                ? "No chats yet. Start a new conversation!"
                : "Sign in to start chatting"}
            </p>
          )}
        </div>

        <div className="p-4">
          <AuthButton
            isAuthenticated={isAuthenticated}
            userImage={session?.user?.image}
          />
        </div>
      </div>

      <ChatPage
        userName={userName}
        isAuthenticated={isAuthenticated}
        chatId={curChatId}
      />
    </div>
  );
}
