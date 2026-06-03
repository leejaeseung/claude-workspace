package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.event.OrderCreatedEvent
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

class OrderCreatedConsumerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val seatRepo: SeatRepository = mock()
        val eventPublisher: SeatEventPublisher = mock()
        val consumer: OrderCreatedConsumer = OrderCreatedConsumer(seatRepo, eventPublisher, mapper)
    }

    fun seat(id: Long, showId: Long = 1L, status: SeatEntity.SeatStatus = SeatEntity.SeatStatus.AVAILABLE, orderId: Long? = null) =
        SeatEntity(id = id, showId = showId, seatNumber = "A$id", status = status, orderId = orderId)

    fun record(event: OrderCreatedEvent) = ConsumerRecord(
        TopicNames.ORDER_CREATED, 0, 0L, event.orderId.toString(), mapper.writeValueAsString(event)
    )

    describe("onOrderCreated") {

        it("AVAILABLE 좌석 — LOCKED으로 상태 전이하고 orderId를 기록한다") {
            val d = buildDeps()
            val seatObj = seat(5L)
            val event = OrderCreatedEvent(orderId = 100L, userId = "u1", seatId = 5L, showId = 1L, totalAmount = 100_000L)
            whenever(d.seatRepo.findById(5L)).thenReturn(Optional.of(seatObj))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onOrderCreated(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.LOCKED
            seatObj.orderId shouldBe 100L
            verify(d.seatRepo).save(seatObj)
        }

        it("이미 LOCKED이고 동일 orderId — 중복 수신이므로 DB save를 호출하지 않는다") {
            val d = buildDeps()
            val seatObj = seat(5L, status = SeatEntity.SeatStatus.LOCKED, orderId = 100L)
            val event = OrderCreatedEvent(orderId = 100L, userId = "u1", seatId = 5L, showId = 1L, totalAmount = 100_000L)
            whenever(d.seatRepo.findById(5L)).thenReturn(Optional.of(seatObj))

            d.consumer.onOrderCreated(record(event))

            verify(d.seatRepo, never()).save(any())
        }

        it("이미 LOCKED이고 다른 orderId — 경합 상황으로 무시하고 상태가 변경되지 않는다") {
            val d = buildDeps()
            val seatObj = seat(5L, status = SeatEntity.SeatStatus.LOCKED, orderId = 999L)
            val event = OrderCreatedEvent(orderId = 100L, userId = "u1", seatId = 5L, showId = 1L, totalAmount = 100_000L)
            whenever(d.seatRepo.findById(5L)).thenReturn(Optional.of(seatObj))

            d.consumer.onOrderCreated(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.LOCKED
            seatObj.orderId shouldBe 999L  // 기존 orderId 유지
            verify(d.seatRepo, never()).save(any())
        }

        it("이미 CONFIRMED 상태 — 변경 없이 무시한다") {
            val d = buildDeps()
            val seatObj = seat(5L, status = SeatEntity.SeatStatus.CONFIRMED, orderId = 100L)
            val event = OrderCreatedEvent(orderId = 100L, userId = "u1", seatId = 5L, showId = 1L, totalAmount = 100_000L)
            whenever(d.seatRepo.findById(5L)).thenReturn(Optional.of(seatObj))

            d.consumer.onOrderCreated(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.CONFIRMED
            verify(d.seatRepo, never()).save(any())
        }

        it("DB에 존재하지 않는 seatId — 예외 없이 warn 로그만 남긴다") {
            val d = buildDeps()
            val event = OrderCreatedEvent(orderId = 100L, userId = "u1", seatId = 999L, showId = 1L, totalAmount = 100_000L)
            whenever(d.seatRepo.findById(999L)).thenReturn(Optional.empty())

            d.consumer.onOrderCreated(record(event))

            verify(d.seatRepo, never()).save(any())
        }
    }
})
