package com.ticketrush.queue

import com.ticketrush.queue.service.QueueService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import reactor.core.publisher.Mono

@RestController
@RequestMapping("/queue")
class QueueController(
    private val queueService: QueueService,
) {
    data class EnterRequest(val userId: String, val showId: Long)
    data class EnterResponse(val position: Long, val estimatedWaitSeconds: Long)
    data class StatusResponse(val position: Long, val estimatedWaitSeconds: Long)
    data class AdmitResponse(val token: String, val expiresAt: String)

    @PostMapping("/enter")
    fun enter(@RequestBody request: EnterRequest): Mono<ResponseEntity<EnterResponse>> =
        queueService.enter(request.userId, request.showId)
            .map { entry ->
                ResponseEntity.accepted().body(
                    EnterResponse(
                        position = entry.position,
                        estimatedWaitSeconds = entry.estimatedWaitSeconds,
                    )
                )
            }

    @GetMapping("/status/{userId}")
    fun status(
        @PathVariable userId: String,
        @RequestParam showId: Long,
    ): Mono<ResponseEntity<StatusResponse>> =
        queueService.getPosition(userId, showId)
            .map { entry ->
                ResponseEntity.ok(
                    StatusResponse(
                        position = entry.position,
                        estimatedWaitSeconds = entry.estimatedWaitSeconds,
                    )
                )
            }

    @PostMapping("/admit/{userId}")
    fun admit(
        @PathVariable userId: String,
        @RequestParam showId: Long,
    ): Mono<ResponseEntity<AdmitResponse>> =
        queueService.admit(userId, showId)
            .map { token ->
                ResponseEntity.ok(
                    AdmitResponse(
                        token = token.token,
                        expiresAt = token.expiresAt.toString(),
                    )
                )
            }
}
