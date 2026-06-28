package com.ticketrush.domain.queue

import java.time.Instant

data class EntryToken(
    val token: String,
    val userId: String,
    val showId: Long,
    val issuedAt: Instant,
    val expiresAt: Instant,
)
