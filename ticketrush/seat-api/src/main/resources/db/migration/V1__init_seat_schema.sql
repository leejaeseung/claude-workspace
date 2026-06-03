CREATE TABLE seats (
    id BIGSERIAL PRIMARY KEY,
    show_id BIGINT NOT NULL,
    seat_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    order_id BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (show_id, seat_number)
);

CREATE INDEX idx_seats_show_id ON seats(show_id);
CREATE INDEX idx_seats_order_id ON seats(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_seats_status ON seats(show_id, status);
