ALTER TABLE outbox ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN published_at TIMESTAMP;
CREATE INDEX idx_outbox_retry ON outbox(published, retry_count) WHERE published = FALSE;
