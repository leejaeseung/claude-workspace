package com.ticketrush.seat

import arrow.core.Either
import com.ticketrush.domain.error.DomainError
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import com.ticketrush.seat.service.SeatLockService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import reactor.core.publisher.Mono
import reactor.core.scheduler.Schedulers

@RestController
@RequestMapping("/seats")
class SeatController(
    private val seatLockService: SeatLockService,
    private val seatEventPublisher: SeatEventPublisher,
    private val seatRepository: SeatRepository,
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

    @GetMapping
    fun listByShow(@RequestParam showId: Long): Mono<ResponseEntity<List<SeatStatusResponse>>> =
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
        .map { ResponseEntity.ok(it) }
}
