package com.ticketrush.notification.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer

@Configuration
class NotificationRedisConfig {

    @Bean
    fun reactiveRedisMessageListenerContainer(
        factory: ReactiveRedisConnectionFactory,
    ): ReactiveRedisMessageListenerContainer =
        ReactiveRedisMessageListenerContainer(factory)
}
