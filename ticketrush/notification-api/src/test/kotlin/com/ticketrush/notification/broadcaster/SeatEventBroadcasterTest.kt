package com.ticketrush.notification.broadcaster

import com.ticketrush.event.SeatChangedEvent
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import reactor.test.StepVerifier

class SeatEventBroadcasterTest : DescribeSpec({

    describe("SeatEventBroadcaster") {

        it("subscribe 후 publish — 구독자가 이벤트를 수신한다") {
            val broadcaster = SeatEventBroadcaster()
            val event = SeatChangedEvent(seatId = 1L, showId = 100L, status = "LOCKED")

            StepVerifier.create(broadcaster.subscribe(100L))
                .then { broadcaster.publish(event) }
                .expectNextMatches { it.seatId == 1L && it.status == "LOCKED" }
                .thenCancel()
                .verify()
        }

        it("같은 showId의 여러 이벤트를 순서대로 수신한다") {
            val broadcaster = SeatEventBroadcaster()
            val e1 = SeatChangedEvent(seatId = 1L, showId = 100L, status = "LOCKED")
            val e2 = SeatChangedEvent(seatId = 2L, showId = 100L, status = "CONFIRMED")

            StepVerifier.create(broadcaster.subscribe(100L))
                .then {
                    broadcaster.publish(e1)
                    broadcaster.publish(e2)
                }
                .expectNextMatches { it.seatId == 1L }
                .expectNextMatches { it.seatId == 2L }
                .thenCancel()
                .verify()
        }

        it("다른 showId로 publish한 이벤트는 수신하지 않는다") {
            val broadcaster = SeatEventBroadcaster()
            val event = SeatChangedEvent(seatId = 1L, showId = 200L, status = "LOCKED")

            StepVerifier.create(broadcaster.subscribe(100L))
                .then { broadcaster.publish(event) }   // showId=200 → showId=100 구독자에게 전달 없음
                .expectNoEvent(java.time.Duration.ofMillis(100))
                .thenCancel()
                .verify()
        }

        it("구독자 없는 showId로 publish — 예외 없이 무시된다") {
            val broadcaster = SeatEventBroadcaster()
            val event = SeatChangedEvent(seatId = 5L, showId = 999L, status = "AVAILABLE")

            // sink가 없으면 tryEmitNext를 호출하지 않으므로 예외가 발생하지 않아야 한다
            broadcaster.publish(event)  // 예외 없이 통과해야 함
        }

        it("두 번째 subscribe 시 새 구독자도 이후 이벤트를 수신한다") {
            val broadcaster = SeatEventBroadcaster()
            val event = SeatChangedEvent(seatId = 3L, showId = 100L, status = "CONFIRMED")

            // 첫 번째 구독
            val flux1 = broadcaster.subscribe(100L)
            // 두 번째 구독 (동일 showId)
            val flux2 = broadcaster.subscribe(100L)

            var received1 = false
            var received2 = false
            val sub1 = flux1.subscribe { received1 = true }
            val sub2 = flux2.subscribe { received2 = true }

            broadcaster.publish(event)

            // 두 구독자 모두 이벤트를 수신해야 한다
            Thread.sleep(50)  // 비동기 emit 대기
            received1 shouldBe true
            received2 shouldBe true

            sub1.dispose()
            sub2.dispose()
        }
    }

    describe("QueueEventBroadcaster") {

        it("userId@showId 기반으로 특정 사용자에게만 이벤트를 전달한다") {
            val broadcaster = QueueEventBroadcaster()
            val payload = """{"position":5}"""

            StepVerifier.create(broadcaster.subscribe("user-1", 1L))
                .then { broadcaster.publish("user-1", 1L, payload) }
                .expectNext(payload)
                .thenCancel()
                .verify()
        }

        it("다른 userId로 publish한 이벤트는 수신하지 않는다") {
            val broadcaster = QueueEventBroadcaster()

            StepVerifier.create(broadcaster.subscribe("user-1", 1L))
                .then { broadcaster.publish("user-2", 1L, """{"position":1}""") }
                .expectNoEvent(java.time.Duration.ofMillis(100))
                .thenCancel()
                .verify()
        }

        it("구독자 없는 채널에 publish — 예외 없이 무시된다") {
            val broadcaster = QueueEventBroadcaster()
            broadcaster.publish("ghost-user", 99L, """{"position":100}""")
        }
    }
})
