package com.jasoncompany.opensearchclient.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import arrow.core.getOrElse
import com.jasoncompany.opensearchclient.config.ConnectionProfile
import com.jasoncompany.opensearchclient.config.ConnectionProfileRepository
import com.jasoncompany.opensearchclient.config.ProfileEnvironment
import com.jasoncompany.opensearchclient.domain.SearchCondition
import com.jasoncompany.opensearchclient.domain.SearchResult
import com.jasoncompany.opensearchclient.service.CsvExportService
import com.jasoncompany.opensearchclient.service.OpenSearchService
import androidx.compose.ui.text.input.PasswordVisualTransformation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Application root composable.
 *
 * Owns:
 * - Connection profile list and active profile selection
 * - OpenSearchService lifecycle (recreated on profile change)
 * - Search state machine (idle → loading → result/error)
 * - Available indices cache
 * - CSV export trigger
 *
 * Delegates UI to [SearchPanel] and [ResultTable].
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun MainScreen() {
    val scope = rememberCoroutineScope()

    // ── Profile state ─────────────────────────────────────────────────
    var profiles by remember { mutableStateOf(ConnectionProfileRepository.loadAll()) }
    var activeProfileId by remember { mutableStateOf(profiles.firstOrNull()?.id ?: "") }
    val activeProfile = profiles.find { it.id == activeProfileId }

    var showProfileDialog by remember { mutableStateOf(false) }
    var editingProfile by remember { mutableStateOf<ConnectionProfile?>(null) }

    // ── OpenSearch service ────────────────────────────────────────────
    // Recreate service whenever the active profile changes
    val service: OpenSearchService? by remember(activeProfileId) {
        derivedStateOf {
            profiles.find { it.id == activeProfileId }?.let { OpenSearchService(it) }
        }
    }
    DisposableEffect(activeProfileId) { onDispose { service?.close() } }

    // ── Search state ──────────────────────────────────────────────────
    var searchResult by remember { mutableStateOf(SearchResult.EMPTY) }
    var isSearching by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var lastCondition by remember { mutableStateOf<SearchCondition?>(null) }

    // ── Indices cache ─────────────────────────────────────────────────
    var availableIndices by remember(activeProfileId) { mutableStateOf(emptyList<String>()) }

    // Reload index list when profile changes
    LaunchedEffect(activeProfileId, service) {
        val svc = service ?: return@LaunchedEffect
        withContext(Dispatchers.IO) {
            svc.listIndices()
                .onRight { availableIndices = it }
        }
    }

    // ── Export snackbar ───────────────────────────────────────────────
    val scaffoldState = rememberScaffoldState()

    // ── Search handler ────────────────────────────────────────────────
    fun executeSearch(condition: SearchCondition) {
        val svc = service ?: return
        lastCondition = condition
        isSearching = true
        errorMessage = null
        scope.launch {
            withContext(Dispatchers.IO) {
                svc.search(condition)
            }.fold(
                ifLeft = {
                    isSearching = false
                    errorMessage = "검색 오류: $it"
                },
                ifRight = {
                    isSearching = false
                    searchResult = it
                },
            )
        }
    }

    fun executePageChange(page: Int) {
        lastCondition?.let { executeSearch(it.copy(page = page)) }
    }

    // ── CSV export handler ────────────────────────────────────────────
    fun exportCsv(selectedFields: List<String>) {
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                CsvExportService.export(
                    documents = searchResult.hits,
                    selectedFields = selectedFields,
                )
            }
            result.fold(
                ifLeft = { scaffoldState.snackbarHostState.showSnackbar("내보내기 실패: $it") },
                ifRight = { scaffoldState.snackbarHostState.showSnackbar("저장됨: ${it.absolutePath}") },
            )
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────────
    Scaffold(
        scaffoldState = scaffoldState,
        topBar = {
            TopAppBar(
                backgroundColor = MaterialTheme.colors.primary,
                elevation = 0.dp,
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        // 작은 원형 아이콘 영역
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White.copy(alpha = 0.2f),
                            modifier = Modifier.size(32.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.Search,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                        Text(
                            "OpenSearch Client",
                            color = Color.White,
                            style = MaterialTheme.typography.h6,
                        )
                    }
                },
                actions = {
                    profiles.forEachIndexed { _, p ->
                        val isActive = p.id == activeProfileId
                        Surface(
                            onClick = { activeProfileId = p.id },
                            shape = RoundedCornerShape(20.dp),
                            color = if (isActive) Color.White.copy(alpha = 0.25f) else Color.Transparent,
                            border = if (isActive) null else BorderStroke(1.dp, Color.White.copy(alpha = 0.4f)),
                            modifier = Modifier.padding(end = 6.dp, top = 8.dp, bottom = 8.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                // 환경 인디케이터 점
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(
                                            if (p.environment == ProfileEnvironment.PRODUCTION)
                                                Color(0xFFFBBF24) else Color(0xFF4ADE80),
                                            CircleShape,
                                        ),
                                )
                                Text(
                                    p.name,
                                    color = Color.White,
                                    style = MaterialTheme.typography.caption.copy(fontWeight = FontWeight.Medium),
                                )
                            }
                        }
                    }
                    IconButton(onClick = { editingProfile = null; showProfileDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "프로파일 추가", tint = Color.White)
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            activeProfile?.let { profile ->
                Column(modifier = Modifier.fillMaxSize()) {
                    // Top: search panel
                    Surface(elevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
                        SearchPanel(
                            profile = profile,
                            availableIndices = availableIndices,
                            isSearching = isSearching,
                            onSearch = ::executeSearch,
                            onOpenProfileSettings = {
                                editingProfile = profile
                                showProfileDialog = true
                            },
                        )
                    }

                    // Bottom: result table
                    ResultTable(
                        result = searchResult,
                        isLoading = isSearching,
                        errorMessage = errorMessage,
                        onPageChange = ::executePageChange,
                        onExport = ::exportCsv,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    )
                }
            } ?: run {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("프로파일이 없습니다. 상단 + 버튼으로 추가하세요.")
                }
            }
        }
    }

    // ── Profile dialog ─────────────────────────────────────────────────
    if (showProfileDialog) {
        ProfileDialog(
            initial = editingProfile,
            onConfirm = { p ->
                ConnectionProfileRepository.save(p)
                profiles = ConnectionProfileRepository.loadAll()
                if (editingProfile == null) activeProfileId = p.id
                showProfileDialog = false
            },
            onDelete = { p ->
                ConnectionProfileRepository.delete(p.id)
                profiles = ConnectionProfileRepository.loadAll()
                if (activeProfileId == p.id) activeProfileId = profiles.firstOrNull()?.id ?: ""
                showProfileDialog = false
            },
            onDismiss = { showProfileDialog = false },
        )
    }
}

