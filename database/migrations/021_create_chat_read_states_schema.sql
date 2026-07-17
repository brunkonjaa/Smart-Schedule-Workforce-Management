CREATE TABLE IF NOT EXISTS chat_read_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
