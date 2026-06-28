package com.jasoncompany.opensearchclient.domain

/**
 * A single document returned by OpenSearch.
 *
 * @param index  The index the document came from.
 * @param id     The document _id.
 * @param score  Relevance score (null for sorted-only queries).
 * @param source Flat map of field name → string representation of the value.
 *               Complex nested objects are JSON-serialized to string.
 */
data class SearchDocument(
    val index: String,
    val id: String,
    val score: Float?,
    val source: Map<String, String>,
) {
    /** Returns the value of [field] or an empty string if the field is absent. */
    fun field(field: String): String = source[field] ?: ""
}

/**
 * Paginated result set returned from a single search request.
 *
 * @param totalHits   Total number of matching documents in the index.
 * @param hits        The documents on the current page.
 * @param tookMillis  Time the query took on the OpenSearch side (ms).
 * @param page        0-based page number that was requested.
 * @param pageSize    Page size that was requested.
 */
data class SearchResult(
    val totalHits: Long,
    val hits: List<SearchDocument>,
    val tookMillis: Long,
    val page: Int,
    val pageSize: Int,
) {
    val totalPages: Int
        get() = if (pageSize == 0) 0 else ((totalHits + pageSize - 1) / pageSize).toInt()

    val hasNextPage: Boolean get() = page + 1 < totalPages
    val hasPrevPage: Boolean get() = page > 0

    /** All distinct field names found across the current page's hits. */
    val columns: List<String>
        get() = hits.flatMap { it.source.keys }.distinct()

    companion object {
        val EMPTY = SearchResult(
            totalHits = 0,
            hits = emptyList(),
            tookMillis = 0,
            page = 0,
            pageSize = 20,
        )
    }
}

// ─────────────────────────────────────────────
// Domain errors
// ─────────────────────────────────────────────

/** Sealed error hierarchy used with Arrow Either throughout the service layer. */
sealed class SearchError {
    data class ConnectionFailed(val message: String, val cause: Throwable? = null) : SearchError()
    data class QueryFailed(val message: String, val cause: Throwable? = null) : SearchError()
    data class IndexNotFound(val index: String) : SearchError()
    data class AuthenticationFailed(val message: String) : SearchError()
    data class UnknownError(val message: String, val cause: Throwable? = null) : SearchError()
}
