package com.ticketrush.notification.broadcaster

import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.core.publisher.Sinks
import java.util.concurrent.ConcurrentHashMap

@Component
class QueueEventBroadcaster {
    // key: "$userId@$showId"
    private val sinks = ConcurrentHashMap<String, Sinks.Many<String>>()

    fun subscribe(userId: String, showId: Long): Flux<String> {
        val key = sinkKey(userId, showId)
        val sink = sinks.computeIfAbsent(key) {
            Sinks.many().multicast().onBackpressureBuffer(64, false)
        }
        return sink.asFlux()
            .doFinally {
                sinks.compute(key) { _, existing ->
                    if (existing === sink) null else existing
                }
            }
    }

    fun publish(userId: String, showId: Long, payload: String) {
        sinks[sinkKey(userId, showId)]?.tryEmitNext(payload)
    }

    private fun sinkKey(userId: String, showId: Long) = "$userId@$showId"
}
