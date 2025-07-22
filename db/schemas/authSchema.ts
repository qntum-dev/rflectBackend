import { pgTable, uuid, text, timestamp, index, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./userSchema";

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  sessionToken: text("session_token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("session_token_idx").on(table.sessionToken),
]);


export const tokenTypeEnum = pgEnum("tokenTypes", ["email_otp", "forgot_otp"]);

export const userOTPs = pgTable("userOTPs", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  token: text("token").notNull(), // this is your OTP code

  tokenType: tokenTypeEnum("tokenTypes").default("email_otp").notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("user_token_idx").on(table.userId, table.token),
  index("token_expiry_idx").on(table.expiresAt),
]);

