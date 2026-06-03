package com.ticketrush.order.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.order.OrderStatus
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.repository.OrderRepository
import com.ticketrush.order.repository.OutboxRepository
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class OrderServiceTest : DescribeSpec({

    fun buildService(
        orderRepo: OrderRepository = mock(),
        outboxRepo: OutboxRepository = mock(),
    ) = Triple(
        orderRepo,
        outboxRepo,
        OrderService(orderRepo, outboxRepo, ObjectMapper().registerKotlinModule()),
    )

    fun makeEntity(id: Long = 1L, userId: String = "user-1", seatId: Long = 42L, showId: Long = 100L) =
        OrderEntity(id = id, userId = userId, seatId = seatId, showId = showId, totalAmount = 100_000L)

    describe("createOrder") {

        it("유효한 입력 — Right(Order)를 반환하고 Outbox를 저장한다") {
            val (orderRepo, outboxRepo, service) = buildService()
            whenever(orderRepo.save(any())).thenReturn(makeEntity())
            whenever(outboxRepo.save(any())).thenReturn(mock())

            val result = service.createOrder("user-1", 42L, 100L)

            result.isRight() shouldBe true
            result.getOrNull()!!.userId shouldBe "user-1"
            result.getOrNull()!!.seatId shouldBe 42L
            result.getOrNull()!!.status shouldBe OrderStatus.PENDING
            verify(outboxRepo).save(any())
        }

        it("userId가 빈 문자열 — Left(UnauthorizedAccess)를 반환하고 Repository를 호출하지 않는다") {
            val (orderRepo, _, service) = buildService()

            val result = service.createOrder("", 42L, 100L)

            result.isLeft() shouldBe true
            result.leftOrNull().shouldBeInstanceOf<DomainError.UnauthorizedAccess>()
            verify(orderRepo, never()).save(any())
        }

        it("userId가 공백만 있는 문자열 — Left(UnauthorizedAccess)를 반환한다") {
            val (_, _, service) = buildService()

            val result = service.createOrder("   ", 42L, 100L)

            result.isLeft() shouldBe true
            result.leftOrNull().shouldBeInstanceOf<DomainError.UnauthorizedAccess>()
        }

        it("seatId가 0 — Left(SeatNotFound)를 반환한다") {
            val (_, _, service) = buildService()

            val result = service.createOrder("user-1", 0L, 100L)

            result.isLeft() shouldBe true
            result.leftOrNull().shouldBeInstanceOf<DomainError.SeatNotFound>()
        }

        it("seatId가 음수 — Left(SeatNotFound)를 반환한다") {
            val (_, _, service) = buildService()

            val result = service.createOrder("user-1", -1L, 100L)

            result.isLeft() shouldBe true
            (result.leftOrNull() as DomainError.SeatNotFound).seatId shouldBe -1L
        }

        it("저장된 Order의 totalAmount는 티켓 정가(100,000원)와 일치한다") {
            val (orderRepo, outboxRepo, service) = buildService()
            whenever(orderRepo.save(any())).thenReturn(makeEntity())
            whenever(outboxRepo.save(any())).thenReturn(mock())

            val result = service.createOrder("user-1", 1L, 100L)

            result.getOrNull()!!.totalAmount shouldBe 100_000L
        }
    }

    describe("getOrder") {

        it("존재하는 orderId — Right(Order)를 반환하고 필드가 일치한다") {
            val (orderRepo, _, service) = buildService()
            whenever(orderRepo.findById(7L)).thenReturn(Optional.of(makeEntity(id = 7L, seatId = 15L)))

            val result = service.getOrder(7L)

            result.isRight() shouldBe true
            result.getOrNull()!!.id shouldBe 7L
            result.getOrNull()!!.seatId shouldBe 15L
        }

        it("존재하지 않는 orderId — Left(OrderNotFound)에 올바른 orderId가 담긴다") {
            val (orderRepo, _, service) = buildService()
            whenever(orderRepo.findById(999L)).thenReturn(Optional.empty())

            val result = service.getOrder(999L)

            result.isLeft() shouldBe true
            (result.leftOrNull() as DomainError.OrderNotFound).orderId shouldBe 999L
        }
    }
})
