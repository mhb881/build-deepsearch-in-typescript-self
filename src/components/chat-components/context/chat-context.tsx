// src/components/chat-components/context/chat-context.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SimpleChat } from "~/lib/types/types";

/**
 * 构建一个 React Context 的标准流程， 4 步闭环：
 * 1. 定义类型契约 (Type Definition)：明确上下文对外暴露的状态（State）与动作（Actions）。
 * 2. 创建内部上下文 (Context Creation)：初始化默认值为 null，保持模块内部私有（不 export）。
 * 3. 封装 Provider 组件 (Provider Component)：管理状态生命周期、纯渲染期派生计算，并通过 useMemo 优化下发。
 * 4. 暴露安全 Hook (Custom Hook)：封装 useContext 并实施 Fail-Fast（快速失败） 校验，将类型安全收窄为非空。
 */

// ─── 1. 契约定义 ───
interface ChatContextType {
  chats: SimpleChat[];
  handleCreatedChat: (chat: SimpleChat) => void;
}

// ─── 2. 内部实例（私有，不 export，强制通过自定义 Hook 访问） ───
const ChatContext = createContext<ChatContextType | null>(null);

// ─── 3. 容器封装 ───
interface ChatContextProviderProps {
  initialChats: SimpleChat[];
  children: ReactNode;
}

export const ChatContextProvider = ({
  initialChats,
  children,
}: ChatContextProviderProps) => {
  // 1.仅维护客户端“即时新建”的单条会话，避免在 state 中复制整份列表
  const [createdChat, setCreatedChat] = useState<SimpleChat | null>(null);
  // 2. 纯渲染期派生：检查服务端推来的列表是否已同步包含该会话
  const serverHasChat = initialChats.some(
    (chat) => chat.id === createdChat?.id,
  );
  // 3. 纯渲染期派生数据：若服务端尚未包含，则本地乐观合并；若已包含，则自动平滑退化为服务端数据
  const chats = useMemo(() => {
    return createdChat && !serverHasChat
      ? [createdChat, ...initialChats]
      : initialChats;
  }, [createdChat, serverHasChat, initialChats]);

  // 4. 稳定的回调引用
  const handleCreatedChat = useCallback((newChat: SimpleChat) => {
    setCreatedChat(newChat);
  }, []);

  // 5. 缓存 Context Value，避免 Provider 所在组件非相关更新引发下游消费者无谓重渲染
  const value = useMemo(
    () => ({
      chats,
      handleCreatedChat,
    }),
    [chats, handleCreatedChat],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// ─── 4. 消费封装（Fail-Fast 自定义 Hook） ───
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error(
      "useChatContext must be used within a ChatContextProvider (Fail-Fast)",
    );
  }
  return context;
};
