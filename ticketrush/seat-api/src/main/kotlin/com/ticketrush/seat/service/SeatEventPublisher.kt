package com.ticketrush.seat.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.SeatChangedEvent
import com.ticketrush.event.TopicNames
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
class SeatEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
) {
    fun publishSeatLocked(seatId: Long, showId: Long) =
        publish(seatId, showId, "LOCKED")

    fun publishSeatReleased(seatId: Long, showId: Long) =
        publish(seatId, showId, "AVAILABLE")

    fun publishSeatConfirmed(seatId: Long, showId: Long) =
        publish(seatId, showId, "CONFIRMED")

    private fun publish(seatId: Long, showId: Long, status: String) {
        val event = SeatChangedEvent(seatId = seatId, showId = showId, status = status)
        kafkaTemplate.send(
            TopicNames.SEAT_CHANGED,
            showId.toString(),
            objectMapper.writeValueAsString(event),
        )
    }
}
