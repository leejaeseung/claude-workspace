package com.ticketrush.notification.listener

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.notification.broadcaster.QueueEventBroadcaster
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.data.redis.connection.ReactiveSubscription
import org.springframework.data.redis.listener.PatternTopic
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer
import org.springframework.stereotype.Component

@Component
class QueuePositionListener(
    private val container: ReactiveRedisMessageListenerContainer,
    private val broadcaster: QueueEventBroadcaster,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostConstruct
    fun subscribe() {
        container.receive(PatternTopic("QUEUE_CHANNEL:*"))
            .map(ReactiveSubscription.PatternMessage<String, String, String>::getMessage)
            .subscribe(
                { payload -> route(payload) },
                { err -> log.error("Queue Pub/Sub error", err) },
            )
    }

    private fun route(payload: String) {
        try {
            val node = objectMapper.readTree(payload)
            val userId = node.get("userId").asText()
            val showId = node.get("showId").asLong()
            broadcaster.publish(userId, showId, payload)
        } catch (e: Exception) {
            log.warn("Failed to parse queue position payload: $payload", e)
        }
    }
}
