package com.jasoncompany.opensearchclient.domain

import java.time.Instant

/** Sort direction for a field. */
enum class SortDirection { ASC, DESC }

/** A single sort criterion. */
data class SortCriterion(
    val field: String,
    val direction: SortDirection = SortDirection.DESC,
)

/** Range filter for a date/numeric field. */
data class RangeFilter(
    val field: String,
    val from: Instant? = null,
    val to: Instant? = null,
)

/**
 * Filter operator — determines how a TermFilter value is applied in the query.
 *
 * - EQ:  exact match (term query)
 * - LIKE: wildcard match (*value* pattern)
 * - GT / GTE / LT / LTE: numeric/date range comparisons (range query)
 */
enum class FilterOperator(val label: String) {
    EQ("= (EQ)"),
    LIKE("≈ (LIKE)"),
    GT("> (GT)"),
    GTE("≥ (GTE)"),
    LT("< (LT)"),
    LTE("≤ (LTE)"),
}

/** Term filter — supports multiple operators (EQ, LIKE, GT, GTE, LT, LTE). */
data class TermFilter(
    val field: String,
    val value: String,
    val operator: FilterOperator = FilterOperator.EQ,
)

/**
 * Full search condition submitted to OpenSearch.
 *
 * Supports keyword full-text search combined with arbitrary term filters,
 * an optional date-range restriction, sorting, and pagination.
 */
data class SearchCondition(
    /** Free-text keyword (applied as multi_match across [searchFields]). Empty = match_all. */
    val keyword: String = "",
    /** Fields to run multi_match against. Defaults to _source if empty. */
    val searchFields: List<String> = emptyList(),
    /** Exact-match term filters (AND-combined). */
    val termFilters: List<TermFilter> = emptyList(),
    /** Optional date/numeric range filter. */
    val rangeFilter: RangeFilter? = null,
    /** Sort criteria applied in order. */
    val sortCriteria: List<SortCriterion> = listOf(SortCriterion("_score")),
    /** 0-based page number. */
    val page: Int = 0,
    /** Number of results per page. */
    val pageSize: Int = 20,
    /** OpenSearch index to query. Overrides the profile default when set. */
    val index: String = "",
) {
    val from: Int get() = page * pageSize

    fun isEmpty(): Boolean = keyword.isBlank() && termFilters.isEmpty() && rangeFilter == null
}
