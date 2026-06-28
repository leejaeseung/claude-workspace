package com.ticketrush.event

object TopicNames {
    const val SEAT_CHANGED = "seat.changed"
    const val ORDER_CREATED = "order.created"
    const val ORDER_EXPIRED = "order.expired"
    const val PAYMENT_REQUESTED = "payment.requested"
    const val PAYMENT_CONFIRMED = "payment.confirmed"
    const val PAYMENT_FAILED = "payment.failed"
    const val QUEUE_ENTRY_REQUESTED = "queue.entry.requested"
    const val OUTBOX_RELAY = "outbox.relay"
}
