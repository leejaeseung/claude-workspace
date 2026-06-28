CREATE TABLE payments (
    id               BIGSERIAL PRIMARY KEY,
    order_id         BIGINT       NOT NULL,
    amount           BIGINT       NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    idempotency_key  VARCHAR(100) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payments_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX idx_payments_order_id ON payments (order_id);
