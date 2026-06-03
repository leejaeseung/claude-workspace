package com.ticketrush.seat.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.event.OrderExpiredEvent
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

class OrderExpiredConsumerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val seatRepo: SeatRepository = mock()
        val lockService: SeatLockService = mock()
        val eventPublisher: SeatEventPublisher = mock()
        val consumer: OrderExpiredConsumer = OrderExpiredConsumer(seatRepo, lockService, eventPublisher, mapper)
    }

    fun lockedSeat(seatId: Long = 3L, showId: Long = 1L, orderId: Long = 50L) =
        SeatEntity(id = seatId, showId = showId, seatNumber = "B$seatId",
            status = SeatEntity.SeatStatus.LOCKED, orderId = orderId)

    fun record(event: OrderExpiredEvent) = ConsumerRecord(
        TopicNames.ORDER_EXPIRED, 0, 0L, event.orderId.toString(), mapper.writeValueAsString(event)
    )

    describe("onOrderExpired") {

        it("LOCKED 좌석 — Redis 락 해제 후 AVAILABLE로 전이하고 seat.changed 이벤트를 발행한다") {
            val d = buildDeps()
            val seatObj = lockedSeat(seatId = 3L, showId = 1L, orderId = 50L)
            val event = OrderExpiredEvent(orderId = 50L)

            whenever(d.seatRepo.findByOrderId(50L)).thenReturn(seatObj)
            whenever(d.lockService.getOwner(1L, 3L)).thenReturn(Mono.just("user-1"))
            whenever(d.lockService.release(1L, 3L, "user-1")).thenReturn(Mono.just(true))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onOrderExpired(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.AVAILABLE
            seatObj.orderId shouldBe null
            verify(d.lockService).release(1L, 3L, "user-1")
            verify(d.seatRepo).save(seatObj)
            verify(d.eventPublisher).publishSeatReleased(3L, 1L)
        }

        it("Redis 락이 없는 경우 (이미 TTL 만료) — DB 전이는 그대로 수행한다") {
            val d = buildDeps()
            val seatObj = lockedSeat(orderId = 51L)
            val event = OrderExpiredEvent(orderId = 51L)

            whenever(d.seatRepo.findByOrderId(51L)).thenReturn(seatObj)
            whenever(d.lockService.getOwner(any(), any())).thenReturn(Mono.justOrEmpty(null))
            whenever(d.seatRepo.save(any())).thenReturn(seatObj)

            d.consumer.onOrderExpired(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.AVAILABLE
            seatObj.orderId shouldBe null
            // Redis에 락 소유자가 없으므로 release 호출 없음
            verify(d.lockService, never()).release(any(), any(), any())
            verify(d.eventPublisher).publishSeatReleased(any(), any())
        }

        it("이미 CONFIRMED 상태 — DB 변경 없이 무시한다") {
            val d = buildDeps()
            val seatObj = SeatEntity(id = 3L, showId = 1L, seatNumber = "B3",
                status = SeatEntity.SeatStatus.CONFIRMED, orderId = 50L)
            val event = OrderExpiredEvent(orderId = 50L)

            whenever(d.seatRepo.findByOrderId(50L)).thenReturn(seatObj)

            d.consumer.onOrderExpired(record(event))

            seatObj.status shouldBe SeatEntity.SeatStatus.CONFIRMED
            verify(d.seatRepo, never()).save(any())
            verify(d.eventPublisher, never()).publishSeatReleased(any(), any())
        }

        it("orderId에 해당하는 좌석이 없는 경우 — 예외 없이 종료한다") {
            val d = buildDeps()
            val event = OrderExpiredEvent(orderId = 999L)
            whenever(d.seatRepo.findByOrderId(999L)).thenReturn(null)

            d.consumer.onOrderExpired(record(event))

            verify(d.lockService, never()).getOwner(any(), any())
            verify(d.seatRepo, never()).save(any())
        }
    }
})
