-- Migration: Add chat history tables
-- Created: 2024-12-08
-- Create enum for message roles
DO $$ BEGIN CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
EXCEPTION
WHEN duplicate_object THEN null;
END $$;
-- Create conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text DEFAULT 'default_user',
	"metadata" jsonb
);
-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"visualizations" jsonb,
	"suggestions" jsonb,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"token_count" integer,
	"metadata" jsonb
);
-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "conversations_created_at_idx" ON "conversations" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");
-- Create indexes for messages
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_sequence_idx" ON "messages" USING btree ("conversation_id", "sequence_number");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");