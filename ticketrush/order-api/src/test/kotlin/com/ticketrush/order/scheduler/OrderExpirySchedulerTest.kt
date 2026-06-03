package com.ticketrush.order.scheduler

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.entity.OutboxEntity
import com.ticketrush.order.repository.OrderRepository
import com.ticketrush.order.repository.OutboxRepository
import com.ticketrush.order.repository.PendingOrderQueryRepository
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

class OrderExpirySchedulerTest : DescribeSpec({

    fun buildDeps() = object {
        val orderRepo: OrderRepository = mock()
        val outboxRepo: OutboxRepository = mock()
        val pendingQuery: PendingOrderQueryRepository = mock()
        val scheduler: OrderExpiryScheduler = OrderExpiryScheduler(
            orderRepo, outboxRepo, pendingQuery, ObjectMapper().registerKotlinModule()
        )
    }

    fun pendingOrder(id: Long) =
        OrderEntity(id = id, userId = "u$id", seatId = id, showId = 10L, totalAmount = 100_000L)

    describe("expireOrders") {

        it("만료된 주문이 없으면 Outbox save를 호출하지 않는다") {
            val d = buildDeps()
            whenever(d.pendingQuery.findExpiredPendingOrders(any())).thenReturn(emptyList())

            d.scheduler.expireOrders()

            verify(d.outboxRepo, never()).save(any())
            verify(d.orderRepo, never()).saveAll(any<List<OrderEntity>>())
        }

        it("만료된 주문의 상태를 EXPIRED로 변경한다") {
            val d = buildDeps()
            val order = pendingOrder(1L)
            whenever(d.pendingQuery.findExpiredPendingOrders(any())).thenReturn(listOf(order))
            whenever(d.outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(mock()))
            whenever(d.orderRepo.saveAll(any<List<OrderEntity>>())).thenReturn(listOf(order))

            d.scheduler.expireOrders()

            order.status shouldBe OrderEntity.OrderStatus.EXPIRED
        }

        it("만료 주문 N건을 saveAll() 단일 호출로 배치 저장한다 (N+1 방지)") {
            val d = buildDeps()
            val orders = listOf(pendingOrder(1L), pendingOrder(2L))
            whenever(d.pendingQuery.findExpiredPendingOrders(any())).thenReturn(orders)
            whenever(d.outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(mock(), mock()))
            whenever(d.orderRepo.saveAll(any<List<OrderEntity>>())).thenReturn(orders)

            d.scheduler.expireOrders()

            // saveAll 1회 호출 — 개별 save() N회 아님
            val captor = argumentCaptor<List<OutboxEntity>>()
            verify(d.outboxRepo).saveAll(captor.capture())
            verify(d.outboxRepo, never()).save(any())
            captor.firstValue.map { it.eventType }.forEach { it shouldBe "OrderExpired" }
            captor.firstValue.map { it.aggregateId } shouldBe listOf("1", "2")
        }

        it("만료 기준 시각이 현재 기준 5분(300초) 이전이다") {
            val d = buildDeps()
            whenever(d.pendingQuery.findExpiredPendingOrders(any())).thenReturn(emptyList())
            val beforeCall = Instant.now().minusSeconds(300)

            d.scheduler.expireOrders()

            val captor = argumentCaptor<Instant>()
            verify(d.pendingQuery).findExpiredPendingOrders(captor.capture())
            val captured = captor.firstValue
            // 호출 시각 기준 5분 전임을 ±1초 허용으로 검증
            captured.isBefore(beforeCall.plusSeconds(1)) shouldBe true
            captured.isAfter(beforeCall.minusSeconds(1)) shouldBe true
        }
    }
})
