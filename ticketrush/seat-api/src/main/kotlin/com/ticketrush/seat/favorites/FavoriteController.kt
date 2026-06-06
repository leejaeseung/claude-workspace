package com.ticketrush.seat.favorites

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/favorites")
class FavoriteController(private val favoriteService: FavoriteService) {

    data class AddRequest(val userId: String, val showId: Long, val seatNumber: String)
    data class AddResponse(val id: Long, val userId: String, val showId: Long, val seatNumber: String)
    data class FavoriteResponse(val id: Long, val showId: Long, val seatNumber: String, val createdAt: Instant)

    @PostMapping
    fun add(@RequestBody request: AddRequest): ResponseEntity<Any> =
        when (val result = favoriteService.add(request.userId, request.showId, request.seatNumber)) {
            is FavoriteService.AddResult.Created -> ResponseEntity.status(HttpStatus.CREATED).body(
                AddResponse(result.id, request.userId, request.showId, request.seatNumber)
            )
            FavoriteService.AddResult.AlreadyExists -> ResponseEntity.status(HttpStatus.OK).body(
                mapOf("message" to "already exists")
            )
        }

    @GetMapping
    fun list(@RequestParam userId: String): ResponseEntity<List<FavoriteResponse>> {
        val favorites = favoriteService.findByUser(userId).map {
            FavoriteResponse(it.id, it.showId, it.seatNumber, it.createdAt)
        }
        return ResponseEntity.ok(favorites)
    }

    @DeleteMapping("/{id}")
    fun remove(
        @PathVariable id: Long,
        @RequestParam userId: String,
    ): ResponseEntity<Unit> =
        when (favoriteService.remove(id, userId)) {
            FavoriteService.RemoveResult.Deleted -> ResponseEntity.noContent<Unit>().build()
            FavoriteService.RemoveResult.NotFound -> ResponseEntity.notFound<Unit>().build()
            FavoriteService.RemoveResult.Forbidden -> ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        }
}
