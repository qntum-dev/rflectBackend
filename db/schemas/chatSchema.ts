import { pgTable, uuid, timestamp, index, text, boolean, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./userSchema";

export const chats = pgTable("chats", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").default("dm").notNull(),
    title: text("title"), // optional, for group chats
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
    index("chat_created_idx").on(table.createdAt)
]);



export const chatParticipants = pgTable("chat_participants", {
    chatId: uuid("chat_id").references(() => chats.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
    isAdmin: boolean("is_admin").default(false),
}, (table) => [
    primaryKey({ columns: [table.chatId, table.userId] }),
    index("idx_participant_user").on(table.userId),
    index("idx_participant_chat").on(table.chatId),
]);