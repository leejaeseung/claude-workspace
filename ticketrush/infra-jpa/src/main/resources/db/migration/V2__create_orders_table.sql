CREATE TABLE orders (
    id           BIGSERIAL PRIMARY KEY,
    user_id      VARCHAR(100) NOT NULL,
    seat_id      BIGINT       NOT NULL,
    show_id      BIGINT       NOT NULL,
    total_amount BIGINT       NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_seat_id ON orders (seat_id);
CREATE INDEX idx_orders_status  ON orders (status);
