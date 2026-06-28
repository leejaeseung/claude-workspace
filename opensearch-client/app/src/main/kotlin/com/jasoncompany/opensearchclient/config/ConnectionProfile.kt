package com.jasoncompany.opensearchclient.config

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

// ─────────────────────────────────────────────
// Domain model
// ─────────────────────────────────────────────

enum class ProfileEnvironment { LOCAL, PRODUCTION }

@Serializable
data class ConnectionProfile(
    val id: String,
    val name: String,
    val environment: ProfileEnvironment,
    val host: String,
    val port: Int,
    val scheme: String = "http",        // "http" or "https"
    val defaultIndex: String = "",
    val username: String = "",
    val password: String = "",          // stored plain-text; encrypt at rest in future sprint
    val tlsVerifyEnabled: Boolean = true,
) {
    val baseUrl: String get() = "$scheme://$host:$port"
    val isLocal: Boolean get() = environment == ProfileEnvironment.LOCAL
    val hasAuth: Boolean get() = username.isNotBlank() && password.isNotBlank()

    companion object {
        /** "http://host:9200" 또는 "https://host" 형식을 파싱. 실패 시 null. */
        fun parseUrl(raw: String): Triple<String, String, Int>? {
            val trimmed = raw.trim().trimEnd('/')
            val regex = Regex("""^(https?)://([^:/\s]+)(?::(\d+))?$""")
            val m = regex.matchEntire(trimmed) ?: return null
            val scheme = m.groupValues[1]
            val host   = m.groupValues[2]
            val port   = m.groupValues[3].toIntOrNull()
                         ?: if (scheme == "https") 443 else 9200
            return Triple(scheme, host, port)
        }
    }
}

// ─────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────

object ConnectionProfileRepository {

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val configDir: File by lazy {
        val dir = File(System.getProperty("user.home"), ".opensearch-client")
        if (!dir.exists()) dir.mkdirs()
        dir
    }

    private val profilesFile: File get() = File(configDir, "profiles.json")

    fun loadAll(): List<ConnectionProfile> {
        if (!profilesFile.exists()) return defaultProfiles()
        return runCatching {
            json.decodeFromString<List<ConnectionProfile>>(profilesFile.readText())
        }.getOrElse { defaultProfiles() }
    }

    fun saveAll(profiles: List<ConnectionProfile>) {
        profilesFile.writeText(json.encodeToString(profiles))
    }

    fun save(profile: ConnectionProfile) {
        val existing = loadAll().toMutableList()
        val idx = existing.indexOfFirst { it.id == profile.id }
        if (idx >= 0) existing[idx] = profile else existing.add(profile)
        saveAll(existing)
    }

    fun delete(profileId: String) {
        val updated = loadAll().filter { it.id != profileId }
        saveAll(updated)
    }

    /** Seed file with two default profiles so the app is usable on first launch. */
    private fun defaultProfiles(): List<ConnectionProfile> {
        val defaults = listOf(
            ConnectionProfile(
                id = "local-default",
                name = "로컬 Docker",
                environment = ProfileEnvironment.LOCAL,
                host = "localhost",
                port = 9200,
                scheme = "http",
                defaultIndex = "",
                username = "",
                password = "",
                tlsVerifyEnabled = false,
            ),
            ConnectionProfile(
                id = "prod-placeholder",
                name = "운영 서버 (설정 필요)",
                environment = ProfileEnvironment.PRODUCTION,
                host = "your-opensearch-host",
                port = 443,
                scheme = "https",
                defaultIndex = "",
                username = "admin",
                password = "",
                tlsVerifyEnabled = true,
            ),
        )
        saveAll(defaults)
        return defaults
    }
}
