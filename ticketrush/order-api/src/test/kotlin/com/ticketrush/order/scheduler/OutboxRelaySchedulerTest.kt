package com.ticketrush.order.scheduler

import com.ticketrush.event.TopicNames
import com.ticketrush.order.entity.OutboxEntity
import com.ticketrush.order.repository.OutboxRepository
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import java.util.concurrent.CompletableFuture

class OutboxRelaySchedulerTest : DescribeSpec({

    fun buildScheduler(): Triple<OutboxRepository, KafkaTemplate<String, String>, OutboxRelayScheduler> {
        val outboxRepo = mock<OutboxRepository>()
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock<KafkaTemplate<String, String>>()
        return Triple(outboxRepo, kafkaTemplate, OutboxRelayScheduler(outboxRepo, kafkaTemplate))
    }

    fun successFuture() = CompletableFuture.completedFuture(mock<SendResult<String, String>>())

    fun failFuture(): CompletableFuture<SendResult<String, String>> =
        CompletableFuture<SendResult<String, String>>().also {
            it.completeExceptionally(RuntimeException("Kafka 브로커 연결 실패"))
        }

    describe("relay") {

        it("대기 중인 아웃박스가 없으면 Kafka send를 호출하지 않는다") {
            val (outboxRepo, kafkaTemplate, scheduler) = buildScheduler()
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(any())).thenReturn(emptyList())

            scheduler.relay()

            verify(kafkaTemplate, never()).send(any<String>(), any<String>(), any<String>())
        }

        it("OrderCreated 아웃박스 — order.created 토픽 발행 후 published=true로 갱신된다") {
            val (outboxRepo, kafkaTemplate, scheduler) = buildScheduler()
            val outbox = OutboxEntity(
                id = 1L, aggregateType = "Order", aggregateId = "10",
                eventType = "OrderCreated", payload = """{"orderId":10}""",
            )
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(any())).thenReturn(listOf(outbox))
            whenever(outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(outbox))
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(successFuture())

            scheduler.relay()

            verify(kafkaTemplate).send(eq(TopicNames.ORDER_CREATED), eq("10"), any())
            outbox.published shouldBe true
            outbox.publishedAt shouldNotBe null
        }

        it("OrderExpired 아웃박스 — order.expired 토픽으로 발행된다") {
            val (outboxRepo, kafkaTemplate, scheduler) = buildScheduler()
            val outbox = OutboxEntity(
                id = 2L, aggregateType = "Order", aggregateId = "20",
                eventType = "OrderExpired", payload = """{"orderId":20}""",
            )
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(any())).thenReturn(listOf(outbox))
            whenever(outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(outbox))
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(successFuture())

            scheduler.relay()

            verify(kafkaTemplate).send(eq(TopicNames.ORDER_EXPIRED), eq("20"), any())
        }

        it("Kafka 전송 실패 — published=false 유지, retryCount 1 증가") {
            val (outboxRepo, kafkaTemplate, scheduler) = buildScheduler()
            val outbox = OutboxEntity(
                id = 3L, aggregateType = "Order", aggregateId = "30",
                eventType = "OrderCreated", payload = """{"orderId":30}""",
                retryCount = 2,
            )
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(any())).thenReturn(listOf(outbox))
            whenever(outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(outbox))
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(failFuture())

            scheduler.relay()

            outbox.published shouldBe false
            outbox.retryCount shouldBe 3
        }

        it("MAX_RETRY(5) 이상인 아웃박스는 findAll 쿼리에서 제외되어 relay 대상이 아니다") {
            val (outboxRepo, _, scheduler) = buildScheduler()
            // retryCount >= 5인 outbox는 findAllByPublishedFalseAndRetryCountLessThan(5)에서 반환하지 않음
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(5)).thenReturn(emptyList())

            scheduler.relay()

            verify(outboxRepo).findAllByPublishedFalseAndRetryCountLessThan(5)
        }

        it("알 수 없는 eventType은 건너뛰고 Kafka send를 호출하지 않는다") {
            val (outboxRepo, kafkaTemplate, scheduler) = buildScheduler()
            val outbox = OutboxEntity(
                id = 4L, aggregateType = "Unknown", aggregateId = "40",
                eventType = "SomeUnknownEvent", payload = "{}",
            )
            whenever(outboxRepo.findAllByPublishedFalseAndRetryCountLessThan(any())).thenReturn(listOf(outbox))
            whenever(outboxRepo.saveAll(any<List<OutboxEntity>>())).thenReturn(listOf(outbox))

            scheduler.relay()

            verify(kafkaTemplate, never()).send(any<String>(), any<String>(), any<String>())
        }
    }
})
