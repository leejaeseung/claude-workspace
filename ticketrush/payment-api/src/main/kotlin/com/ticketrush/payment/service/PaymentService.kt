package com.ticketrush.payment.service

import arrow.core.Either
import arrow.core.left
import arrow.core.right
import arrow.core.raise.either
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.payment.Payment
import com.ticketrush.domain.payment.PaymentStatus
import com.ticketrush.event.PaymentConfirmedEvent
import com.ticketrush.event.PaymentFailedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.payment.entity.PaymentEntity
import com.ticketrush.payment.repository.PaymentRepository
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import io.github.resilience4j.retry.RetryRegistry
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class PaymentService(
    private val paymentRepository: PaymentRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
    private val retryRegistry: RetryRegistry,
) {
    @Transactional
    fun processPayment(
        orderId: Long,
        seatId: Long,
        showId: Long,
        userId: String,
        idempotencyKey: String,
    ): Either<DomainError, Payment> = either {
        // 멱등성 체크 — 동일 key로 이미 처리된 결제는 기존 결과 반환
        val existing = paymentRepository.findByIdempotencyKey(idempotencyKey).orElse(null)
        if (existing != null) {
            return DomainError.PaymentAlreadyProcessed(idempotencyKey).left()
        }

        // Mock PG 호출 — Circuit Breaker + Retry 래핑
        // CB가 OPEN 상태면 CallNotPermittedException → DomainError.PgUnavailable 반환
        val pgResult = try {
            callMockPgWithResilience(orderId, idempotencyKey)
        } catch (e: CallNotPermittedException) {
            return DomainError.PgUnavailable("Circuit breaker OPEN: ${e.message}").left()
        } catch (e: Exception) {
            return DomainError.PgUnavailable("PG call failed after retries: ${e.message}").left()
        }

        val entity = PaymentEntity(
            orderId = orderId,
            amount = 100_000L,
            idempotencyKey = idempotencyKey,
            status = if (pgResult) PaymentEntity.PaymentStatus.COMPLETED
                     else PaymentEntity.PaymentStatus.FAILED,
        )
        val saved = paymentRepository.save(entity)

        // Kafka 이벤트 발행 (Saga 코디네이션)
        if (pgResult) {
            val event = PaymentConfirmedEvent(
                orderId = orderId,
                paymentId = saved.id,
                seatId = seatId,
                showId = showId,
            )
            kafkaTemplate.send(TopicNames.PAYMENT_CONFIRMED, orderId.toString(),
                objectMapper.writeValueAsString(event))
        } else {
            val event = PaymentFailedEvent(orderId = orderId, reason = "PG declined")
            kafkaTemplate.send(TopicNames.PAYMENT_FAILED, orderId.toString(),
                objectMapper.writeValueAsString(event))
        }

        Payment(
            id = saved.id,
            orderId = orderId,
            amount = 100_000L,
            status = if (pgResult) PaymentStatus.COMPLETED else PaymentStatus.FAILED,
            idempotencyKey = idempotencyKey,
        )
    }

    /**
     * callMockPg()를 Circuit Breaker + Retry로 래핑한다.
     *
     * - Circuit Breaker "mock-pg": application.yml resilience4j.circuitbreaker.instances.mock-pg 설정 사용
     * - Retry "mock-pg": application.yml resilience4j.retry.instances.mock-pg 설정 사용
     * - 추후 @CircuitBreaker(name = "mock-pg") + @Retry(name = "mock-pg") 어노테이션으로 전환 시
     *   이 메서드를 제거하고 callMockPg()에 어노테이션만 추가하면 됨 (config는 그대로 재사용)
     */
    private fun callMockPgWithResilience(orderId: Long, idempotencyKey: String): Boolean {
        val cb = circuitBreakerRegistry.circuitBreaker("mock-pg")
        val retry = retryRegistry.retry("mock-pg")
        val decorated = io.github.resilience4j.retry.Retry.decorateSupplier(retry) {
            io.github.resilience4j.circuitbreaker.CircuitBreaker.decorateSupplier(cb) {
                callMockPg(orderId, idempotencyKey)
            }.get()
        }
        return decorated.get()
    }

    // Mock PG: 90% 성공률 시뮬레이션
    private fun callMockPg(orderId: Long, idempotencyKey: String): Boolean =
        (orderId % 10) != 0L
}
