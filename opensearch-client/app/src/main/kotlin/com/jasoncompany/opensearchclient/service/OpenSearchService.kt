package com.jasoncompany.opensearchclient.service

import arrow.core.Either
import arrow.core.left
import arrow.core.right
import com.jasoncompany.opensearchclient.config.ConnectionProfile
import com.jasoncompany.opensearchclient.domain.*
import org.opensearch.client.opensearch._types.query_dsl.WildcardQuery
import org.apache.hc.client5.http.auth.AuthScope
import org.apache.hc.client5.http.auth.UsernamePasswordCredentials
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider
import org.apache.hc.client5.http.impl.nio.PoolingAsyncClientConnectionManagerBuilder
import org.apache.hc.client5.http.ssl.ClientTlsStrategyBuilder
import org.apache.hc.client5.http.ssl.NoopHostnameVerifier
import org.apache.hc.core5.http.HttpHost
import org.apache.hc.core5.ssl.SSLContextBuilder
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import org.opensearch.client.json.jackson.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.query_dsl.*
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import java.io.Closeable

/**
 * Wraps OpenSearch Java Client and exposes domain-level operations.
 * All public methods return [Either<SearchError, T>] — callers never deal with exceptions.
 *
 * Lifecycle: call [close] when the profile changes or the app exits.
 */
class OpenSearchService(private val profile: ConnectionProfile) : Closeable {

    private val transport by lazy { buildTransport(profile) }
    private val client by lazy { OpenSearchClient(transport) }

    // ─────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────

    /** Verify that the cluster is reachable. */
    fun ping(): Either<SearchError, Boolean> = runCatching {
        client.ping().value().right()
    }.getOrElse { mapException(it).left() }

    /** Return the list of index names visible to the configured credentials. */
    fun listIndices(): Either<SearchError, List<String>> = runCatching {
        client.cat().indices().valueBody()
            .mapNotNull { it.index() }
            .sorted()
            .right()
    }.getOrElse { mapException(it).left() }

    /**
     * Execute a paginated full-text + filtered search.
     *
     * @param condition  All search parameters.
     * @return Paginated [SearchResult] or a [SearchError].
     */
    fun search(condition: SearchCondition): Either<SearchError, SearchResult> = runCatching {
        val index = condition.index.ifBlank { profile.defaultIndex }
        require(index.isNotBlank()) { "No index specified in condition or profile" }

        val request = SearchRequest.Builder()
            .index(index)
            .from(condition.from)
            .size(condition.pageSize)
            .query(buildQuery(condition))
            .sort(buildSort(condition))
            .build()

        val response = client.search(request, Map::class.java)

        val hits = response.hits().hits().map { hit ->
            @Suppress("UNCHECKED_CAST")
            val rawSource = hit.source() as? Map<String, Any?> ?: emptyMap()
            SearchDocument(
                index = hit.index() ?: index,
                id = hit.id() ?: "",
                score = hit.score()?.toFloat(),
                source = rawSource.mapValues { (_, v) -> v?.toString() ?: "" },
            )
        }

        SearchResult(
            totalHits = response.hits().total()?.value() ?: 0L,
            hits = hits,
            tookMillis = response.took(),
            page = condition.page,
            pageSize = condition.pageSize,
        ).right()
    }.getOrElse { mapException(it).left() }

    // ─────────────────────────────────────────────
    // Query builder
    // ─────────────────────────────────────────────

