package com.ticketrush.notification.broadcaster

import com.ticketrush.event.SeatChangedEvent
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.core.publisher.Sinks
import java.util.concurrent.ConcurrentHashMap

@Component
class SeatEventBroadcaster {

    // showId → Sink (멀티캐스트)
    private val sinks = ConcurrentHashMap<Long, Sinks.Many<SeatChangedEvent>>()

    fun publish(event: SeatChangedEvent) {
        sinks[event.showId]?.tryEmitNext(event)
    }

    fun subscribe(showId: Long): Flux<SeatChangedEvent> {
        val sink = sinks.computeIfAbsent(showId) {
            Sinks.many().multicast().onBackpressureBuffer(1024)
        }
        return sink.asFlux()
            .doFinally {
                sinks.compute(showId) { _, existing ->
                    if (existing == null || existing.currentSubscriberCount() == 0) null else existing
                }
            }
    }
}
