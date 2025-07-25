CREATE TYPE "public"."tokenTypes" AS ENUM('email_otp', 'forgot_otp');--> statement-breakpoint
CREATE TYPE "public"."attachment_type" AS ENUM('image', 'video', 'audio', 'document');--> statement-breakpoint
CREATE TABLE "userOTPs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"tokenTypes" "tokenTypes" DEFAULT 'email_otp' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"is_admin" boolean DEFAULT false,
	CONSTRAINT "chat_participants_chat_id_user_id_pk" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text DEFAULT 'dm' NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"about" text,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"profile_img_url" text,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" "attachment_type" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"thumbnail_url" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "thumbnail_required" CHECK (
        "message_attachments"."type" NOT IN ('image', 'video') OR "message_attachments"."thumbnail_url" IS NOT NULL
    ),
	CONSTRAINT "duration_required" CHECK (
        "message_attachments"."type" NOT IN ('audio', 'video') OR "message_attachments"."duration" IS NOT NULL
    ),
	CONSTRAINT "size_positive" CHECK ("message_attachments"."size" > 0),
	CONSTRAINT "duration_positive" CHECK (
        "message_attachments"."duration" IS NULL OR "message_attachments"."duration" > 0
    ),
	CONSTRAINT "size_type_limit" CHECK (
        ("message_attachments"."type" = 'image' AND "message_attachments"."size" <= 10485760) OR -- 10 MB
        ("message_attachments"."type" = 'video' AND "message_attachments"."size" <= 104857600) OR -- 100 MB
        ("message_attachments"."type" = 'audio' AND "message_attachments"."size" <= 52428800) OR -- 50 MB
        ("message_attachments"."type" = 'document' AND "message_attachments"."size" <= 20971520) -- 20 MB
    )
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text,
	"reply_to_message_id" uuid,
	"forwarded_from_message_id" uuid,
	"is_deleted" boolean DEFAULT false,
	"is_edited" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userOTPs" ADD CONSTRAINT "userOTPs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwarded_from_message_id_messages_id_fk" FOREIGN KEY ("forwarded_from_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_token_idx" ON "userOTPs" USING btree ("user_id","token");--> statement-breakpoint
CREATE INDEX "token_expiry_idx" ON "userOTPs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "user_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_participant_user" ON "chat_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_participant_chat" ON "chat_participants" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "chat_created_idx" ON "chats" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "is_verified_idx" ON "users" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "attachment_message_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_attachment_url_per_message" ON "message_attachments" USING btree ("message_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "msg_cursor_idx" ON "messages" USING btree ("created_at");