package com.ticketrush.seat.favorites

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class FavoriteService(private val repo: FavoriteRepository) {

    @Transactional
    fun add(userId: String, showId: Long, seatNumber: String): AddResult {
        if (repo.existsByUserIdAndShowIdAndSeatNumber(userId, showId, seatNumber)) {
            return AddResult.AlreadyExists
        }
        return try {
            val saved = repo.save(FavoriteEntity(userId = userId, showId = showId, seatNumber = seatNumber))
            AddResult.Created(saved.id)
        } catch (e: DataIntegrityViolationException) {
            // 동시 요청으로 인한 unique constraint 위반 → 멱등 처리
            AddResult.AlreadyExists
        }
    }

    @Transactional(readOnly = true)
    fun findByUser(userId: String): List<FavoriteEntity> =
        repo.findAllByUserId(userId)

    @Transactional
    fun remove(id: Long, userId: String): RemoveResult {
        val entity = repo.findById(id).orElse(null) ?: return RemoveResult.NotFound
        if (entity.userId != userId) return RemoveResult.Forbidden
        repo.delete(entity)
        return RemoveResult.Deleted
    }

    sealed interface AddResult {
        data class Created(val id: Long) : AddResult
        data object AlreadyExists : AddResult
    }

    sealed interface RemoveResult {
        data object Deleted : RemoveResult
        data object NotFound : RemoveResult
        data object Forbidden : RemoveResult
    }
}
