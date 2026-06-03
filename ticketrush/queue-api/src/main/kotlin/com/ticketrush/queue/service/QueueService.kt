package com.ticketrush.queue.service

import com.ticketrush.domain.queue.EntryToken
import com.ticketrush.domain.queue.QueueEntry
import com.ticketrush.infra.redis.RedisKeyspace
import com.ticketrush.queue.publisher.QueuePositionPublisher
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.stereotype.Service
import reactor.core.publisher.Mono
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Service
class QueueService(
    private val redisTemplate: ReactiveRedisTemplate<String, String>,
    private val queuePositionPublisher: QueuePositionPublisher,
) {
    companion object {
        private val ENTRY_TOKEN_TTL: Duration = Duration.ofMinutes(10)
        private const val ENTRY_RATE_PER_SECOND = 10L
    }

    fun enter(userId: String, showId: Long): Mono<QueueEntry> {
        val key = RedisKeyspace.queue(showId)
        val score = System.currentTimeMillis().toDouble()

        return redisTemplate.opsForZSet()
            .addIfAbsent(key, userId, score)
            .flatMap { redisTemplate.opsForZSet().rank(key, userId) }
            .flatMap { rank ->
                val position = (rank ?: 0L) + 1
                val waitSeconds = position / ENTRY_RATE_PER_SECOND
                // Pub/Sub으로 대기 순번 브로드캐스트
                queuePositionPublisher.publish(showId, userId, position, waitSeconds)
                    .thenReturn(QueueEntry(userId, showId, position, waitSeconds))
            }
    }

    fun getPosition(userId: String, showId: Long): Mono<QueueEntry> {
        val key = RedisKeyspace.queue(showId)
        return redisTemplate.opsForZSet().rank(key, userId)
            .map { rank ->
                val position = (rank ?: 0L) + 1
                QueueEntry(userId, showId, position, position / ENTRY_RATE_PER_SECOND)
            }
    }

    fun issueEntryToken(userId: String, showId: Long): Mono<EntryToken> {
        val tokenKey = RedisKeyspace.entryToken(userId, showId)
        val token = UUID.randomUUID().toString()
        val now = Instant.now()
        return redisTemplate.opsForValue()
            .set(tokenKey, token, ENTRY_TOKEN_TTL)
            .thenReturn(EntryToken(token, userId, showId, now, now.plus(ENTRY_TOKEN_TTL)))
    }

    fun validateToken(userId: String, showId: Long, token: String): Mono<Boolean> =
        redisTemplate.opsForValue()
            .get(RedisKeyspace.entryToken(userId, showId))
            .map { it == token }
            .defaultIfEmpty(false)

    // 토큰 발급 후 ZSet 제거 순서: 발급 실패 시 유저가 재시도 가능하도록 보장
    fun admit(userId: String, showId: Long): Mono<EntryToken> {
        val key = RedisKeyspace.queue(showId)
        return issueEntryToken(userId, showId)
            .flatMap { token ->
                redisTemplate.opsForZSet()
                    .remove(key, userId)
                    .thenReturn(token)
            }
    }
}
