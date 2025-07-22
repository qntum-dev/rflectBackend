CREATE TABLE "chat_participants" (
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"is_admin" boolean DEFAULT false,
	CONSTRAINT "chat_participants_chat_id_user_id_pk" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "chats_public_id_unique";--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "chats_user_a_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "chats_user_b_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "unique_chat_pair";--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "type" text DEFAULT 'dm' NOT NULL;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_participant_user" ON "chat_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_participant_chat" ON "chat_participants" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "public_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "user_a_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "user_b_id";