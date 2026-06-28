package com.ticketrush.order.scheduler

import com.ticketrush.event.TopicNames
import com.ticketrush.order.repository.OutboxRepository
import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.concurrent.ExecutionException

@Component
class OutboxRelayScheduler(
    private val outboxRepository: OutboxRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>,
) {
    companion object {
        private const val MAX_RETRY = 5
        private val logger = LoggerFactory.getLogger(OutboxRelayScheduler::class.java)
    }

    // 200ms마다 미발행 이벤트 배치 발행 (ADR-007: relay 지연 단축으로 step_payment_ms P99 개선)
    @Scheduled(fixedDelay = 200)
    @Transactional
    fun relay() {
        val pending = outboxRepository.findAllByPublishedFalseAndRetryCountLessThan(MAX_RETRY)
        if (pending.isEmpty()) return

        pending.forEach { outbox ->
            val topic = when (outbox.eventType) {
                "OrderCreated" -> TopicNames.ORDER_CREATED
                "OrderExpired" -> TopicNames.ORDER_EXPIRED
                else -> return@forEach
            }
            try {
                kafkaTemplate.send(topic, outbox.aggregateId, outbox.payload).get() // 동기 확인
                outbox.published = true
                outbox.publishedAt = Instant.now()
            } catch (e: Exception) {
                outbox.retryCount++
                logger.error(
                    "Kafka 전송 실패 [id={}, eventType={}, retryCount={}]: {}",
                    outbox.id, outbox.eventType, outbox.retryCount, e.message
                )
            }
        }
        outboxRepository.saveAll(pending)
    }
}
