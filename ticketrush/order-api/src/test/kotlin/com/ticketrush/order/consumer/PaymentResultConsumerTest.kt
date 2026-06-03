package com.ticketrush.order.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.event.PaymentConfirmedEvent
import com.ticketrush.event.PaymentFailedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.repository.OrderRepository
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class PaymentResultConsumerTest : DescribeSpec({

    val mapper = ObjectMapper().registerKotlinModule()

    fun buildDeps() = object {
        val orderRepo: OrderRepository = mock()
        val consumer: PaymentResultConsumer = PaymentResultConsumer(orderRepo, mapper)
    }

    fun pendingOrder(id: Long) =
        OrderEntity(id = id, userId = "u1", seatId = 5L, showId = 1L, totalAmount = 100_000L,
            status = OrderEntity.OrderStatus.PENDING)

    describe("onPaymentConfirmed") {

        it("PENDING 주문 — CONFIRMED로 상태 전이한다") {
            val d = buildDeps()
            val order = pendingOrder(10L)
            val event = PaymentConfirmedEvent(orderId = 10L, paymentId = 1L, seatId = 5L, showId = 1L)
            whenever(d.orderRepo.findById(10L)).thenReturn(Optional.of(order))
            whenever(d.orderRepo.save(any())).thenReturn(order)

            d.consumer.onPaymentConfirmed(
                ConsumerRecord(TopicNames.PAYMENT_CONFIRMED, 0, 0L, "10", mapper.writeValueAsString(event))
            )

            order.status shouldBe OrderEntity.OrderStatus.CONFIRMED
            verify(d.orderRepo).save(order)
        }

        it("존재하지 않는 orderId — save를 호출하지 않는다") {
            val d = buildDeps()
            val event = PaymentConfirmedEvent(orderId = 999L, paymentId = 1L, seatId = 5L, showId = 1L)
            whenever(d.orderRepo.findById(999L)).thenReturn(Optional.empty())

            d.consumer.onPaymentConfirmed(
                ConsumerRecord(TopicNames.PAYMENT_CONFIRMED, 0, 0L, "999", mapper.writeValueAsString(event))
            )

            verify(d.orderRepo, never()).save(any())
        }
    }

    describe("onPaymentFailed") {

        it("PENDING 주문 — CANCELLED로 상태 전이한다") {
            val d = buildDeps()
            val order = pendingOrder(20L)
            val event = PaymentFailedEvent(orderId = 20L, reason = "PG declined")
            whenever(d.orderRepo.findById(20L)).thenReturn(Optional.of(order))
            whenever(d.orderRepo.save(any())).thenReturn(order)

            d.consumer.onPaymentFailed(
                ConsumerRecord(TopicNames.PAYMENT_FAILED, 0, 0L, "20", mapper.writeValueAsString(event))
            )

            order.status shouldBe OrderEntity.OrderStatus.CANCELLED
            verify(d.orderRepo).save(order)
        }

        it("존재하지 않는 orderId — save를 호출하지 않는다") {
            val d = buildDeps()
            val event = PaymentFailedEvent(orderId = 888L, reason = "Not found")
            whenever(d.orderRepo.findById(888L)).thenReturn(Optional.empty())

            d.consumer.onPaymentFailed(
                ConsumerRecord(TopicNames.PAYMENT_FAILED, 0, 0L, "888", mapper.writeValueAsString(event))
            )

            verify(d.orderRepo, never()).save(any())
        }
    }
})
