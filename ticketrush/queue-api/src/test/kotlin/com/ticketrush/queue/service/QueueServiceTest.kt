package com.ticketrush.queue.service

import com.ticketrush.infra.redis.RedisKeyspace
import com.ticketrush.queue.publisher.QueuePositionPublisher
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.core.ReactiveValueOperations
import org.springframework.data.redis.core.ReactiveZSetOperations
import reactor.core.publisher.Mono
import java.time.Duration

class QueueServiceTest : DescribeSpec({

    fun buildDeps() = object {
        @Suppress("UNCHECKED_CAST")
        val zSetOps: ReactiveZSetOperations<String, String> = mock()
        @Suppress("UNCHECKED_CAST")
        val valueOps: ReactiveValueOperations<String, String> = mock()
        @Suppress("UNCHECKED_CAST")
        val redisTemplate: ReactiveRedisTemplate<String, String> = mock<ReactiveRedisTemplate<String, String>>().also {
            whenever(it.opsForZSet()).thenReturn(zSetOps)
            whenever(it.opsForValue()).thenReturn(valueOps)
        }
        val publisher: QueuePositionPublisher = mock()
        val service: QueueService = QueueService(redisTemplate, publisher)
    }

    describe("enter") {

        it("신규 사용자 — position=1, waitSeconds=0을 반환한다 (rank=0)") {
            val d = buildDeps()
            whenever(d.zSetOps.addIfAbsent(any(), eq("user-1"), any())).thenReturn(Mono.just(true))
            whenever(d.zSetOps.rank(any(), eq("user-1"))).thenReturn(Mono.just(0L))
            whenever(d.publisher.publish(any(), eq("user-1"), eq(1L), any())).thenReturn(Mono.just(1L))

            val result = d.service.enter("user-1", 1L).block()!!

            result.userId shouldBe "user-1"
            result.showId shouldBe 1L
            result.position shouldBe 1L  // rank 0 → position 1
            verify(d.publisher).publish(eq(1L), eq("user-1"), eq(1L), any())
        }

        it("10번째 사용자 — rank=9 → position=10, waitSeconds=1을 반환한다") {
            val d = buildDeps()
            whenever(d.zSetOps.addIfAbsent(any(), eq("user-10"), any())).thenReturn(Mono.just(true))
            whenever(d.zSetOps.rank(any(), eq("user-10"))).thenReturn(Mono.just(9L))
            whenever(d.publisher.publish(any(), eq("user-10"), eq(10L), eq(1L))).thenReturn(Mono.just(1L))

            val result = d.service.enter("user-10", 1L).block()!!

            result.position shouldBe 10L
            result.estimatedWaitSeconds shouldBe 1L  // 10 / 10 = 1
        }

        it("올바른 큐 키 형식(QUEUE:{showId})으로 Redis ZSet에 접근한다") {
            val d = buildDeps()
            whenever(d.zSetOps.addIfAbsent(any(), any(), any())).thenReturn(Mono.just(true))
            whenever(d.zSetOps.rank(any(), any())).thenReturn(Mono.just(0L))
            whenever(d.publisher.publish(any(), any(), any(), any())).thenReturn(Mono.just(1L))

            d.service.enter("u1", 42L).block()

            val expectedKey = RedisKeyspace.queue(42L)
            verify(d.zSetOps).addIfAbsent(eq(expectedKey), eq("u1"), any())
            verify(d.zSetOps).rank(eq(expectedKey), eq("u1"))
        }
    }

    describe("getPosition") {

        it("큐에 있는 사용자 — 현재 position을 반환한다") {
            val d = buildDeps()
            whenever(d.zSetOps.rank(any(), eq("user-5"))).thenReturn(Mono.just(4L))

            val result = d.service.getPosition("user-5", 1L).block()!!

            result.position shouldBe 5L  // rank 4 → position 5
        }

        it("큐에 없는 사용자(rank=null) — position=1을 반환한다 (defaultIfAbsent 처리)") {
            val d = buildDeps()
            whenever(d.zSetOps.rank(any(), eq("missing-user"))).thenReturn(Mono.empty())

            val result = d.service.getPosition("missing-user", 1L).block()!!

            result.position shouldBe 1L  // null rank → 0L + 1 = 1
        }
    }

    describe("admit") {

        it("토큰 발급 후 ZSet에서 사용자를 제거한다") {
            val d = buildDeps()
            val tokenKey = RedisKeyspace.entryToken("user-1", 1L)
            val queueKey = RedisKeyspace.queue(1L)

            whenever(d.valueOps.set(eq(tokenKey), any(), any<Duration>())).thenReturn(Mono.just(true))
            whenever(d.zSetOps.remove(eq(queueKey), eq("user-1"))).thenReturn(Mono.just(1L))

            val result = d.service.admit("user-1", 1L).block()!!

            result.userId shouldBe "user-1"
            result.showId shouldBe 1L
            result.token shouldNotBe null
            verify(d.zSetOps).remove(eq(queueKey), eq("user-1"))
        }
    }

    describe("validateToken") {

        it("저장된 토큰과 일치 — true를 반환한다") {
            val d = buildDeps()
            val key = RedisKeyspace.entryToken("user-1", 1L)
            whenever(d.valueOps.get(eq(key))).thenReturn(Mono.just("valid-token"))

            val result = d.service.validateToken("user-1", 1L, "valid-token").block()!!

            result shouldBe true
        }

        it("토큰 불일치 — false를 반환한다") {
            val d = buildDeps()
            val key = RedisKeyspace.entryToken("user-1", 1L)
            whenever(d.valueOps.get(eq(key))).thenReturn(Mono.just("stored-token"))

            val result = d.service.validateToken("user-1", 1L, "wrong-token").block()!!

            result shouldBe false
        }

        it("토큰이 없는(Redis empty) 경우 — false를 반환한다") {
            val d = buildDeps()
            val key = RedisKeyspace.entryToken("user-1", 1L)
            whenever(d.valueOps.get(eq(key))).thenReturn(Mono.empty())

            val result = d.service.validateToken("user-1", 1L, "any-token").block()!!

            result shouldBe false
        }
    }
})
