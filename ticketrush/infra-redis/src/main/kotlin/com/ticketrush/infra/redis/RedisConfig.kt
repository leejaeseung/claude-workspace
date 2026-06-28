package com.ticketrush.infra.redis

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory
import org.springframework.data.redis.connection.RedisStandaloneConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.serializer.RedisSerializationContext

@Configuration
class RedisConfig(
    @Value("\${spring.data.redis.host:localhost}") private val host: String,
    @Value("\${spring.data.redis.port:6379}") private val port: Int,
) {
    @Bean
    fun lettuceConnectionFactory(): LettuceConnectionFactory =
        LettuceConnectionFactory(RedisStandaloneConfiguration(host, port))

    @Bean
    fun stringRedisTemplate(factory: ReactiveRedisConnectionFactory): StringRedisTemplate =
        StringRedisTemplate().apply { connectionFactory = factory as LettuceConnectionFactory }

    @Bean
    fun reactiveRedisTemplate(factory: ReactiveRedisConnectionFactory): ReactiveRedisTemplate<String, String> =
        ReactiveRedisTemplate(factory, RedisSerializationContext.string())
}
