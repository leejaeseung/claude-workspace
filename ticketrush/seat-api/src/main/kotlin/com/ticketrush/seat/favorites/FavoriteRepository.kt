package com.ticketrush.seat.favorites

import org.springframework.data.jpa.repository.JpaRepository

interface FavoriteRepository : JpaRepository<FavoriteEntity, Long> {
    fun findAllByUserId(userId: String): List<FavoriteEntity>
    fun findByUserIdAndShowIdAndSeatNumber(userId: String, showId: Long, seatNumber: String): FavoriteEntity?
    fun existsByUserIdAndShowIdAndSeatNumber(userId: String, showId: Long, seatNumber: String): Boolean
}
