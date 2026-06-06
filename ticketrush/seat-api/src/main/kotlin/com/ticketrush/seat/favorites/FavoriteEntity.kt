package com.ticketrush.seat.favorites

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "seat_favorites",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "show_id", "seat_number"])]
)
class FavoriteEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: String,

    @Column(name = "show_id", nullable = false)
    val showId: Long,

    @Column(name = "seat_number", nullable = false)
    val seatNumber: String,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),
)
