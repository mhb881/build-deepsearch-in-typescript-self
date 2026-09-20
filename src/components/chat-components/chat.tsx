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
import { StickToBottom } from "use-stick-to-bottom";

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
          // 流结束后，正式将 Next.js 路由同步为 /${newChatId}
          // 会卸载旧页面组件，挂载新页面，不会保留旧页面的 state
          router.replace(`/${newChatId}`, {
            scroll: false,
          });
        }
        router.refresh(); // 向服务器发起请求，重新获取数据、重新渲染服务端组件 RSC
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
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {/* 消息滚动区域：撑满全宽，滚动条紧贴屏幕最右侧 */}
        <StickToBottom
          className={cn(
            // 基础布局与自适应高度约束
            "flex min-h-0 w-full flex-1 flex-col overflow-auto",
            // 核心样式穿透：利用 [&>div]: 选择器给库内部生成的真实滚动节点添加自定义细窄滚动条
            "[&>div]:scrollbar-thin [&>div]:scrollbar-thumb-gray-300 [&>div]:scrollbar-track-gray-100 hover:[&>div]:scrollbar-thumb-gray-400",
            "dark:[&>div]:scrollbar-thumb-gray-600 dark:[&>div]:scrollbar-track-gray-800 dark:hover:[&>div]:scrollbar-thumb-gray-500",
          )}
          resize="smooth" // 高度膨胀时平滑跟随
          initial="instant" // 首屏挂载时平滑贴底
        >
          {/* 内容容器：承载真正的消息 DOM */}
          <StickToBottom.Content
            className="flex min-h-full flex-col"
            role="log"
            aria-label="Chat messages"
          >
            {messages.length === 0 ? (
              /* ⭐️ 空状态：真正的垂直水平绝对居中 */
              <div className="flex h-full flex-1 items-center justify-center p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  发送消息开始对话...
                </p>
              </div>
            ) : (
              /* ⭐️ 内容限宽居中区域：排版优雅规范 */
              <div className="mx-auto w-full max-w-[65ch] space-y-4 p-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    userName={userName}
                  />
                ))}

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
            )}
          </StickToBottom.Content>
        </StickToBottom>

        {/* 输入区域：固定在最底部不被压缩 */}
        <div className="shrink-0 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
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
                className={cn(
                  // 尺寸与排版
                  "flex-1 rounded p-2",
                  // 浅色 / 深色背景与边框
                  "border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800",
                  // 文本与占位符
                  "text-gray-800 placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-400",
                  // 焦点与可用态反馈
                  "focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none",
                  // 禁用态
                  "disabled:opacity-50",
                )}
              />

              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className={cn(
                    // 尺寸与排版
                    "cursor-pointer rounded-lg p-3 text-white",
                    // 基础配色与 Hover
                    "bg-gray-800 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700",
                    // 焦点状态
                    "focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none",
                    // 禁用状态
                    "disabled:opacity-50 disabled:hover:bg-gray-700 dark:disabled:hover:bg-gray-600",
                  )}
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={cn(
                    // 尺寸与排版
                    "cursor-pointer rounded-lg p-3 text-white",
                    // 基础配色与 Hover
                    "bg-gray-800 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700",
                    // 焦点状态
                    "focus:border-gray-500 focus:ring-2 focus:ring-blue-400 focus:outline-none",
                    // 禁用状态（含禁用光标）
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-gray-700 dark:disabled:hover:bg-gray-600",
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              )}
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
