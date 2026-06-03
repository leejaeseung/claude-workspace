package com.ticketrush.seat.service

import arrow.core.Either
import arrow.core.left
import arrow.core.right
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.seat.SeatLock
import com.ticketrush.infra.redis.RedisKeyspace
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import reactor.core.publisher.Mono
import reactor.core.scheduler.Schedulers
import java.time.Duration
import java.time.Instant

@Service
class SeatLockService(
    private val redisTemplate: ReactiveRedisTemplate<String, String>,
    private val seatRepository: SeatRepository,
    private val transactionTemplate: TransactionTemplate,
) {
    companion object {
        val LOCK_TTL: Duration = Duration.ofMinutes(5)

        // Lua 스크립트: 원자적 SETNX + EXPIRE
        // KEYS[1] = lock key, ARGV[1] = userId, ARGV[2] = TTL(초)
        // 반환: 1(성공), 0(이미 점유)
        private val ACQUIRE_SCRIPT = RedisScript.of(
            """
            if redis.call('EXISTS', KEYS[1]) == 0 then
                redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
                return 1
            else
                return 0
            end
            """.trimIndent(),
            Long::class.java,
        )

        private val RELEASE_SCRIPT = RedisScript.of(
            """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
            """.trimIndent(),
            Long::class.java,
        )
    }

    fun acquire(showId: Long, seatId: Long, userId: String): Mono<Either<DomainError, SeatLock>> {
        val key = RedisKeyspace.seatLock(showId, seatId)
        val ttlSeconds = LOCK_TTL.seconds.toString()
        val now = Instant.now()

        return redisTemplate.execute(ACQUIRE_SCRIPT, listOf(key), listOf(userId, ttlSeconds))
            .next()
            .map { result ->
                if (result == 1L) {
                    SeatLock(
                        seatId = seatId,
                        userId = userId,
                        lockedAt = now,
                        expiresAt = now.plus(LOCK_TTL),
                    ).right()
                } else {
                    DomainError.SeatAlreadyLocked(seatId).left()
                }
            }
            .defaultIfEmpty(DomainError.SeatAlreadyLocked(seatId).left())
    }

    fun release(showId: Long, seatId: Long, userId: String): Mono<Boolean> {
        val key = RedisKeyspace.seatLock(showId, seatId)
        return redisTemplate.execute(RELEASE_SCRIPT, listOf(key), listOf(userId))
            .next()
            .map { it == 1L }
            .defaultIfEmpty(false)
    }

    fun getOwner(showId: Long, seatId: Long): Mono<String?> {
        val key = RedisKeyspace.seatLock(showId, seatId)
        return redisTemplate.opsForValue().get(key)
    }

    /**
     * PoC: PostgreSQL SELECT FOR UPDATE 기반 비관적 락 획득.
     *
     * WebFlux 환경에서 블로킹 JDBC 호출을 이벤트 루프 밖으로 내보내기 위해
     * Schedulers.boundedElastic() 위에서 실행한다.
     * TransactionTemplate을 직접 사용하는 이유: @Transactional 프록시는 Mono 반환 시
     * 구독 전에 커밋되어 락 보장이 불가능하다.
     */
    fun acquireWithDbLock(seatId: Long, userId: String): Mono<Either<DomainError, SeatLock>> =
        Mono.fromCallable {
            transactionTemplate.execute {
                val seat = seatRepository.findByIdForUpdate(seatId)
                    ?: return@execute DomainError.SeatNotFound(seatId).left()

                if (seat.status != SeatEntity.SeatStatus.AVAILABLE) {
                    return@execute DomainError.SeatAlreadyLocked(seatId).left()
                }

                val now = Instant.now()
                seat.status = SeatEntity.SeatStatus.LOCKED
                seatRepository.save(seat)

                SeatLock(
                    seatId = seatId,
                    userId = userId,
                    lockedAt = now,
                    expiresAt = now.plus(LOCK_TTL),
                ).right()
            } ?: DomainError.SeatNotFound(seatId).left()
        }.subscribeOn(Schedulers.boundedElastic())
}