// ─────────────────────────────────────────────
// Profile add/edit dialog
// ─────────────────────────────────────────────

@Composable
private fun ProfileDialog(
    initial: ConnectionProfile?,
    onConfirm: (ConnectionProfile) -> Unit,
    onDelete: (ConnectionProfile) -> Unit,
    onDismiss: () -> Unit,
) {
    // URL 단일 입력 — 기존 profile이 있으면 baseUrl, 없으면 기본값
    var url by remember {
        mutableStateOf(
            if (initial != null) "${initial.scheme}://${initial.host}:${initial.port}"
            else "http://localhost:9200"
        )
    }
    var urlError by remember { mutableStateOf(false) }

    var name         by remember { mutableStateOf(initial?.name ?: "") }
    var defaultIndex by remember { mutableStateOf(initial?.defaultIndex ?: "") }
    var username     by remember { mutableStateOf(initial?.username ?: "") }
    var password     by remember { mutableStateOf(initial?.password ?: "") }
    var isProduction by remember { mutableStateOf(initial?.environment == ProfileEnvironment.PRODUCTION) }
    var tlsVerify    by remember { mutableStateOf(initial?.tlsVerifyEnabled ?: false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "프로파일 추가" else "프로파일 편집") },
        text = {
            val scroll = androidx.compose.foundation.rememberScrollState()
            Column(
                modifier = Modifier.verticalScroll(scroll).width(420.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // 프로파일 이름
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("프로파일 이름") },
                    modifier = Modifier.fillMaxWidth(),
                )

                // URL 단일 입력 (scheme/host/port 자동 파싱)
                OutlinedTextField(
                    value = url,
                    onValueChange = { v ->
                        url = v
                        urlError = false
                        ConnectionProfile.parseUrl(v)?.let { (scheme, _, _) ->
                            if (scheme == "https") { isProduction = true; tlsVerify = true }
                            else                   { isProduction = false; tlsVerify = false }
                        }
                    },
                    label = { Text("URL") },
                    placeholder = { Text("http://localhost:9200") },
                    isError = urlError,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (urlError) {
                    Text(
                        "올바른 URL 형식을 입력하세요 (예: http://localhost:9200)",
                        color = MaterialTheme.colors.error,
                        style = MaterialTheme.typography.caption,
                    )
                }

                // 사용자명
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("사용자명 (선택)") },
                    modifier = Modifier.fillMaxWidth(),
                )

                // 비밀번호 — 마스킹 처리
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("비밀번호 (선택)") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )

                // 기본 인덱스
                OutlinedTextField(
                    value = defaultIndex,
                    onValueChange = { defaultIndex = it },
                    label = { Text("기본 인덱스 (선택)") },
                    modifier = Modifier.fillMaxWidth(),
                )

                Divider()

                // 운영 서버 / TLS 체크박스 — URL 변경 시 자동 갱신, 수동 덮어쓰기 가능
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = isProduction, onCheckedChange = { isProduction = it })
                        Text("운영 서버 (PRODUCTION)")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = tlsVerify, onCheckedChange = { tlsVerify = it })
                        Text("TLS 인증서 검증")
                    }
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (initial != null) {
                    IconButton(onClick = { onDelete(initial) }) {
                        Icon(Icons.Default.Delete, contentDescription = "삭제", tint = MaterialTheme.colors.error)
                    }
                }
                TextButton(onClick = onDismiss) { Text("취소") }
                Button(onClick = {
                    val parsed = ConnectionProfile.parseUrl(url)
                    if (parsed == null) {
                        urlError = true
                        return@Button
                    }
                    val (scheme, host, port) = parsed
                    val profile = ConnectionProfile(
                        id               = initial?.id ?: UUID.randomUUID().toString(),
                        name             = name.trim().ifBlank { host },
                        environment      = if (isProduction) ProfileEnvironment.PRODUCTION else ProfileEnvironment.LOCAL,
                        host             = host,
                        port             = port,
                        scheme           = scheme,
                        defaultIndex     = defaultIndex.trim(),
                        username         = username.trim(),
                        password         = password,
                        tlsVerifyEnabled = tlsVerify,
                    )
                    onConfirm(profile)
                }) { Text("저장") }
            }
        },
    )
}
