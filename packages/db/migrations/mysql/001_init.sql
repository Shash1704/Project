-- Source of truth. Every table has a primary key (Aiven MySQL enforces sql_require_primary_key).
-- IDs are ULIDs (CHAR(26)): time-sortable, so "messages after id X" is a cheap range scan.

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(26)      NOT NULL,
  email         VARCHAR(254)  NOT NULL,
  name          VARCHAR(80)   NOT NULL,
  avatar_seed   VARCHAR(64)   NOT NULL,
  avatar_url    VARCHAR(512)  NULL,
  about         VARCHAR(160)  NULL,
  lang          VARCHAR(8)    NOT NULL DEFAULT 'en',
  is_demo       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at  DATETIME(3)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id               CHAR(26)     NOT NULL,
  kind             ENUM('direct','group') NOT NULL,
  title            VARCHAR(80)  NULL,
  avatar_url       VARCHAR(512) NULL,
  direct_key       VARCHAR(53)  NULL,
  created_by       CHAR(26)     NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_message_id  CHAR(26)     NULL,
  last_message_at  DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversations_direct (direct_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id       CHAR(26)    NOT NULL,
  user_id               CHAR(26)    NOT NULL,
  role                  ENUM('admin','member') NOT NULL DEFAULT 'member',
  joined_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  pinned                TINYINT(1)  NOT NULL DEFAULT 0,
  muted                 TINYINT(1)  NOT NULL DEFAULT 0,
  ai_enabled            TINYINT(1)  NOT NULL DEFAULT 0,
  last_delivered_message_id CHAR(26) NULL,
  last_read_message_id  CHAR(26)    NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY ix_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS media (
  id           CHAR(26)     NOT NULL,
  uploader_id  CHAR(26)     NOT NULL,
  kind         ENUM('image','file','voice') NOT NULL,
  url          VARCHAR(1024) NOT NULL,
  mime         VARCHAR(127) NOT NULL,
  bytes        INT UNSIGNED NOT NULL,
  name         VARCHAR(255) NULL,
  width        INT UNSIGNED NULL,
  height       INT UNSIGNED NULL,
  duration_ms  INT UNSIGNED NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS messages (
  id               CHAR(26)    NOT NULL,
  conversation_id  CHAR(26)    NOT NULL,
  sender_id        CHAR(26)    NOT NULL,
  kind             ENUM('text','image','file','voice','system') NOT NULL DEFAULT 'text',
  body             TEXT        NULL,
  reply_to_id      CHAR(26)    NULL,
  media_id         CHAR(26)    NULL,
  created_at       DATETIME(3) NOT NULL,
  edited_at        DATETIME(3) NULL,
  deleted_at       DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY ix_messages_conv_created (conversation_id, created_at),
  KEY ix_messages_conv_id (conversation_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id    CHAR(26)    NOT NULL,
  user_id       CHAR(26)    NOT NULL,
  delivered_at  DATETIME(3) NULL,
  read_at       DATETIME(3) NULL,
  PRIMARY KEY (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reactions (
  message_id  CHAR(26)    NOT NULL,
  user_id     CHAR(26)    NOT NULL,
  emoji       VARCHAR(16) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS moments (
  id               CHAR(26)     NOT NULL,
  conversation_id  CHAR(26)     NOT NULL,
  message_id       CHAR(26)     NOT NULL,
  kind             ENUM('date','link','place','task') NOT NULL,
  text             VARCHAR(280) NOT NULL,
  value            VARCHAR(1024) NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_moments_conv (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
