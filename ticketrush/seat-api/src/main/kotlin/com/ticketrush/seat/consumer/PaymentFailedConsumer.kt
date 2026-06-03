package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.PaymentFailedEvent
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
class PaymentFailedConsumer(
    private val seatRepository: SeatRepository,
    private val seatLockService: SeatLockService,
    private val seatEventPublisher: SeatEventPublisher,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * payment.failed 수신 시 좌석을 AVAILABLE로 되돌린다.
     *
     * groupId "seat-api-payment" 으로 독립 소비 그룹 유지.
     */
    @KafkaListener(topics = [TopicNames.PAYMENT_FAILED], groupId = "seat-api-payment")
    @Transactional
    fun onPaymentFailed(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), PaymentFailedEvent::class.java)

        val seat = seatRepository.findByOrderId(event.orderId)
        if (seat == null) {
            log.warn("PaymentFailed: orderId=${event.orderId} 에 해당하는 좌석을 찾을 수 없습니다 — 이미 해제됐거나 미점유 상태")
            return
        }

        if (seat.status == SeatEntity.SeatStatus.CONFIRMED) {
            // 결제 실패가 이미 확정된 좌석에 도달하는 경우 — 이벤트 순서 역전 방어
            log.warn("PaymentFailed: orderId=${event.orderId} seatId=${seat.id} 이미 CONFIRMED — 무시 (이유: ${event.reason})")
            return
        }

        // Redis 락 소유자 조회 후 해제
        seatLockService.getOwner(seat.showId, seat.id)
            .flatMap { userId ->
                if (userId != null) {
                    seatLockService.release(seat.showId, seat.id, userId)
                } else {
                    Mono.just(false)
                }
            }
            .doOnNext { released ->
                if (!released) log.debug("PaymentFailed: Redis 락 없음 또는 이미 해제 — seatId=${seat.id}")
            }
            .block()

        seat.status = SeatEntity.SeatStatus.AVAILABLE
        seat.orderId = null
        seatRepository.save(seat)

        seatEventPublisher.publishSeatReleased(seat.id, seat.showId)
        log.info("PaymentFailed: seatId=${seat.id} AVAILABLE 전이 완료 (orderId=${event.orderId}, 이유: ${event.reason})")
    }
}
