import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  serial,
  pgTable,
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
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// 分散定义，每个表单独调用 relations()
export const userRelations = relations(user, ({ many }) => ({
  // user 有多个 account
  accounts: many(account),
}));
export const accountRelations = relations(account, ({ one }) => ({
  // account 属于一个 user
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  // session 属于一个 user
  user: one(user, { fields: [session.userId], references: [user.id] }),
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
}
