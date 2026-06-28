package com.jasoncompany.opensearchclient.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.jasoncompany.opensearchclient.config.ConnectionProfile
import com.jasoncompany.opensearchclient.domain.FilterOperator
import com.jasoncompany.opensearchclient.domain.RangeFilter
import com.jasoncompany.opensearchclient.domain.SearchCondition
import com.jasoncompany.opensearchclient.domain.SortCriterion
import com.jasoncompany.opensearchclient.domain.SortDirection
import com.jasoncompany.opensearchclient.domain.TermFilter
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeParseException

private class FilterRowState {
    val field            = mutableStateOf("")
    val operator         = mutableStateOf(FilterOperator.EQ)
    val value            = mutableStateOf("")
    val operatorExpanded = mutableStateOf(false)
}

@Composable
fun SearchPanel(
    profile: ConnectionProfile,
    availableIndices: List<String>,
    isSearching: Boolean,
    onSearch: (SearchCondition) -> Unit,
    onOpenProfileSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var keyword       by remember { mutableStateOf("") }
    var selectedIndex by remember(profile) { mutableStateOf(profile.defaultIndex) }
    var indexExpanded by remember { mutableStateOf(false) }
    val filterRows     = remember { mutableStateListOf(FilterRowState()) }
    var rangeField    by remember { mutableStateOf("") }
    var rangeFrom     by remember { mutableStateOf("") }
    var rangeTo       by remember { mutableStateOf("") }
    var sortField     by remember { mutableStateOf("_score") }
    var sortDesc      by remember { mutableStateOf(true) }
    var pageSize      by remember { mutableStateOf("20") }

    fun parseDate(text: String, endOfDay: Boolean = false) = text.trim()
        .takeIf { it.isNotBlank() }
        ?.let {
            try {
                val ld = LocalDate.parse(it)
                if (endOfDay) ld.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
                else ld.atStartOfDay(ZoneOffset.UTC).toInstant()
            } catch (_: DateTimeParseException) { null }
        }

    fun buildCondition() = SearchCondition(
        keyword = keyword.trim(),
        index = selectedIndex.trim(),
        termFilters = filterRows
            .filter { it.field.value.isNotBlank() && it.value.value.isNotBlank() }
            .map { TermFilter(it.field.value.trim(), it.value.value.trim(), it.operator.value) },
        rangeFilter = if (rangeField.isNotBlank()) {
            val from = parseDate(rangeFrom)
            val to   = parseDate(rangeTo, endOfDay = true)
            if (from != null || to != null) RangeFilter(rangeField.trim(), from, to) else null
        } else null,
        sortCriteria = listOf(SortCriterion(
            field = sortField.trim().ifBlank { "_score" },
            direction = if (sortDesc) SortDirection.DESC else SortDirection.ASC,
        )),
        pageSize = pageSize.toIntOrNull()?.coerceIn(5, 500) ?: 20,
    )

    Surface(modifier = modifier, color = MaterialTheme.colors.surface) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {

            // ── 프로파일 바 ─────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${if (profile.isLocal) "LOCAL" else "PROD"}  •  ${profile.name}  (${profile.baseUrl})",
                    style = MaterialTheme.typography.caption,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onOpenProfileSettings, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Settings, contentDescription = "설정", modifier = Modifier.size(16.dp))
                }
            }

            Divider(modifier = Modifier.padding(vertical = 4.dp))

            // ── 행 1: 인덱스 + 키워드 + 페이지크기 + 검색 버튼 ─────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // 인덱스 드롭다운
                Box(modifier = Modifier.weight(1f)) {
                    CF(
                        value = selectedIndex,
                        onValueChange = { selectedIndex = it },
                        hint = "인덱스",
                        trailingIcon = if (availableIndices.isNotEmpty()) ({
                            IconButton(onClick = { indexExpanded = true }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(14.dp))
                            }
                        }) else null,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    DropdownMenu(expanded = indexExpanded, onDismissRequest = { indexExpanded = false }) {
                        availableIndices.forEach { idx ->
                            DropdownMenuItem(onClick = { selectedIndex = idx; indexExpanded = false }) {
                                Text(idx, style = MaterialTheme.typography.body2)
                            }
                        }
                    }
                }

                // 키워드
                CF(
                    value = keyword,
                    onValueChange = { keyword = it },
                    hint = "키워드 검색",
                    modifier = Modifier.weight(2.5f),
                    keyboardOptions = KeyboardOptions.Default.copy(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { onSearch(buildCondition()) }),
                )

                // 페이지 크기
                CF(
                    value = pageSize,
                    onValueChange = { pageSize = it },
                    hint = "크기",
                    modifier = Modifier.width(60.dp),
                )

                // 검색 버튼
                Button(
                    onClick = { onSearch(buildCondition()) },
                    enabled = !isSearching,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.height(46.dp).width(88.dp),
                    elevation = ButtonDefaults.elevation(defaultElevation = 2.dp),
                ) {
                    if (isSearching) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = Color.White)
                    } else {
                        Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("검색", style = MaterialTheme.typography.button)
                    }
                }
            }

            Divider(modifier = Modifier.padding(vertical = 4.dp))

            // ── 행 2: 필터 ──────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // 레이블
                Text(
                    "필터",
                    style = MaterialTheme.typography.caption,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.width(32.dp).padding(top = 14.dp),
                )

                // 필터 행들
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    filterRows.forEachIndexed { idx, row ->
                        var field      by row.field
                        var operator   by row.operator
                        var opExpanded by row.operatorExpanded
                        var value      by row.value

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            CF(value = field, onValueChange = { field = it }, hint = "필드명", modifier = Modifier.weight(1f))

                            Box {
                                OutlinedButton(
                                    onClick = { opExpanded = true },
                                    shape = RoundedCornerShape(6.dp),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                                    modifier = Modifier.width(96.dp).height(46.dp),
                                ) {
                                    Text(operator.label, style = MaterialTheme.typography.caption)
                                }
                                DropdownMenu(expanded = opExpanded, onDismissRequest = { opExpanded = false }) {
                                    FilterOperator.values().forEach { op ->
                                        DropdownMenuItem(onClick = { operator = op; opExpanded = false }) {
                                            Text(op.label, style = MaterialTheme.typography.body2)
                                        }
                                    }
                                }
                            }

                            CF(value = value, onValueChange = { value = it }, hint = "값", modifier = Modifier.weight(1.2f))

                            IconButton(
                                onClick = { filterRows.removeAt(idx) },
                                enabled = filterRows.size > 1,
                                modifier = Modifier.size(28.dp),
                            ) {
                                Icon(
                                    Icons.Default.Close, contentDescription = "삭제",
                                    modifier = Modifier.size(12.dp),
                                    tint = if (filterRows.size > 1) MaterialTheme.colors.error
                                           else MaterialTheme.colors.onSurface.copy(alpha = 0.2f),
                                )
                            }
                        }
                    }
                }

                // + 추가 버튼
                TextButton(
                    onClick = { filterRows.add(FilterRowState()) },
                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                    modifier = Modifier.padding(top = 4.dp),
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(2.dp))
                    Text("추가", style = MaterialTheme.typography.caption)
                }
            }

            Divider(modifier = Modifier.padding(vertical = 4.dp))

            // ── 행 3: 기간 범위 + 정렬 ──────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // 기간 레이블
                Text(
                    "기간",
                    style = MaterialTheme.typography.caption,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.width(32.dp),
                )
                CF(value = rangeField, onValueChange = { rangeField = it }, hint = "필드명", modifier = Modifier.weight(0.8f))
                CF(value = rangeFrom,  onValueChange = { rangeFrom  = it }, hint = "시작 날짜",  modifier = Modifier.weight(1.1f))
                Text("~", style = MaterialTheme.typography.body2, color = Color(0xFF94A3B8))
                CF(value = rangeTo,    onValueChange = { rangeTo    = it }, hint = "종료 날짜",  modifier = Modifier.weight(1.1f))

                Spacer(Modifier.width(12.dp))

                // 정렬 레이블
                Text(
                    "정렬",
                    style = MaterialTheme.typography.caption,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.width(32.dp),
                )
                CF(value = sortField, onValueChange = { sortField = it }, hint = "필드명", modifier = Modifier.weight(0.9f))

                // DESC / ASC 토글
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    listOf(true to "DESC", false to "ASC").forEach { (isDesc, label) ->
                        val selected = sortDesc == isDesc
                        OutlinedButton(
                            onClick = { sortDesc = isDesc },
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                            modifier = Modifier.height(46.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                backgroundColor = if (selected) MaterialTheme.colors.primary.copy(alpha = 0.1f)
                                                  else Color.Transparent,
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                width = if (selected) 1.5.dp else 1.dp,
                                color = if (selected) MaterialTheme.colors.primary
                                        else MaterialTheme.colors.onSurface.copy(alpha = 0.3f),
                            ),
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.caption,
                                color = if (selected) MaterialTheme.colors.primary
                                        else MaterialTheme.colors.onSurface.copy(alpha = 0.6f),
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Compact OutlinedTextField 헬퍼 ───────────────────────────────────

@Composable
private fun CF(
    value: String,
    onValueChange: (String) -> Unit,
    hint: String,
    modifier: Modifier = Modifier,
    trailingIcon: (@Composable () -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(hint, style = MaterialTheme.typography.body2, color = Color(0xFFCBD5E1)) },
        singleLine = true,
        textStyle = MaterialTheme.typography.body2,
        trailingIcon = trailingIcon,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier,
    )
}
