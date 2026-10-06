import * as SQLite from "expo-sqlite";

const DB_NAME = "recipe-voice-app.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
  }
  return dbInstance;
}

/**
 * 오프라인 우선 로컬 스키마. 서버(PostgreSQL)는 동일 구조 + user_id 컬럼을 갖는다.
 * 동기화는 updated_at 최신값 우선(last-write-wins) + deleted_at 툼스톤으로 처리한다.
 */
export async function migrateDatabase(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      total_time_minutes INTEGER,
      servings INTEGER,
      source TEXT NOT NULL CHECK(source IN ('voice','manual')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      timer_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, tag_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
      recipe_id UNINDEXED,
      title,
      ingredients_blob,
      tokenize='trigram'
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create','update','delete')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  await migrateEnglishUnitsToKorean(db);
}

/**
 * 초기 버전은 단위를 g/kg/tbsp/tsp/count 같은 영문 코드로 저장했다(TTS로 읽으면 발음이 어색함).
 * 이미 그 버전으로 설치해서 영문 단위가 저장된 기기를 위한 1회성 보정 — 매번 실행해도
 * 안전하다(값이 이미 한글이면 WHERE 조건에 안 걸려 아무 일도 안 일어남).
 * 'count'는 예전엔 개/모/대/공기를 전부 뭉쳐놓은 값이라, 재료명으로 원래 세는 말을 되돌리고
 * 나머지는 '개'로 되돌린다.
 */
async function migrateEnglishUnitsToKorean(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE ingredients SET unit = '그램' WHERE unit = 'g';
    UPDATE ingredients SET unit = '킬로그램' WHERE unit = 'kg';
    UPDATE ingredients SET unit = '밀리리터' WHERE unit = 'ml';
    UPDATE ingredients SET unit = '리터' WHERE unit = 'l';
    UPDATE ingredients SET unit = '큰술' WHERE unit = 'tbsp';
    UPDATE ingredients SET unit = '작은술' WHERE unit = 'tsp';
    UPDATE ingredients SET unit = '컵' WHERE unit = 'cup';
    UPDATE ingredients SET unit = '약간' WHERE unit = 'pinch';
    UPDATE ingredients SET unit = '모' WHERE unit = 'count' AND name = '두부';
    UPDATE ingredients SET unit = '대' WHERE unit = 'count' AND name = '대파';
    UPDATE ingredients SET unit = '공기' WHERE unit = 'count' AND name = '밥';
    UPDATE ingredients SET unit = '개' WHERE unit = 'count';
  `);
}
