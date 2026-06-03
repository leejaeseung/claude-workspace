package com.ticketrush.seat

import arrow.core.Either
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ticketrush.domain.error.DomainError
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import com.ticketrush.seat.service.SeatLockService
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import reactor.core.publisher.Mono
import reactor.core.scheduler.Schedulers
import java.time.Duration

@RestController
@RequestMapping("/seats")
class SeatController(
    private val seatLockService: SeatLockService,
    private val seatEventPublisher: SeatEventPublisher,
    private val seatRepository: SeatRepository,
    private val redisTemplate: ReactiveRedisTemplate<String, String>,
    private val objectMapper: ObjectMapper,
) {
    data class LockRequest(val userId: String, val showId: Long)
    data class LockResponse(val seatId: Long, val userId: String, val expiresAt: String)
    data class ErrorResponse(val type: String, val detail: String)
    data class SeatStatusResponse(
        val seatId: Long,
        val seatNumber: String,
        val status: String,
    )

    @PostMapping("/{seatId}/lock")
    fun lock(
        @PathVariable seatId: Long,
        @RequestBody request: LockRequest,
    ): Mono<ResponseEntity<Any>> =
        seatLockService.acquire(request.showId, seatId, request.userId)
            .map { result ->
                when (result) {
                    is Either.Right -> {
                        // 잠금 성공 → SSE 브로드캐스트
                        seatEventPublisher.publishSeatLocked(seatId, request.showId)
                        ResponseEntity.ok<Any>(
                            LockResponse(
                                seatId = seatId,
                                userId = request.userId,
                                expiresAt = result.value.expiresAt.toString(),
                            )
                        )
                    }
                    is Either.Left -> ResponseEntity.status(HttpStatus.CONFLICT).body<Any>(
                        ErrorResponse(type = "seat-already-locked", detail = result.value.message)
                    )
                }
            }

    @DeleteMapping("/{seatId}/lock")
    fun unlock(
        @PathVariable seatId: Long,
        @RequestParam userId: String,
        @RequestParam showId: Long,
    ): Mono<ResponseEntity<Unit>> =
        seatLockService.release(showId, seatId, userId)
            .map { released ->
                if (released) {
                    seatEventPublisher.publishSeatReleased(seatId, showId)
                    ResponseEntity.noContent<Unit>().build()
                } else {
                    ResponseEntity.notFound<Unit>().build()
                }
            }

    /**
     * PoC 전용: PostgreSQL SELECT FOR UPDATE 기반 좌석 락.
     * Redis Lua(기존 /lock)와 동일한 요청 형식으로 k6 부하 비교 테스트에 사용한다.
     */
    @PostMapping("/{seatId}/lock-db")
    fun lockWithDb(
        @PathVariable seatId: Long,
        @RequestBody request: LockRequest,
    ): Mono<ResponseEntity<Any>> =
        seatLockService.acquireWithDbLock(seatId, request.userId)
            .map { result ->
                when (result) {
                    is Either.Right -> {
                        seatEventPublisher.publishSeatLocked(seatId, request.showId)
                        ResponseEntity.ok<Any>(
                            LockResponse(
                                seatId = seatId,
                                userId = request.userId,
                                expiresAt = result.value.expiresAt.toString(),
                            )
                        )
                    }
                    is Either.Left -> ResponseEntity.status(HttpStatus.CONFLICT).body<Any>(
                        ErrorResponse(type = "seat-already-locked", detail = result.value.message)
                    )
                }
            }

    /**
     * 전체 좌석 스냅샷 조회. Redis 캐시 TTL 1s 적용 (ADR-008).
     * 클라이언트는 이 엔드포인트로 초기 상태를 받은 뒤 SSE(/seats/stream)를 구독해야 한다.
     * 대량 동시 접속 시 동일 showId에 대한 DB 쿼리를 1초 동안 1회로 압축한다.
     */
    @GetMapping
    fun listByShow(@RequestParam showId: Long): Mono<ResponseEntity<List<SeatStatusResponse>>> {
        val cacheKey = "seat-list:$showId"
        return redisTemplate.opsForValue().get(cacheKey)
            .map<List<SeatStatusResponse>> { json ->
                objectMapper.readValue(json)
            }
            .switchIfEmpty(
                Mono.fromCallable {
                    seatRepository.findByShowId(showId).map { seat ->
                        SeatStatusResponse(
                            seatId = seat.id,
                            seatNumber = seat.seatNumber,
                            status = seat.status.name,
                        )
                    }
                }
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap { seats ->
                    redisTemplate.opsForValue()
                        .set(cacheKey, objectMapper.writeValueAsString(seats), Duration.ofSeconds(1))
                        .thenReturn(seats)
                }
            )
            .map { ResponseEntity.ok(it) }
    }
}
