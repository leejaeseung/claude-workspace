package com.jasoncompany.opensearchclient.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ViewColumn
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jasoncompany.opensearchclient.domain.SearchDocument
import com.jasoncompany.opensearchclient.domain.SearchResult

/**
 * Scrollable result table with:
 * - Dynamic columns derived from current page's hits
 * - Column visibility toggles (field selector)
 * - Row click → detail view
 * - Pagination controls
 * - CSV export trigger
 */
@Composable
fun ResultTable(
    result: SearchResult,
    isLoading: Boolean,
    errorMessage: String?,
    onPageChange: (Int) -> Unit,
    onExport: (selectedFields: List<String>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val allColumns = result.columns
    // Column visibility: default all visible
    val visibleColumns = remember(allColumns) {
        mutableStateMapOf<String, Boolean>().also { map ->
            allColumns.forEach { map[it] = true }
        }
    }
    var selectedDocument by remember { mutableStateOf<SearchDocument?>(null) }
    var showColumnSelector by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        // ── Status / info bar ────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (errorMessage != null) {
                Text(errorMessage, color = MaterialTheme.colors.error, style = MaterialTheme.typography.body2)
            } else {
                // Chip 느낌의 결과 건수 표시
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colors.primary.copy(alpha = 0.1f),
                ) {
                    Text(
                        "${result.totalHits}건 · ${result.tookMillis}ms · ${result.page + 1}/${result.totalPages.coerceAtLeast(1)}p",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.caption.copy(color = MaterialTheme.colors.primary),
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                OutlinedButton(
                    onClick = { showColumnSelector = !showColumnSelector },
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colors.primary.copy(alpha = 0.4f)),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Icon(Icons.Default.ViewColumn, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("컬럼", fontSize = 12.sp)
                }
                OutlinedButton(
                    onClick = {
                        val selected = allColumns.filter { visibleColumns[it] == true }
                        onExport(selected)
                    },
                    enabled = result.hits.isNotEmpty(),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colors.primary.copy(alpha = 0.4f)),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Icon(Icons.Default.Download, contentDescription = "CSV 내보내기", modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("CSV", fontSize = 12.sp)
                }
            }
        }

        // ── Column selector dropdown ──────────────────────────────────
        if (showColumnSelector && allColumns.isNotEmpty()) {
            Card(
                elevation = 4.dp,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(horizontal = 12.dp),
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text("표시할 컬럼 선택", style = MaterialTheme.typography.subtitle2)
                    allColumns.forEach { col ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = visibleColumns[col] == true,
                                onCheckedChange = { visibleColumns[col] = it },
                            )
                            Text(col, style = MaterialTheme.typography.body2)
                        }
                    }
                }
            }
        }

        // ── Loading overlay ───────────────────────────────────────────
        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(60.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        // ── Table ─────────────────────────────────────────────────────
        if (result.hits.isNotEmpty()) {
            val displayColumns = listOf("_id", "_score") + allColumns.filter { visibleColumns[it] == true }
            val colWidth = 160.dp
            val horizontalScroll = rememberScrollState()

            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(horizontalScroll)
                    .background(MaterialTheme.colors.primary)
                    .padding(vertical = 8.dp),
            ) {
                displayColumns.forEach { col ->
                    Text(
                        text = col,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        modifier = Modifier.width(colWidth).padding(horizontal = 10.dp),
                        maxLines = 1,
                        fontSize = 12.sp,
                    )
                }
            }

            val listState = rememberLazyListState()
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
            ) {
                items(result.hits.indices.toList()) { rowIdx ->
                    val doc = result.hits[rowIdx]
                    val bg = if (rowIdx % 2 == 0) Color.White else Color(0xFFF8FAFC)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(bg)
                            .clickable { selectedDocument = doc }
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 6.dp),
                    ) {
                        displayColumns.forEach { col ->
                            val value = when (col) {
                                "_id" -> doc.id
                                "_score" -> doc.score?.toString() ?: "-"
                                else -> doc.source[col] ?: ""
                            }
                            Text(
                                text = value,
                                modifier = Modifier.width(colWidth).padding(horizontal = 8.dp),
                                maxLines = 1,
                                fontSize = 12.sp,
                            )
                        }
                    }
                    Divider(thickness = 0.5.dp, color = Color(0xFFE2E8F0))
                }
            }
        } else if (!isLoading && errorMessage == null) {
            // 빈 상태 개선
            Column(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = Color(0xFFCBD5E1),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "검색 조건을 입력하고 검색 버튼을 누르세요",
                    style = MaterialTheme.typography.body2,
                    color = Color(0xFF94A3B8),
                )
            }
        } else {
            Spacer(Modifier.weight(1f))
        }

        // ── Pagination ────────────────────────────────────────────────
        if (result.totalPages > 1) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedButton(
                    onClick = { onPageChange(result.page - 1) },
                    enabled = result.hasPrevPage,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "이전", modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("이전", fontSize = 12.sp)
                }
                Text(
                    "${result.page + 1} / ${result.totalPages}",
                    style = MaterialTheme.typography.body2,
                    fontWeight = FontWeight.Medium,
                )
                OutlinedButton(
                    onClick = { onPageChange(result.page + 1) },
                    enabled = result.hasNextPage,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text("다음", fontSize = 12.sp)
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Default.ArrowForward, contentDescription = "다음", modifier = Modifier.size(16.dp))
                }
            }
        }
    }

    // ── Document detail dialog ────────────────────────────────────────
    selectedDocument?.let { doc ->
        AlertDialog(
            onDismissRequest = { selectedDocument = null },
            title = { Text("문서 상세: ${doc.id}") },
            text = {
                val scroll = rememberScrollState()
                Column(modifier = Modifier.verticalScroll(scroll)) {
                    Text("인덱스: ${doc.index}", style = MaterialTheme.typography.caption)
                    Text("Score: ${doc.score ?: "-"}", style = MaterialTheme.typography.caption)
                    Spacer(Modifier.height(8.dp))
                    doc.source.entries.sortedBy { it.key }.forEach { (k, v) ->
                        Row(modifier = Modifier.padding(vertical = 2.dp)) {
                            Text(
                                "$k:",
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.widthIn(min = 120.dp),
                                fontSize = 12.sp,
                            )
                            Text(v, fontSize = 12.sp)
                        }
                        Divider(thickness = 0.5.dp, color = Color(0xFFE2E8F0))
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedDocument = null }) { Text("닫기") }
            },
        )
    }
}
