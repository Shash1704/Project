-- Derived view: message embeddings for semantic search (rebuildable from MySQL).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS message_embeddings (
  message_id       CHAR(26)    PRIMARY KEY,
  conversation_id  CHAR(26)    NOT NULL,
  sender_id        CHAR(26)    NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  body             TEXT        NOT NULL,
  model            TEXT        NOT NULL,
  embedding        vector(1024) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_embeddings_conv ON message_embeddings (conversation_id);
CREATE INDEX IF NOT EXISTS ix_embeddings_hnsw ON message_embeddings USING hnsw (embedding vector_cosine_ops);
