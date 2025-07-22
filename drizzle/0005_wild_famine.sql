DROP INDEX "msg_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "msg_cursor_idx" ON "messages" USING btree ("created_at");