// src/server/auth/config.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verificationTokens,
    },
  }),
  socialProviders: {
    discord: {
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
    },
  },
  // 可选：将 session 数据与 NextAuth 保持兼容
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 天
  },
  fetchOptions: {
    timeout: 1000 * 30, // 30 秒
  },
});
