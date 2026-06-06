package com.ticketrush.seat.favorites

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.mockito.kotlin.*

class FavoriteServiceTest : DescribeSpec({

    fun buildDeps() = object {
        val repo: FavoriteRepository = mock()
        val service: FavoriteService = FavoriteService(repo)
    }

    fun favorite(id: Long = 1L, userId: String = "user1", showId: Long = 1L, seatNumber: String = "A1") =
        FavoriteEntity(id = id, userId = userId, showId = showId, seatNumber = seatNumber)

    describe("add") {

        it("새 즐겨찾기 추가 — Created 반환 및 DB 저장") {
            val d = buildDeps()
            whenever(d.repo.existsByUserIdAndShowIdAndSeatNumber("user1", 1L, "A1")).thenReturn(false)
            whenever(d.repo.save(any())).thenReturn(favorite())

            val result = d.service.add("user1", 1L, "A1")

            result.shouldBeInstanceOf<FavoriteService.AddResult.Created>()
            (result as FavoriteService.AddResult.Created).id shouldBe 1L
            verify(d.repo).save(any())
        }

        it("이미 존재하는 즐겨찾기 — AlreadyExists 반환, DB 저장 없음") {
            val d = buildDeps()
            whenever(d.repo.existsByUserIdAndShowIdAndSeatNumber("user1", 1L, "A1")).thenReturn(true)

            val result = d.service.add("user1", 1L, "A1")

            result shouldBe FavoriteService.AddResult.AlreadyExists
            verify(d.repo, never()).save(any())
        }
    }

    describe("findByUser") {

        it("사용자 즐겨찾기 목록 반환") {
            val d = buildDeps()
            val favs = listOf(favorite(id = 1L, seatNumber = "A1"), favorite(id = 2L, seatNumber = "B2"))
            whenever(d.repo.findAllByUserId("user1")).thenReturn(favs)

            val result = d.service.findByUser("user1")

            result.size shouldBe 2
            result[0].seatNumber shouldBe "A1"
            result[1].seatNumber shouldBe "B2"
        }

        it("즐겨찾기 없는 사용자 — 빈 목록 반환") {
            val d = buildDeps()
            whenever(d.repo.findAllByUserId("user2")).thenReturn(emptyList())

            val result = d.service.findByUser("user2")

            result shouldBe emptyList()
        }
    }

    describe("remove") {

        it("존재하는 즐겨찾기, 본인 요청 — Deleted 반환 및 DB 삭제") {
            val d = buildDeps()
            whenever(d.repo.findById(1L)).thenReturn(java.util.Optional.of(favorite()))

            val result = d.service.remove(1L, "user1")

            result shouldBe FavoriteService.RemoveResult.Deleted
            verify(d.repo).delete(any())
        }

        it("존재하지 않는 즐겨찾기 — NotFound 반환") {
            val d = buildDeps()
            whenever(d.repo.findById(99L)).thenReturn(java.util.Optional.empty())

            val result = d.service.remove(99L, "user1")

            result shouldBe FavoriteService.RemoveResult.NotFound
            verify(d.repo, never()).delete(any())
        }

        it("다른 사용자의 즐겨찾기 삭제 시도 — Forbidden 반환") {
            val d = buildDeps()
            whenever(d.repo.findById(1L)).thenReturn(java.util.Optional.of(favorite(userId = "user1")))

            val result = d.service.remove(1L, "user2")

            result shouldBe FavoriteService.RemoveResult.Forbidden
            verify(d.repo, never()).delete(any())
        }
    }
})
