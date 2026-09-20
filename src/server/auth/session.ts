// src/server/auth/session.ts
import { cache } from "react";
import { auth } from "./index";
import { headers } from "next/headers";

/**
 * ⭐️ React 19 请求级记忆化获取 Session
 * 在同一次 HTTP 请求生命周期中，无论调用多少次，真正的鉴权与 DB 查询只执行 1 次！
 *
 * `headers()` 是 Next.js 的服务端函数
 * 获取当前请求的 HTTP 请求头（Cookie、Authorization 等），传给 auth 的会话接口，用来读取登录凭证。
 *
 * 只能在 **Next.js 服务端环境** 使用：
 * Server Component
 * Route Handler
 * Server Action
 * 不能在客户端组件（'use client'）里直接调用。
 *
 * Server Component 没有 req 对象，必须调用Next的headers()函数取当前请求头 (是一个异步函数，需要await)。
 */
export const getSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
});
