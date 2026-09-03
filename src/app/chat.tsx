"use client";

import { useState } from "react";
import { ChatMessage } from "~/components/chat-components/chat-message";
import { SignInModal } from "~/components/auth/sign-in-modal";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Square } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ChatUIMessage } from "~/lib/types/ai-types";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
}

const messages = [
  {
    id: "1",
    content: "Hello, how are you?",
    role: "user",
  },
];

export const ChatPage = ({ userName, isAuthenticated }: ChatProps) => {
  const { messages, sendMessage, status, error, stop } = useChat<ChatUIMessage>(
    {
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
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
