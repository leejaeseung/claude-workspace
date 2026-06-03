package com.ticketrush.notification

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.notification.broadcaster.QueueEventBroadcaster
import com.ticketrush.notification.broadcaster.SeatEventBroadcaster
import org.springframework.http.MediaType
import org.springframework.http.codec.ServerSentEvent
import org.springframework.web.bind.annotation.*
import reactor.core.publisher.Flux
import java.time.Duration

@RestController
@RequestMapping("/sse")
class SseController(
    private val seatEventBroadcaster: SeatEventBroadcaster,
    private val queueEventBroadcaster: QueueEventBroadcaster,
    private val objectMapper: ObjectMapper,
) {
    private val heartbeat: Flux<ServerSentEvent<String>> =
        Flux.interval(Duration.ofSeconds(30))
            .map {
                ServerSentEvent.builder<String>()
                    .comment("heartbeat")
                    .build()
            }

    @GetMapping("/seats/{showId}", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun seatEvents(@PathVariable showId: Long): Flux<ServerSentEvent<String>> {
        val events = seatEventBroadcaster.subscribe(showId)
            .map { event ->
                ServerSentEvent.builder<String>()
                    .event("seat.changed")
                    .data(objectMapper.writeValueAsString(event))
                    .build()
            }
        return Flux.merge(events, heartbeat)
    }

    @GetMapping("/queue/{userId}", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun queueEvents(
        @PathVariable userId: String,
        @RequestParam showId: Long,
    ): Flux<ServerSentEvent<String>> {
        val events = queueEventBroadcaster.subscribe(userId, showId)
            .map { payload ->
                ServerSentEvent.builder<String>()
                    .event("queue.position")
                    .data(payload)
                    .build()
            }
        return Flux.merge(events, heartbeat)
    }
}
