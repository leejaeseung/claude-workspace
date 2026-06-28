CREATE TABLE outbox (
    id             BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(50)  NOT NULL,
    aggregate_id   VARCHAR(100) NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        TEXT         NOT NULL,
    published      BOOLEAN      NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_published ON outbox (published) WHERE published = false;
CREATE INDEX idx_outbox_aggregate ON outbox (aggregate_type, aggregate_id);
