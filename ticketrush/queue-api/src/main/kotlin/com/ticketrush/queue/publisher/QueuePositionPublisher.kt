package com.ticketrush.queue.publisher

import com.ticketrush.infra.redis.RedisKeyspace
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.listener.ChannelTopic
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

@Component
class QueuePositionPublisher(
    private val redisTemplate: ReactiveRedisTemplate<String, String>,
) {
    // Redis Pub/Sub 채널: QUEUE_CHANNEL:{showId}
    private fun channel(showId: Long) = "QUEUE_CHANNEL:$showId"

    fun publish(showId: Long, userId: String, position: Long, waitSeconds: Long): Mono<Long> {
        val payload = """{"userId":"$userId","showId":$showId,"position":$position,"estimatedWaitSeconds":$waitSeconds}"""
        return redisTemplate.convertAndSend(channel(showId), payload)
    }
}
