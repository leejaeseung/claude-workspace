package com.ticketrush.order.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.PaymentConfirmedEvent
import com.ticketrush.event.PaymentFailedEvent
import com.ticketrush.event.TopicNames
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.repository.OrderRepository
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class PaymentResultConsumer(
    private val orderRepository: OrderRepository,
    private val objectMapper: ObjectMapper,
) {
    @KafkaListener(topics = [TopicNames.PAYMENT_CONFIRMED], groupId = "order-api")
    @Transactional
    fun onPaymentConfirmed(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), PaymentConfirmedEvent::class.java)
        orderRepository.findById(event.orderId).ifPresent { order ->
            order.status = OrderEntity.OrderStatus.CONFIRMED
            orderRepository.save(order)
        }
    }

    @KafkaListener(topics = [TopicNames.PAYMENT_FAILED], groupId = "order-api")
    @Transactional
    fun onPaymentFailed(record: ConsumerRecord<String, String>) {
        val event = objectMapper.readValue(record.value(), PaymentFailedEvent::class.java)
        orderRepository.findById(event.orderId).ifPresent { order ->
            order.status = OrderEntity.OrderStatus.CANCELLED
            orderRepository.save(order)
        }
    }
}
