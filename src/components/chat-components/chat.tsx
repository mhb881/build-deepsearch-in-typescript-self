// src/components/chat-components/chat.tsx
"use client";

import { useRef, useState } from "react";
import { ChatMessage } from "~/components/chat-components/chat-message";
import { SignInModal } from "~/components/auth/sign-in-modal";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Square } from "lucide-react";
import { cn } from "~/lib/utils/utils";
import type { ChatUIMessage } from "~/lib/types/ai-types";
import { useRouter } from "next/navigation";
import { useChatContext } from "~/components/chat-components/context/chat-context";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
  chatId: string | undefined;
  initialMessages?: ChatUIMessage[];
}

export const ChatPage = ({
  userName,
  isAuthenticated,
  chatId,
  initialMessages = [],
}: ChatProps) => {
  const router = useRouter();
  const { handleCreatedChat: onChatCreated } = useChatContext(); // ⭐️ 直接取 context 方法
  const [createdChatId, setCreatedChatId] = useState<string | undefined>(
    undefined,
  );
  const createdChatIdRef = useRef<string | undefined>(undefined);
  // ⭐️ 派生状态：优先使用服务端 prop，若无则使用本轮创建的 ID
  const activeChatId = chatId ?? createdChatId ?? undefined;

  const { messages, sendMessage, status, error, stop } = useChat<ChatUIMessage>(
    {
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: {
          chatId: activeChatId, // 每次请求将当前已知的 chatId 带给后端
        },
      }),
      // The onData callback is essential for handling streaming data, especially transient parts
      // ⭐️ 监听服务端通过 transient: true 下发的数据流事件
      onData: (dataPart) => {
        // Handle all data parts as they arrive (including transient parts)
        // console.log("Received data part:", dataPart);
        // Handle different data part types
        if (dataPart.type === "data-chat-created") {
          const newChatId = dataPart.data.chatId;
          const title = dataPart.data.title ?? "新对话";

          setCreatedChatId(newChatId); // 立即更新 state，确保下一次发消息携带此 ID

          createdChatIdRef.current = newChatId; // 同时更新 ref，确保下一次发消息携带此 ID

          // replaceState 保证页面不重新挂载、SSE 连接不中断
          // ⭐️ URL 优雅升级：变成 /${newChatId}
          window.history.replaceState(null, "", `/${newChatId}`);

          // 通过 callback 直接通知父组件更新 Sidebar，其实是通知 Context
          // 纯内存操作，不触发服务端刷新，0ms 响应，绝不打断流！
          onChatCreated({
            id: newChatId,
            title,
          });
        }
      },
      // ⭐️ 核心补充：当 AI 生成彻底结束时触发
      onFinish: () => {
        // 如果本轮是新建会话，此时流已结束，安全地让 Next.js Router 正式切换
        const newChatId = createdChatIdRef.current;
        if (newChatId) {
          // 重构：流结束后，正式将 Next.js 路由同步为 /${newChatId}
          router.replace(`/${newChatId}`, {
            scroll: false,
          });
        }
        router.refresh();
      },
      onError: (error) => {
        console.error("AI stream error:", error);
        // 1. 关键：清空 ref！防止残留 chatId 污染下一次对话
        createdChatIdRef.current = undefined;

        // 2. 可选：给用户弹窗/提示，展示错误信息
        // toast.error(`生成失败：${err.message}`);

        // 3. 可选：如果你在客户端维护消息列表，可以追加一条系统错误消息
        // setMessages(prev => [...prev, { role: 'system', content: 'AI 生成失败，请重试。' }]);
      },
    },
  );

  const [input, setInput] = useState("");
  const [showSignModal, setShowSignModal] = useState(false);

  const isLoading = status === "submitted" || status === "streaming";

  const handleFormSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setShowSignModal(true);
      return;
    }

    if (input.trim()) {
      await sendMessage({ text: input });
      setInput("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <>
      <div className="flex flex-1 flex-col">
        {/* 消息区域 */}
        <div
          className="mx-auto w-full max-w-[65ch] flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overflow-y-auto p-4 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 dark:hover:scrollbar-thumb-gray-500"
          role="log"
          aria-label="Chat messages"
        >
          {messages.length === 0 && (
            <div className="mt-[50%] text-center text-gray-500 dark:text-gray-400">
              发送消息开始对话...
            </div>
          )}
          {messages.map((message) => {
            return (
              <ChatMessage
                key={message.id}
                message={message}
                userName={userName}
              />
            );
          })}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI 正在准备响应...
            </div>
          )}

          {status === "streaming" && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              AI 正在生成...
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-500">
              请求失败：{error.message}
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <form
            onSubmit={handleFormSubmit}
            className="mx-auto max-w-[65ch] p-4"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Say something..."
                disabled={isLoading}
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-300 bg-white p-2 text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400"
              />

              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="cursor-pointer rounded-lg bg-gray-800 p-3 text-white hover:bg-gray-700 focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-50 disabled:hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={cn(
                    "bg-gray-800 dark:bg-gray-600",
                    "cursor-pointer rounded-lg p-3 text-white hover:bg-gray-700 focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-gray-700 dark:disabled:hover:bg-gray-600",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              )}
              {/* <button
                type="submit"
                // onClick={isLoading ? stop : handleFormSubmit}
                disabled={false}
                className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-50 disabled:hover:bg-gray-700"
              >
                {isLoading ? <Square className="size-4" /> : "Send"}
              </button> */}
            </div>
          </form>
        </div>
      </div>

      {/* 登录弹窗区域 */}
      <SignInModal
        isOpen={showSignModal}
        onClose={() => setShowSignModal(false)}
      />
    </>
  );
};
