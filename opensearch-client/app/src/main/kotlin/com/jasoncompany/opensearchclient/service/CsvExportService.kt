package com.jasoncompany.opensearchclient.service

import arrow.core.Either
import arrow.core.left
import arrow.core.right
import com.jasoncompany.opensearchclient.domain.SearchDocument
import com.jasoncompany.opensearchclient.domain.SearchError
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Exports a list of [SearchDocument] to a CSV file.
 *
 * Features:
 * - Caller selects which fields (columns) to include and their order.
 * - Empty [selectedFields] → export all fields found in the result set.
 * - Values are properly escaped per RFC 4180 (quotes, commas, line breaks).
 * - Returns [Either<SearchError, File>] for uniform error handling.
 */
object CsvExportService {

    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")

    /**
     * Write [documents] to a CSV file.
     *
     * @param documents      Documents to export.
     * @param selectedFields Fields to include as columns. Empty = all fields from documents.
     * @param outputDir      Directory to write the file into (defaults to user home).
     * @param fileNamePrefix Prefix for the generated file name.
     * @return [Either.Right] with the written [File], or [Either.Left] with a [SearchError].
     */
    fun export(
        documents: List<SearchDocument>,
        selectedFields: List<String> = emptyList(),
        outputDir: File = File(System.getProperty("user.home")),
        fileNamePrefix: String = "opensearch-export",
    ): Either<SearchError, File> = Either.catch {
        if (documents.isEmpty()) {
            throw IllegalArgumentException("No documents to export")
        }

        val columns: List<String> = if (selectedFields.isNotEmpty()) {
            selectedFields
        } else {
            documents.flatMap { it.source.keys }.distinct()
        }

        val timestamp = LocalDateTime.now().format(timestampFormatter)
        val outputFile = File(outputDir, "${fileNamePrefix}_$timestamp.csv")

        if (!outputDir.exists()) outputDir.mkdirs()

        PrintWriter(FileWriter(outputFile, Charsets.UTF_8)).use { writer ->
            // BOM for Excel UTF-8 compatibility
            writer.print('﻿')

            // Header row — include _index and _id as first two columns
            val header = buildList {
                add("_index")
                add("_id")
                add("_score")
                addAll(columns)
            }
            writer.println(header.joinToString(",") { escapeCsv(it) })

            // Data rows
            documents.forEach { doc ->
                val row = buildList {
                    add(doc.index)
                    add(doc.id)
                    add(doc.score?.toString() ?: "")
                    columns.forEach { col -> add(doc.source[col] ?: "") }
                }
                writer.println(row.joinToString(",") { escapeCsv(it) })
            }
        }

        outputFile
    }.mapLeft { t ->
        SearchError.UnknownError("CSV export failed: ${t.message}", t)
    }

    /**
     * Escape a single CSV field value per RFC 4180.
     * Wraps value in double-quotes if it contains comma, double-quote, or newline.
     * Existing double-quotes are doubled.
     */
    private fun escapeCsv(value: String): String {
        val needsQuoting = value.contains(',') || value.contains('"') ||
                value.contains('\n') || value.contains('\r')
        return if (needsQuoting) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }
}
