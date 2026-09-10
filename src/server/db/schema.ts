import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  text,
  timestamp,
  varchar,
  boolean,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `ai-app-template_${name}`);

// 用 Better Auth 的 createAuthSchema 或手动定义
export const user = createTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true })
    .notNull()
    .defaultNow(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const account = createTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      precision: 6,
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      precision: 6,
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 为 userId 列创建索引，用于快速查询
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const session = createTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 为 userId 列创建索引，用于快速查询
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const verificationTokens = createTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 为 identifier 列创建索引，用于快速查询
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const requestLog = createTable(
  "request_log",
  {
    id: serial("id").primaryKey(), // 创建一个int4整数列，实现插入时自增赋值
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 为 userId 列与 createdAt 列创建索引，用于快速查询
  (table) => [
    index("request_log_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

// 聊天表
export const chats = createTable(
  "chat",
  {
    // id 由客户端生成（UUID v4），因为前端在 AI 回复前就要把它写进 URL
    id: text("id").primaryKey(),
    // 会话所属用户，FK 到 user.id
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // 即使没有写 mode: "date"，Drizzle 也会默认将字段映射为 Date 类型。
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
    // 即使没有写 mode: "date"，Drizzle 也会默认将字段映射为 Date 类型。
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // ⭐️ 核心索引：侧边栏“我的聊天列表”快速查询与时间倒序排序
  (table) => [
    index("chat_chatId_updatedAt_idx").on(table.id, table.updatedAt.desc()),
  ],
);

// 消息表
export const messages = createTable(
  "message",
  {
    // id 由客户端生成（UUID v4），因为前端在 AI 回复前就要把它写进 URL
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }), // 级联删除，不留孤儿
    // role: ["user", "assistant"]
    role: text("role").notNull(),
    // 在现代 PostgreSQL 开发中，jsonb 几乎总是更优且官方推荐的选择。
    parts: jsonb("parts").notNull(),
    order: integer("order").notNull(),
    // 即使没有写 mode: "date"，Drizzle 也会默认将字段映射为 Date 类型。
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  // ⭐️ 核心复合索引：覆盖按会话时序拉取历史消息 + 游标分页 + 外键级联删除
  (table) => [
    index("message_chatId_order_idx").on(table.chatId, table.order.asc()),
  ],
);

/**
 * 关系定义
 *
 * 分散定义，每个表单独调用 relations()
 * 本质：多对一和一对多是同一件事从不同角度看：
 */

export const requestLogRelations = relations(requestLog, ({ one }) => ({
  // requestLog → user : 一个请求日志对应一个用户，但一个用户可以有多个请求日志
  user: one(user, { fields: [requestLog.userId], references: [user.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  // user -> account: 一个用户可以有多个OAtuh账号
  accounts: many(account),
  // user -> requestLog: 一个用户可以有多个请求日志
  requestLogs: many(requestLog),
  // user -> chat: 一个用户可以有多个聊天
  chats: many(chats),
}));

export const accountRelations = relations(account, ({ one }) => ({
  // account -> user: 一个账号对应一个用户，一个用户可以有多个账号
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  // session -> user: 一个会话对应一个用户
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  // chats -> user: 一个聊天对应一个用户
  user: one(user, {
    fields: [chats.userId],
    references: [user.id],
  }),
  // chats -> message: 一个聊天可以有多个消息
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  // messages -> chat: 一个消息对应一个聊天
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

export declare namespace DB {
  export type User = InferSelectModel<typeof user>;
  export type NewUser = InferInsertModel<typeof user>;

  export type Account = InferSelectModel<typeof account>;
  export type NewAccount = InferInsertModel<typeof account>;

  export type Session = InferSelectModel<typeof session>;
  export type NewSession = InferInsertModel<typeof session>;

  export type VerificationToken = InferSelectModel<typeof verificationTokens>;
  export type NewVerificationToken = InferInsertModel<
    typeof verificationTokens
  >;

  export type RequestLog = InferSelectModel<typeof requestLog>;
  export type NewRequestLog = InferInsertModel<typeof requestLog>;

  export type Chat = InferSelectModel<typeof chats>;
  export type NewChat = InferInsertModel<typeof chats>;

  export type Message = InferSelectModel<typeof messages>;
  export type NewMessage = InferInsertModel<typeof messages>;
}
