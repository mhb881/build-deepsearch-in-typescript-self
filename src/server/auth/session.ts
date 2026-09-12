// src/server/auth/session.ts
import { cache } from "react";
import { auth } from "./index";
import { headers } from "next/headers";

/**
 * ⭐️ React 19 请求级记忆化获取 Session
 * 在同一次 HTTP 请求生命周期中，无论调用多少次，真正的鉴权与 DB 查询只执行 1 次！
 */
export const getSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
});
