package com.ticketrush.payment.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.payment.PaymentStatus
import com.ticketrush.event.TopicNames
import com.ticketrush.payment.entity.PaymentEntity
import com.ticketrush.payment.repository.PaymentRepository
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.github.resilience4j.retry.RetryConfig
import io.github.resilience4j.retry.RetryRegistry
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import java.time.Duration
import java.util.Optional
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

class PaymentServiceTest : DescribeSpec({

    /** 각 테스트에서 독립적인 CB/Retry 레지스트리와 서비스를 생성한다. */
    fun buildService(
        paymentRepo: PaymentRepository = mock(),
        kafkaTemplate: KafkaTemplate<String, String> = mock(),
        cbRegistry: CircuitBreakerRegistry = defaultCbRegistry(),
        retryRegistry: RetryRegistry = fastRetryRegistry(),
    ) = PaymentService(paymentRepo, kafkaTemplate, ObjectMapper().registerKotlinModule(), cbRegistry, retryRegistry)

    fun defaultCbRegistry(): CircuitBreakerRegistry = CircuitBreakerRegistry.ofDefaults()

    /** 테스트에서 CB를 빠르게 OPEN 상태로 만들 수 있는 설정 */
    fun tightCbRegistry(): CircuitBreakerRegistry = CircuitBreakerRegistry.of(
        CircuitBreakerConfig.custom()
            .slidingWindowSize(2)
            .minimumNumberOfCalls(2)
            .failureRateThreshold(100f)
            .waitDurationInOpenState(Duration.ofSeconds(60))
            .permittedNumberOfCallsInHalfOpenState(1)
            .build()
    )

    fun fastRetryRegistry(): RetryRegistry = RetryRegistry.of(
        RetryConfig.custom<Any>()
            .maxAttempts(1)
            .waitDuration(Duration.ofMillis(0))
            .build()
    )

    fun savedEntity(id: Long, orderId: Long, key: String, status: PaymentEntity.PaymentStatus) =
        PaymentEntity(id = id, orderId = orderId, amount = 100_000L, idempotencyKey = key, status = status)

    fun successFuture() = CompletableFuture.completedFuture(mock<SendResult<String, String>>())

    describe("processPayment") {

        it("정상 결제(orderId=1) — COMPLETED Payment를 반환하고 payment.confirmed 이벤트를 발행한다") {
            val paymentRepo = mock<PaymentRepository>()
            @Suppress("UNCHECKED_CAST")
            val kafkaTemplate = mock<KafkaTemplate<String, String>>()
            val service = buildService(paymentRepo, kafkaTemplate)
            val key = UUID.randomUUID().toString()

            whenever(paymentRepo.findByIdempotencyKey(key)).thenReturn(Optional.empty())
            whenever(paymentRepo.save(any())).thenReturn(
                savedEntity(1L, 1L, key, PaymentEntity.PaymentStatus.COMPLETED)
            )
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(successFuture())

            val result = service.processPayment(1L, 10L, 1L, "u1", key)

            result.isRight() shouldBe true
            result.getOrNull()!!.status shouldBe PaymentStatus.COMPLETED
            result.getOrNull()!!.idempotencyKey shouldBe key
            verify(kafkaTemplate).send(eq(TopicNames.PAYMENT_CONFIRMED), eq("1"), any())
        }

        it("Mock PG 실패(orderId=10, 10의 배수) — FAILED Payment와 payment.failed 이벤트를 반환한다") {
            val paymentRepo = mock<PaymentRepository>()
            @Suppress("UNCHECKED_CAST")
            val kafkaTemplate = mock<KafkaTemplate<String, String>>()
            val service = buildService(paymentRepo, kafkaTemplate)
            val key = UUID.randomUUID().toString()

            whenever(paymentRepo.findByIdempotencyKey(key)).thenReturn(Optional.empty())
            whenever(paymentRepo.save(any())).thenReturn(
                savedEntity(2L, 10L, key, PaymentEntity.PaymentStatus.FAILED)
            )
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(successFuture())

            val result = service.processPayment(10L, 5L, 1L, "u2", key)

            result.isRight() shouldBe true
            result.getOrNull()!!.status shouldBe PaymentStatus.FAILED
            verify(kafkaTemplate).send(eq(TopicNames.PAYMENT_FAILED), eq("10"), any())
            verify(kafkaTemplate, never()).send(eq(TopicNames.PAYMENT_CONFIRMED), any(), any())
        }

        it("이미 처리된 idempotency-key — Left(PaymentAlreadyProcessed)를 반환하고 중복 처리하지 않는다") {
            val paymentRepo = mock<PaymentRepository>()
            @Suppress("UNCHECKED_CAST")
            val kafkaTemplate = mock<KafkaTemplate<String, String>>()
            val service = buildService(paymentRepo, kafkaTemplate)
            val key = UUID.randomUUID().toString()
            val existing = savedEntity(100L, 2L, key, PaymentEntity.PaymentStatus.COMPLETED)

            whenever(paymentRepo.findByIdempotencyKey(key)).thenReturn(Optional.of(existing))

            val result = service.processPayment(2L, 7L, 1L, "u3", key)

            result.isLeft() shouldBe true
            result.leftOrNull().shouldBeInstanceOf<DomainError.PaymentAlreadyProcessed>()
            (result.leftOrNull() as DomainError.PaymentAlreadyProcessed).idempotencyKey shouldBe key
            verify(paymentRepo, never()).save(any())
            verify(kafkaTemplate, never()).send(any<String>(), any(), any())
        }

        it("Circuit Breaker OPEN 상태 — Left(PgUnavailable)를 반환하고 Kafka 이벤트를 발행하지 않는다") {
            val paymentRepo = mock<PaymentRepository>()
            @Suppress("UNCHECKED_CAST")
            val kafkaTemplate = mock<KafkaTemplate<String, String>>()
            val cbRegistry = tightCbRegistry()
            val service = buildService(paymentRepo, kafkaTemplate, cbRegistry)
            val key = UUID.randomUUID().toString()

            whenever(paymentRepo.findByIdempotencyKey(key)).thenReturn(Optional.empty())

            // CB "mock-pg"를 OPEN 상태로 강제 전환: 2회 오류 기록 (slidingWindowSize=2, minCalls=2)
            val cb = cbRegistry.circuitBreaker("mock-pg")
            repeat(2) { cb.onError(0, TimeUnit.MILLISECONDS, RuntimeException("PG down")) }

            val result = service.processPayment(3L, 1L, 1L, "u4", key)

            result.isLeft() shouldBe true
            result.leftOrNull().shouldBeInstanceOf<DomainError.PgUnavailable>()
            verify(paymentRepo, never()).save(any())
            verify(kafkaTemplate, never()).send(any<String>(), any(), any())
        }

        it("idempotency-key가 다르면 동일 orderId라도 두 번 결제 처리된다") {
            val paymentRepo = mock<PaymentRepository>()
            @Suppress("UNCHECKED_CAST")
            val kafkaTemplate = mock<KafkaTemplate<String, String>>()
            val service = buildService(paymentRepo, kafkaTemplate)
            val key1 = UUID.randomUUID().toString()
            val key2 = UUID.randomUUID().toString()

            whenever(paymentRepo.findByIdempotencyKey(key1)).thenReturn(Optional.empty())
            whenever(paymentRepo.findByIdempotencyKey(key2)).thenReturn(Optional.empty())
            whenever(paymentRepo.save(any())).thenReturn(
                savedEntity(10L, 1L, key1, PaymentEntity.PaymentStatus.COMPLETED)
            )
            whenever(kafkaTemplate.send(any<String>(), any(), any())).thenReturn(successFuture())

            val result1 = service.processPayment(1L, 1L, 1L, "u5", key1)
            val result2 = service.processPayment(1L, 1L, 1L, "u5", key2)

            result1.isRight() shouldBe true
            result2.isRight() shouldBe true
        }
    }
})
