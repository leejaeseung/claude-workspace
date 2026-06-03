package com.ticketrush.seat

import arrow.core.left
import arrow.core.right
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.seat.SeatLock
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import com.ticketrush.seat.service.SeatLockService
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.core.ReactiveValueOperations
import org.springframework.http.HttpStatus
import reactor.core.publisher.Mono
import java.time.Duration
import java.time.Instant

/**
 * SeatController 단위 테스트 — W5 k6 부하 테스트 대상 엔드포인트 검증
 * Redis Lua(/lock), SELECT FOR UPDATE(/lock-db), GET /seats 캐시 경로를 커버한다.
 */
class SeatControllerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val lockService: SeatLockService = mock()
        val eventPublisher: SeatEventPublisher = mock()
        val seatRepository: SeatRepository = mock()
        @Suppress("UNCHECKED_CAST")
        val valueOps: ReactiveValueOperations<String, String> = mock()
        @Suppress("UNCHECKED_CAST")
        val redisTemplate: ReactiveRedisTemplate<String, String> = mock<ReactiveRedisTemplate<String, String>>().also {
            whenever(it.opsForValue()).thenReturn(valueOps)
        }
        val controller: SeatController = SeatController(lockService, eventPublisher, seatRepository, redisTemplate, mapper)
    }

    fun seatLock(seatId: Long = 1L, userId: String = "u1") = SeatLock(
        seatId = seatId,
        userId = userId,
        lockedAt = Instant.now(),
        expiresAt = Instant.now().plusSeconds(300),
    )

    val lockReq = SeatController.LockRequest(userId = "u1", showId = 1L)

    describe("POST /seats/{seatId}/lock — Redis Lua 경로") {

        it("잠금 성공 — 200 OK와 LockResponse를 반환하고 SSE 이벤트를 발행한다") {
            val d = buildDeps()
            whenever(d.lockService.acquire(eq(1L), eq(10L), eq("u1")))
                .thenReturn(Mono.just(seatLock(10L).right()))

            val response = d.controller.lock(10L, lockReq).block()!!

            response.statusCode shouldBe HttpStatus.OK
            verify(d.eventPublisher).publishSeatLocked(10L, 1L)
        }

        it("이미 점유된 좌석 — 409 CONFLICT를 반환하고 SSE 이벤트를 발행하지 않는다") {
            val d = buildDeps()
            whenever(d.lockService.acquire(eq(1L), eq(10L), eq("u1")))
                .thenReturn(Mono.just(DomainError.SeatAlreadyLocked(10L).left()))

            val response = d.controller.lock(10L, lockReq).block()!!

            response.statusCode shouldBe HttpStatus.CONFLICT
            verify(d.eventPublisher, never()).publishSeatLocked(any(), any())
        }
    }

    describe("POST /seats/{seatId}/lock-db — SELECT FOR UPDATE 경로 (G1 갈등 비교 대상)") {

        it("잠금 성공 — 200 OK와 LockResponse를 반환하고 SSE 이벤트를 발행한다") {
            val d = buildDeps()
            whenever(d.lockService.acquireWithDbLock(eq(10L), eq("u1")))
                .thenReturn(Mono.just(seatLock(10L).right()))

            val response = d.controller.lockWithDb(10L, lockReq).block()!!

            response.statusCode shouldBe HttpStatus.OK
            verify(d.eventPublisher).publishSeatLocked(10L, 1L)
        }

        it("이미 LOCKED인 좌석 — 409 CONFLICT를 반환한다") {
            val d = buildDeps()
            whenever(d.lockService.acquireWithDbLock(eq(10L), eq("u1")))
                .thenReturn(Mono.just(DomainError.SeatAlreadyLocked(10L).left()))

            val response = d.controller.lockWithDb(10L, lockReq).block()!!

            response.statusCode shouldBe HttpStatus.CONFLICT
        }

        it("존재하지 않는 좌석 — 409 CONFLICT(SeatNotFound)를 반환한다") {
            val d = buildDeps()
            whenever(d.lockService.acquireWithDbLock(eq(999L), eq("u1")))
                .thenReturn(Mono.just(DomainError.SeatNotFound(999L).left()))

            val response = d.controller.lockWithDb(999L, lockReq).block()!!

            response.statusCode shouldBe HttpStatus.CONFLICT
        }
    }

    describe("DELETE /seats/{seatId}/lock — 락 해제") {

        it("락 해제 성공 — 204 No Content와 SSE 이벤트를 발행한다") {
            val d = buildDeps()
            whenever(d.lockService.release(eq(1L), eq(10L), eq("u1"))).thenReturn(Mono.just(true))

            val response = d.controller.unlock(10L, "u1", 1L).block()!!

            response.statusCode shouldBe HttpStatus.NO_CONTENT
            verify(d.eventPublisher).publishSeatReleased(10L, 1L)
        }

        it("락이 없거나 소유자 불일치 — 404 Not Found를 반환한다") {
            val d = buildDeps()
            whenever(d.lockService.release(any(), any(), any())).thenReturn(Mono.just(false))

            val response = d.controller.unlock(10L, "u1", 1L).block()!!

            response.statusCode shouldBe HttpStatus.NOT_FOUND
        }
    }

    describe("GET /seats — 좌석 목록 (Redis 캐시 TTL 1s, ADR-008)") {

        it("캐시 미스 — DB를 조회하고 Redis에 1초 TTL로 저장한다") {
            val d = buildDeps()
            val seats = listOf(
                SeatEntity(id = 1L, showId = 1L, seatNumber = "A1", status = SeatEntity.SeatStatus.AVAILABLE),
                SeatEntity(id = 2L, showId = 1L, seatNumber = "A2", status = SeatEntity.SeatStatus.LOCKED),
            )
            whenever(d.valueOps.get(any<String>())).thenReturn(Mono.empty())
            whenever(d.seatRepository.findByShowId(1L)).thenReturn(seats)
            whenever(d.valueOps.set(any(), any(), any<Duration>())).thenReturn(Mono.just(true))

            val response = d.controller.listByShow(1L).block()!!

            response.statusCode shouldBe HttpStatus.OK
            val body = response.body!!
            body.size shouldBe 2
            body[0].seatId shouldBe 1L
            body[1].status shouldBe "LOCKED"
            verify(d.valueOps).set(eq("seat-list:1"), any(), eq(Duration.ofSeconds(1)))
        }

        it("캐시 히트 — DB 조회 없이 Redis 값을 반환한다") {
            val d = buildDeps()
            val cached = """[{"seatId":1,"seatNumber":"A1","status":"AVAILABLE"}]"""
            whenever(d.valueOps.get(eq("seat-list:1"))).thenReturn(Mono.just(cached))

            val response = d.controller.listByShow(1L).block()!!

            response.statusCode shouldBe HttpStatus.OK
            response.body!!.size shouldBe 1
            verify(d.seatRepository, never()).findByShowId(any())
        }
    }
})
