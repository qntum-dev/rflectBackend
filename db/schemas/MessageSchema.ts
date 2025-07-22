import {
    pgTable,
    uuid,
    text,
    boolean,
    timestamp,
    index,
    uniqueIndex,
    AnyPgColumn,
    check,
    pgEnum,
    bigint,
    integer
} from "drizzle-orm/pg-core";
import { chats } from "./chatSchema";
import { users } from "./userSchema";
import { sql } from "drizzle-orm";
const messageTypeEnum = pgEnum('message_type', ['text', 'system', 'call']);

// Messages Table
export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id').notNull().references(() => chats.id),
    senderId: uuid('sender_id').notNull().references(() => users.id),
    content: text('content'),
    replyToMessageId: uuid('reply_to_message_id').references((): AnyPgColumn => messages.id),
    forwardedFromMessageId: uuid('forwarded_from_message_id').references((): AnyPgColumn => messages.id),
    isDeleted: boolean('is_deleted').default(false),
    isEdited: boolean('is_edited').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex('msg_cursor_idx').on(table.createdAt)
]);

// Attachment type enum
export const attachmentTypeEnum = pgEnum('attachment_type', ['image', 'video', 'audio', 'document']);

// Message Attachments Table
export const messageAttachments = pgTable('message_attachments', {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id').notNull().references(() => messages.id),
    url: text('url').notNull(),
    type: attachmentTypeEnum('type').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer("size").notNull(),
    thumbnailUrl: text('thumbnail_url'), // optional (for preview)
    duration: integer('duration'), // optional (for video/audio)
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    // Indexes
    index('attachment_message_idx').on(table.messageId),
    uniqueIndex('unique_attachment_url_per_message').on(table.messageId, table.url),

    // Checks
    check('thumbnail_required', sql`
        ${table.type} NOT IN ('image', 'video') OR ${table.thumbnailUrl} IS NOT NULL
    `),
    check('duration_required', sql`
        ${table.type} NOT IN ('audio', 'video') OR ${table.duration} IS NOT NULL
    `),
    check('size_positive', sql`${table.size} > 0`),
    check('duration_positive', sql`
        ${table.duration} IS NULL OR ${table.duration} > 0
    `),
    check('size_type_limit', sql`
        (${table.type} = 'image' AND ${table.size} <= 10485760) OR -- 10 MB
        (${table.type} = 'video' AND ${table.size} <= 104857600) OR -- 100 MB
        (${table.type} = 'audio' AND ${table.size} <= 52428800) OR -- 50 MB
        (${table.type} = 'document' AND ${table.size} <= 20971520) -- 20 MB
    `),
]);
