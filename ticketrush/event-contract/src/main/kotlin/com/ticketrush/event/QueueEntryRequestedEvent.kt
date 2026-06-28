package com.ticketrush.event

import java.time.Instant

data class QueueEntryRequestedEvent(
    val userId: String,
    val showId: Long,
    val timestamp: Instant = Instant.now(),
)
