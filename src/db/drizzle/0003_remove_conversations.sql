-- Remove conversations table and simplify to single conversation
-- Drop foreign key constraint and conversation_id column from messages
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_conversation_id_conversations_id_fk";
DROP INDEX IF EXISTS "messages_conversation_id_idx";
DROP INDEX IF EXISTS "messages_sequence_idx";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "conversation_id";

-- Create new index for sequence number only
CREATE INDEX IF NOT EXISTS "messages_sequence_idx" ON "messages" ("sequence_number");

-- Drop conversations table
DROP TABLE IF EXISTS "conversations";
