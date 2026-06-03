package com.ticketrush.infra.kafka

import com.ticketrush.event.TopicNames
import org.apache.kafka.clients.admin.NewTopic
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.TopicBuilder

@Configuration
class KafkaTopicConfig {

    @Bean fun seatChangedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.SEAT_CHANGED).partitions(12).replicas(1).build()

    // 6 → 12 파티션: W6 하진우 결정 (ADR-009)
    // seat.changed(12)와 통일 → 향후 Consumer 수평 확장 시 최대 12 병렬 처리 가능
    @Bean fun orderCreatedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.ORDER_CREATED).partitions(12).replicas(1).build()

    @Bean fun orderExpiredTopic(): NewTopic =
        TopicBuilder.name(TopicNames.ORDER_EXPIRED).partitions(6).replicas(1).build()

    @Bean fun paymentRequestedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.PAYMENT_REQUESTED).partitions(6).replicas(1).build()

    @Bean fun paymentConfirmedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.PAYMENT_CONFIRMED).partitions(6).replicas(1).build()

    @Bean fun paymentFailedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.PAYMENT_FAILED).partitions(6).replicas(1).build()

    @Bean fun queueEntryRequestedTopic(): NewTopic =
        TopicBuilder.name(TopicNames.QUEUE_ENTRY_REQUESTED).partitions(6).replicas(1).build()
}
