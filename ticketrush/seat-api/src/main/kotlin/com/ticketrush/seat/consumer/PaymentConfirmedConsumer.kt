package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.PaymentConfirmedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class PaymentConfirmedConsumer(
    private val seatRepository: SeatRepository,
    private val seatEventPublisher: SeatEventPublisher,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(topics = [TopicNames.PAYMENT_CONFIRMED], groupId = "seat-api")
    @Transactional
    fun onPaymentConfirmed(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), PaymentConfirmedEvent::class.java)

        seatRepository.findById(event.seatId).ifPresentOrElse({ seat ->
            if (seat.status != SeatEntity.SeatStatus.CONFIRMED) {
                seat.status = SeatEntity.SeatStatus.CONFIRMED
                seat.orderId = event.orderId
                seatRepository.save(seat)
                seatEventPublisher.publishSeatConfirmed(event.seatId, event.showId)
            }
        }, {
            log.warn("PaymentConfirmed: seatId=${event.seatId} not found in DB")
        })
    }
}
