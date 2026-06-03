package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.OrderCreatedEvent
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
class OrderCreatedConsumer(
    private val seatRepository: SeatRepository,
    private val seatEventPublisher: SeatEventPublisher,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * order.created 수신 시 SeatEntity에 orderId를 기록하고 DB 상태를 LOCKED로 전이한다.
     *
     * 역할:
     *  - orderId를 SeatEntity에 저장해두어 OrderExpiredConsumer / PaymentFailedConsumer가
     *    이벤트 수신 시 findByOrderId()로 좌석을 역추적할 수 있도록 한다.
     *  - DB 상태를 LOCKED로 기록해 Redis 장애 시에도 좌석 점유 상태를 보정 가능하게 한다.
     *
     * 멱등성:
     *  - 이미 LOCKED 또는 CONFIRMED이고 동일 orderId라면 중복 처리 건너뜀.
     *  - 다른 orderId가 이미 기록된 경우 경고 후 무시 (동시 주문 방어).
     */
    @KafkaListener(topics = [TopicNames.ORDER_CREATED], groupId = "seat-api-order")
    @Transactional
    fun onOrderCreated(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), OrderCreatedEvent::class.java)

        seatRepository.findById(event.seatId).ifPresentOrElse({ seat ->
            // 이미 다른 orderId로 점유된 경우 방어
            if (seat.orderId != null && seat.orderId != event.orderId) {
                log.warn(
                    "OrderCreated: seatId=${event.seatId} 이미 orderId=${seat.orderId} 로 점유 중 — " +
                        "신규 orderId=${event.orderId} 무시"
                )
                return@ifPresentOrElse
            }

            if (seat.status == SeatEntity.SeatStatus.CONFIRMED) {
                log.warn("OrderCreated: seatId=${event.seatId} 이미 CONFIRMED — 무시")
                return@ifPresentOrElse
            }

            if (seat.status == SeatEntity.SeatStatus.LOCKED && seat.orderId == event.orderId) {
                log.debug("OrderCreated: seatId=${event.seatId} orderId=${event.orderId} 중복 수신 — 건너뜀")
                return@ifPresentOrElse
            }

            seat.status = SeatEntity.SeatStatus.LOCKED
            seat.orderId = event.orderId
            seatRepository.save(seat)

            log.info("OrderCreated: seatId=${event.seatId} LOCKED 전이 완료 (orderId=${event.orderId})")
        }, {
            log.warn("OrderCreated: seatId=${event.seatId} not found in DB")
        })
    }
}
