package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.event.PaymentFailedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import com.ticketrush.seat.service.SeatLockService
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import reactor.core.publisher.Mono

class PaymentFailedConsumerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val seatRepo: SeatRepository = mock()
        val lockService: SeatLockService = mock()
        val eventPublisher: SeatEventPublisher = mock()
        val consumer: PaymentFailedConsumer = PaymentFailedConsumer(seatRepo, lockService, eventPublisher, mapper)
    }

    fun lockedSeat(seatId: Long = 4L, showId: Long = 1L, orderId: Long = 60L) =
        SeatEntity(id = seatId, showId = showId, seatNumber = "C$seatId",
            status = SeatEntity.SeatStatus.LOCKED, orderId = orderId)

    fun record(event: PaymentFailedEvent) = ConsumerRecord(
        TopicNames.PAYMENT_FAILED, 0, 0L, event.orderId.toString(), mapper.writeValueAsString(event)
    )

    describe("onPaymentFailed") {

        it("LOCKED 좌석 — Redis 락 해제 후 AVAILABLE로 전이하고 seat.changed 이벤트를 발행한다") {
            val d = buildDeps()
            val seatObj = lockedSeat(seatId = 4L, showId = 1L, orderId = 60L)
            val event = PaymentFailedEvent(orderId = 60L, reason = "PG declined")

            whenever(d.seatRepo.findByOrderId(60L)).thenReturn(seatObj)
            whenever(d.lockService.getOwner(1L, 4L)).thenReturn(Mono.just("user-2"))
            whenever(d.lockService.release(1L, 4L, "user-2")).thenReturn(Mono.just(true))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onPaymentFailed(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.AVAILABLE
            seatObj.orderId shouldBe null
            verify(d.lockService).release(1L, 4L, "user-2")
            verify(d.seatRepo).save(seatObj)
            verify(d.eventPublisher).publishSeatReleased(4L, 1L)
        }

        it("이벤트 순서 역전 — CONFIRMED 좌석에 payment.failed 수신 시 변경하지 않는다") {
            val d = buildDeps()
            val seatObj = SeatEntity(id = 4L, showId = 1L, seatNumber = "C4",
                status = SeatEntity.SeatStatus.CONFIRMED, orderId = 60L)
            val event = PaymentFailedEvent(orderId = 60L, reason = "PG declined")

            whenever(d.seatRepo.findByOrderId(60L)).thenReturn(seatObj)

            d.consumer.onPaymentFailed(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.CONFIRMED
            verify(d.lockService, never()).getOwner(any(), any())
            verify(d.seatRepo, never()).save(any())
            verify(d.eventPublisher, never()).publishSeatReleased(any(), any())
        }

        it("orderId에 해당하는 좌석이 없는 경우 — 예외 없이 종료한다") {
            val d = buildDeps()
            val event = PaymentFailedEvent(orderId = 888L, reason = "Not found")
            whenever(d.seatRepo.findByOrderId(888L)).thenReturn(null)

            d.consumer.onPaymentFailed(record(event))

            verify(d.lockService, never()).getOwner(any(), any())
            verify(d.seatRepo, never()).save(any())
        }

        it("결제 실패 이유(reason)가 Kafka 이벤트에 포함되어 있어도 좌석은 정상 해제된다") {
            val d = buildDeps()
            val seatObj = lockedSeat(orderId = 61L)
            val event = PaymentFailedEvent(orderId = 61L, reason = "Circuit breaker OPEN")

            whenever(d.seatRepo.findByOrderId(61L)).thenReturn(seatObj)
            whenever(d.lockService.getOwner(any(), any())).thenReturn(Mono.justOrEmpty(null))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onPaymentFailed(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.AVAILABLE
        }
    }
})
