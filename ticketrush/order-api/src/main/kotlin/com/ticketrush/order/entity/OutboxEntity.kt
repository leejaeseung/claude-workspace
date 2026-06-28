package com.ticketrush.order.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "outbox")
class OutboxEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val aggregateType: String,

    @Column(nullable = false)
    val aggregateId: String,

    @Column(nullable = false)
    val eventType: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    val payload: String,

    @Column(nullable = false)
    var published: Boolean = false,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(nullable = true)
    var publishedAt: Instant? = null,

    @Column(nullable = false)
    var retryCount: Int = 0,
)
