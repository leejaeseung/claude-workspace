CREATE TABLE seat_favorites (
    id          BIGSERIAL PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL,
    show_id     BIGINT       NOT NULL,
    seat_number VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_show_seat UNIQUE (user_id, show_id, seat_number)
);

CREATE INDEX idx_favorites_user_id ON seat_favorites (user_id);
CREATE INDEX idx_favorites_show_id  ON seat_favorites (show_id);