    private fun buildQuery(condition: SearchCondition): Query {
        val mustClauses = mutableListOf<Query>()
        val filterClauses = mutableListOf<Query>()

        // Full-text keyword
        if (condition.keyword.isNotBlank()) {
            val fields = condition.searchFields.ifEmpty { listOf("*") }
            mustClauses += Query.Builder()
                .multiMatch(
                    MultiMatchQuery.Builder()
                        .query(condition.keyword)
                        .fields(fields)
                        .build()
                ).build()
        }

        // Term filters — dispatch by operator
        condition.termFilters.forEach { tf ->
            when (tf.operator) {
                FilterOperator.EQ -> {
                    filterClauses += Query.Builder()
                        .term(
                            TermQuery.Builder()
                                .field(tf.field)
                                .value(org.opensearch.client.opensearch._types.FieldValue.of(tf.value))
                                .build()
                        ).build()
                }
                FilterOperator.LIKE -> {
                    filterClauses += Query.Builder()
                        .wildcard(
                            WildcardQuery.Builder()
                                .field(tf.field)
                                .value("*${tf.value}*")
                                .caseInsensitive(true)
                                .build()
                        ).build()
                }
                FilterOperator.GT, FilterOperator.GTE, FilterOperator.LT, FilterOperator.LTE -> {
                    // Use WrapperQuery (raw JSON base64) to avoid opensearch-java 3.x
                    // NumberRangeQuery / DateRangeQuery API split (same approach as date rangeFilter below).
                    val opKey = when (tf.operator) {
                        FilterOperator.GT -> "gt"
                        FilterOperator.GTE -> "gte"
                        FilterOperator.LT -> "lt"
                        FilterOperator.LTE -> "lte"
                        else -> "gte"
                    }
                    val rangeJson = """{"range":{"${tf.field}":{"$opKey":"${tf.value}"}}}"""
                    filterClauses += Query.Builder()
                        .wrapper(
                            WrapperQuery.Builder()
                                .query(java.util.Base64.getEncoder().encodeToString(rangeJson.toByteArray()))
                                .build()
                        ).build()
                }
            }
        }

        // Date range — uses WrapperQuery (raw JSON base64) to avoid opensearch-java version-specific
        // typed range query API differences (NumberRangeQuery / DateRangeQuery split in 3.x).
        condition.rangeFilter?.let { rf ->
            val parts = mutableListOf<String>()
            rf.from?.let { parts += "\"gte\":\"$it\"" }
            rf.to?.let { parts += "\"lte\":\"$it\"" }
            if (parts.isNotEmpty()) {
                val rangeJson = """{"range":{"${rf.field}":{${parts.joinToString(",")}}}}"""
                filterClauses += Query.Builder()
                    .wrapper(
                        WrapperQuery.Builder()
                            .query(java.util.Base64.getEncoder().encodeToString(rangeJson.toByteArray()))
                            .build()
                    )
                    .build()
            }
        }

        return if (mustClauses.isEmpty() && filterClauses.isEmpty()) {
            Query.Builder().matchAll(MatchAllQuery.Builder().build()).build()
        } else {
            Query.Builder()
                .bool(
                    BoolQuery.Builder()
                        .must(mustClauses)
                        .filter(filterClauses)
                        .build()
                ).build()
        }
    }

    private fun buildSort(condition: SearchCondition): List<org.opensearch.client.opensearch._types.SortOptions> =
        condition.sortCriteria.map { sc ->
            org.opensearch.client.opensearch._types.SortOptions.Builder()
                .field(
                    org.opensearch.client.opensearch._types.FieldSort.Builder()
                        .field(sc.field)
                        .order(if (sc.direction == SortDirection.ASC) SortOrder.Asc else SortOrder.Desc)
                        .build()
                ).build()
        }

    // ─────────────────────────────────────────────
    // Transport / connection
    // ─────────────────────────────────────────────

    private fun buildTransport(profile: ConnectionProfile): org.opensearch.client.transport.OpenSearchTransport {
        val host = HttpHost(profile.scheme, profile.host, profile.port)

        val tlsStrategy = if (!profile.tlsVerifyEnabled) {
            // Local dev: accept any certificate
            val sslContext = SSLContextBuilder.create()
                .loadTrustMaterial { _, _ -> true }
                .build()
            ClientTlsStrategyBuilder.create()
                .setSslContext(sslContext)
                .setHostnameVerifier(NoopHostnameVerifier.INSTANCE)
                .build()
        } else {
            ClientTlsStrategyBuilder.create().build()
        }

        val connManager = PoolingAsyncClientConnectionManagerBuilder.create()
            .setTlsStrategy(tlsStrategy)
            .build()

        // Jackson mapper with Java 8 time support — required for OpenSearch client (de)serialization
        val objectMapper = ObjectMapper().registerModule(JavaTimeModule())
        val jsonpMapper = JacksonJsonpMapper(objectMapper)

        val builder = ApacheHttpClient5TransportBuilder.builder(host)
            .setMapper(jsonpMapper)
            .setHttpClientConfigCallback { httpClientBuilder ->
                httpClientBuilder.setConnectionManager(connManager)
                if (profile.hasAuth) {
                    val credentialsProvider = BasicCredentialsProvider()
                    credentialsProvider.setCredentials(
                        AuthScope(host),
                        UsernamePasswordCredentials(profile.username, profile.password.toCharArray()),
                    )
                    httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider)
                }
                httpClientBuilder
            }

        return builder.build()
    }

    private fun mapException(t: Throwable): SearchError = when {
        t is org.opensearch.client.opensearch._types.OpenSearchException &&
                t.response().status() == 404 ->
            SearchError.IndexNotFound(t.message ?: "unknown index")

        t is org.opensearch.client.opensearch._types.OpenSearchException &&
                t.response().status() == 401 ->
            SearchError.AuthenticationFailed(t.message ?: "Unauthorized")

        t.message?.contains("Connection refused") == true ||
                t.message?.contains("UnknownHost") == true ->
            SearchError.ConnectionFailed(t.message ?: "Connection failed", t)

        else -> SearchError.UnknownError(t.message ?: "Unexpected error", t)
    }

    override fun close() {
        runCatching { transport.close() }
    }
}
