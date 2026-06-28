package com.ticketrush.domain.queue

data class QueueEntry(
    val userId: String,
    val showId: Long,
    val position: Long,
    val estimatedWaitSeconds: Long,
)
