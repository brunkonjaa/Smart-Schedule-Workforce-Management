CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('WORKPLACE', 'DIRECT')),
  direct_key VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_conversations_direct_key_check CHECK (
    (kind = 'WORKPLACE' AND direct_key IS NULL)
    OR (kind = 'DIRECT' AND direct_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_workplace_unique_idx
  ON chat_conversations (kind)
  WHERE kind = 'WORKPLACE';

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_direct_key_unique_idx
  ON chat_conversations (direct_key)
  WHERE kind = 'DIRECT';

CREATE TABLE IF NOT EXISTS chat_conversation_participants (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

INSERT INTO chat_conversations (kind)
VALUES ('WORKPLACE')
ON CONFLICT DO NOTHING;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;

UPDATE chat_messages
SET conversation_id = (
  SELECT id FROM chat_conversations WHERE kind = 'WORKPLACE'
)
WHERE conversation_id IS NULL;

ALTER TABLE chat_messages
  ALTER COLUMN conversation_id SET NOT NULL;

INSERT INTO chat_conversation_participants (conversation_id, user_id)
SELECT conversations.id, users.id
FROM chat_conversations AS conversations
CROSS JOIN users
WHERE conversations.kind = 'WORKPLACE'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_at_idx
  ON chat_messages (conversation_id, created_at DESC, id DESC);

ALTER TABLE chat_read_states
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;

UPDATE chat_read_states
SET conversation_id = (
  SELECT id FROM chat_conversations WHERE kind = 'WORKPLACE'
)
WHERE conversation_id IS NULL;

ALTER TABLE chat_read_states
  DROP CONSTRAINT IF EXISTS chat_read_states_pkey;

ALTER TABLE chat_read_states
  ALTER COLUMN conversation_id SET NOT NULL;

ALTER TABLE chat_read_states
  ADD PRIMARY KEY (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS chat_conversation_participants_user_idx
  ON chat_conversation_participants (user_id, conversation_id);
