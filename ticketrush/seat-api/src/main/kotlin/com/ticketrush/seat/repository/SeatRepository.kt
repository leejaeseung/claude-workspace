package com.ticketrush.seat.repository

import com.ticketrush.seat.entity.SeatEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query

interface SeatRepository : JpaRepository<SeatEntity, Long> {
    @Query("SELECT s FROM SeatEntity s WHERE s.showId = :showId ORDER BY s.seatNumber")
    fun findByShowId(showId: Long): List<SeatEntity>

    fun findByOrderId(orderId: Long): SeatEntity?

    /**
     * SELECT ... FOR UPDATE: DB 비관적 락을 사용해 동시 좌석 점유를 직렬화한다.
     * 호출부는 반드시 트랜잭션 컨텍스트 내에서 호출해야 한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SeatEntity s WHERE s.id = :id")
    fun findByIdForUpdate(id: Long): SeatEntity?
}
