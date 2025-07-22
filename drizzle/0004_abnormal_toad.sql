DROP INDEX "msg_cursor_idx";--> statement-breakpoint
CREATE INDEX "msg_idx" ON "messages" USING btree ("chat_id");