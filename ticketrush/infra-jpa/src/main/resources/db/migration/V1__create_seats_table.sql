CREATE TABLE seats (
    id          BIGSERIAL PRIMARY KEY,
    show_id     BIGINT       NOT NULL,
    seat_number VARCHAR(20)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
    version     BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_show_seat UNIQUE (show_id, seat_number)
);

CREATE INDEX idx_seats_show_id ON seats (show_id);
CREATE INDEX idx_seats_status ON seats (status);
