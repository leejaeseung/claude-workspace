package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.event.PaymentConfirmedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.seat.entity.SeatEntity
import com.ticketrush.seat.repository.SeatRepository
import com.ticketrush.seat.service.SeatEventPublisher
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class PaymentConfirmedConsumerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val seatRepo: SeatRepository = mock()
        val eventPublisher: SeatEventPublisher = mock()
        val consumer: PaymentConfirmedConsumer = PaymentConfirmedConsumer(seatRepo, eventPublisher, mapper)
    }

    fun lockedSeat(seatId: Long, orderId: Long, showId: Long = 1L) =
        SeatEntity(id = seatId, showId = showId, seatNumber = "A$seatId",
            status = SeatEntity.SeatStatus.LOCKED, orderId = orderId)

    fun record(event: PaymentConfirmedEvent) = ConsumerRecord(
        TopicNames.PAYMENT_CONFIRMED, 0, 0L, event.orderId.toString(), mapper.writeValueAsString(event)
    )

    describe("onPaymentConfirmed") {

        it("LOCKED 좌석 — CONFIRMED로 전이하고 seat.changed 이벤트를 발행한다") {
            val d = buildDeps()
            val seatObj = lockedSeat(seatId = 7L, orderId = 200L)
            val event = PaymentConfirmedEvent(orderId = 200L, paymentId = 50L, seatId = 7L, showId = 1L)
            whenever(d.seatRepo.findById(7L)).thenReturn(Optional.of(seatObj))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onPaymentConfirmed(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.CONFIRMED
            verify(d.seatRepo).save(seatObj)
            verify(d.eventPublisher).publishSeatConfirmed(7L, 1L)
        }

        it("이미 CONFIRMED 상태 — 중복 수신이므로 DB save와 이벤트 발행을 생략한다") {
            val d = buildDeps()
            val seatObj = SeatEntity(id = 7L, showId = 1L, seatNumber = "A7",
                status = SeatEntity.SeatStatus.CONFIRMED, orderId = 200L)
            val event = PaymentConfirmedEvent(orderId = 200L, paymentId = 50L, seatId = 7L, showId = 1L)
            whenever(d.seatRepo.findById(7L)).thenReturn(Optional.of(seatObj))

            d.consumer.onPaymentConfirmed(record(event))

            verify(d.seatRepo, never()).save(any())
            verify(d.eventPublisher, never()).publishSeatConfirmed(any(), any())
        }

        it("DB에 존재하지 않는 seatId — 예외 없이 종료한다") {
            val d = buildDeps()
            val event = PaymentConfirmedEvent(orderId = 200L, paymentId = 50L, seatId = 999L, showId = 1L)
            whenever(d.seatRepo.findById(999L)).thenReturn(Optional.empty())

            d.consumer.onPaymentConfirmed(record(event))

            verify(d.seatRepo, never()).save(any())
            verify(d.eventPublisher, never()).publishSeatConfirmed(any(), any())
        }
    }
})
