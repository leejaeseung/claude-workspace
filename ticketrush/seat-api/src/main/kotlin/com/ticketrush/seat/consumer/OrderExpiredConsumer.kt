package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.OrderExpiredEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import com.ticketrush.seat.service.SeatLockService
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import reactor.core.publisher.Mono

@Component
class OrderExpiredConsumer(
    private val seatRepository: SeatRepository,
    private val seatLockService: SeatLockService,
    private val seatEventPublisher: SeatEventPublisher,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * order.expired 수신 시 좌석을 AVAILABLE로 되돌린다.
     *
     * groupId를 기존 PaymentConfirmedConsumer("seat-api")와 구분해
     * Kafka 파티션 할당 충돌 없이 독립적으로 소비한다.
     */
    @KafkaListener(topics = [TopicNames.ORDER_EXPIRED], groupId = "seat-api-expired")
    @Transactional
    fun onOrderExpired(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), OrderExpiredEvent::class.java)

        val seat = seatRepository.findByOrderId(event.orderId)
        if (seat == null) {
            log.warn("OrderExpired: orderId=${event.orderId} 에 해당하는 좌석을 찾을 수 없습니다 — 이미 해제됐거나 미점유 상태")
            return
        }

        if (seat.status == SeatEntity.SeatStatus.CONFIRMED) {
            log.info("OrderExpired: orderId=${event.orderId} 이미 CONFIRMED 상태 — 무시")
            return
        }

        // Redis 락 소유자 조회 후 해제 (reactive → block: Kafka 리스너는 스레드 기반)
        seatLockService.getOwner(seat.showId, seat.id)
            .flatMap { userId ->
                if (userId != null) {
                    seatLockService.release(seat.showId, seat.id, userId)
                } else {
                    Mono.just(false)
                }
            }
            .doOnNext { released ->
                if (!released) log.debug("OrderExpired: Redis 락 없음 또는 이미 해제 — seatId=${seat.id}")
            }
            .block()

        seat.status = SeatEntity.SeatStatus.AVAILABLE
        seat.orderId = null
        seatRepository.save(seat)

        seatEventPublisher.publishSeatReleased(seat.id, seat.showId)
        log.info("OrderExpired: seatId=${seat.id} AVAILABLE 전이 완료 (orderId=${event.orderId})")
    }
}
