package com.ticketrush.notification.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.SeatChangedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.notification.broadcaster.SeatEventBroadcaster
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class SeatEventConsumer(
    private val broadcaster: SeatEventBroadcaster,
    private val objectMapper: ObjectMapper,
) {
    @KafkaListener(topics = [TopicNames.SEAT_CHANGED], groupId = "notification-api")
    fun consume(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), SeatChangedEvent::class.java)
        broadcaster.publish(event)
    }
}
