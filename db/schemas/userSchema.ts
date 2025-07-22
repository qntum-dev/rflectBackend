import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";



export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").unique().notNull(),
  name: text("name").notNull(),
  about: text("about"),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  profileImgUrl: text("profile_img_url"), // <-- added optional profile_img_url

}, (table) => [
  index("username_idx").on(table.username),
  index("email_idx").on(table.email),
  index("is_verified_idx").on(table.isVerified),
]);


export type User = typeof users.$inferSelect;

