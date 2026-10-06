import { randomUUID } from "expo-crypto";
import { getDb } from "./schema";
import { stripParticlesAndEndings } from "../shared/koreanNormalize";

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface Step {
  text: string;
  timerSeconds: number | null;
}

export interface RecipeInput {
  title: string;
  description?: string;
  totalTimeMinutes?: number;
  servings?: number;
  source: "voice" | "manual";
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
}

export interface RecipeSummary {
  id: string;
  title: string;
  totalTimeMinutes: number | null;
  isFavorite: boolean;
}

export interface RecipeDetail extends RecipeSummary {
  description: string | null;
  servings: number | null;
  ingredients: (Ingredient & { orderIndex: number })[];
  steps: (Step & { orderIndex: number })[];
  tags: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

async function enqueueSync(
  entityType: string,
  entityId: string,
  operation: "create" | "update" | "delete",
  payload: unknown
) {
  const db = getDb();
  await db.runAsync(
    "INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), entityType, entityId, operation, JSON.stringify(payload), nowIso()]
  );
}

/** 레시피를 로컬 저장 + 동기화 큐에 등록한다. 음성 입력이든 직접 입력이든 이 함수를 공통으로 거친다. */
export async function createRecipe(input: RecipeInput): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const timestamp = nowIso();

  await db.runAsync(
    `INSERT INTO recipes (id, title, description, total_time_minutes, servings, source, created_at, updated_at, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.title,
      input.description ?? null,
      input.totalTimeMinutes ?? null,
      input.servings ?? null,
      input.source,
      timestamp,
      timestamp,
    ]
  );

  for (let i = 0; i < input.ingredients.length; i++) {
    const ing = input.ingredients[i];
    await db.runAsync(
      "INSERT INTO ingredients (id, recipe_id, name, quantity, unit, order_index) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), id, ing.name, ing.quantity, ing.unit, i]
    );
  }

  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];
    await db.runAsync(
      "INSERT INTO steps (id, recipe_id, order_index, text, timer_seconds) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), id, i, step.text, step.timerSeconds]
    );
  }

  for (const tagName of input.tags) {
    const tagId = await upsertTag(tagName);
    await db.runAsync(
      "INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)",
      [id, tagId]
    );
  }

  const ingredientsBlob = input.ingredients.map((ing) => ing.name).join(" ");
  await db.runAsync(
    "INSERT INTO recipes_fts (recipe_id, title, ingredients_blob) VALUES (?, ?, ?)",
    [id, input.title, ingredientsBlob]
  );

  await enqueueSync("recipe", id, "create", { ...input, id });
  return id;
}

async function upsertTag(name: string): Promise<string> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM tags WHERE name = ?",
    [name]
  );
  if (existing) return existing.id;
  const id = randomUUID();
  await db.runAsync("INSERT INTO tags (id, name) VALUES (?, ?)", [id, name]);
  return id;
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string;
    title: string;
    total_time_minutes: number | null;
    is_favorite: number;
  }>(
    "SELECT id, title, total_time_minutes, is_favorite FROM recipes WHERE deleted_at IS NULL ORDER BY created_at DESC"
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    totalTimeMinutes: row.total_time_minutes,
    isFavorite: row.is_favorite === 1,
  }));
}

export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const db = getDb();
  const recipe = await db.getFirstAsync<{
    id: string;
    title: string;
    description: string | null;
    total_time_minutes: number | null;
    servings: number | null;
    is_favorite: number;
  }>(
    "SELECT id, title, description, total_time_minutes, servings, is_favorite FROM recipes WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  if (!recipe) return null;

  const ingredients = await db.getAllAsync<{
    name: string;
    quantity: number | null;
    unit: string | null;
    order_index: number;
  }>(
    "SELECT name, quantity, unit, order_index FROM ingredients WHERE recipe_id = ? ORDER BY order_index",
    [id]
  );

  const steps = await db.getAllAsync<{
    text: string;
    timer_seconds: number | null;
    order_index: number;
  }>(
    "SELECT text, timer_seconds, order_index FROM steps WHERE recipe_id = ? ORDER BY order_index",
    [id]
  );

  const tags = await db.getAllAsync<{ name: string }>(
    `SELECT t.name FROM tags t
     JOIN recipe_tags rt ON rt.tag_id = t.id
     WHERE rt.recipe_id = ?`,
    [id]
  );

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    totalTimeMinutes: recipe.total_time_minutes,
    servings: recipe.servings,
    isFavorite: recipe.is_favorite === 1,
    ingredients: ingredients.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      orderIndex: row.order_index,
    })),
    steps: steps.map((row) => ({
      text: row.text,
      timerSeconds: row.timer_seconds,
      orderIndex: row.order_index,
    })),
    tags: tags.map((row) => row.name),
  };
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE recipes SET is_favorite = 1 - is_favorite, updated_at = ? WHERE id = ?",
    [nowIso(), id]
  );
  await enqueueSync("recipe", id, "update", { id, toggledFavorite: true });
}

/**
 * 음성 검색 진입점. 조사/어미를 걷어낸 뒤 단어별로 FTS5 trigram 인덱스에서 찾고,
 * 매칭이 없거나(3자 미만 토큰만 남는 경우 포함) 오류가 나면 LIKE로 폴백한다.
 */
export async function searchRecipes(term: string): Promise<RecipeSummary[]> {
  const trimmed = term.trim();
  if (trimmed.length === 0) return listRecipes();

  const db = getDb();

  // 계획대로 STT가 덧붙이는 "~찾아줘"/"~알려줘" 같은 조사·어미를 먼저 걷어낸다.
  // 전부 걸러져 빈 문자열이 되면(예: 발화가 어미로만 이뤄진 경우) 원문으로 되돌린다.
  const normalized = stripParticlesAndEndings(trimmed) || trimmed;

  // trigram 토크나이저는 3자 미만 문자열에서 트라이그램을 만들지 못해 매칭에 기여하지 못하므로
  // FTS 쪽 후보에서는 제외하고 LIKE 폴백에만 원문/정규화 문자열을 그대로 사용한다.
  const ftsTokens = normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .map((word) => `"${word.replace(/"/g, '""')}"`);

  if (ftsTokens.length > 0) {
    // FTS5 MATCH의 우변은 쿼리 표현식이다. 단어별로 따로 인용해 OR로 묶어야
    // 필러 단어가 남아 있어도 핵심 단어 하나만 맞으면(부분 문자열로) 찾힌다.
    const ftsQuery = ftsTokens.join(" OR ");
    try {
      const rows = await db.getAllAsync<{
        id: string;
        title: string;
        total_time_minutes: number | null;
        is_favorite: number;
      }>(
        `SELECT r.id, r.title, r.total_time_minutes, r.is_favorite
         FROM recipes_fts f
         JOIN recipes r ON r.id = f.recipe_id
         WHERE recipes_fts MATCH ? AND r.deleted_at IS NULL
         ORDER BY rank`,
        [ftsQuery]
      );
      if (rows.length > 0) {
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          totalTimeMinutes: row.total_time_minutes,
          isFavorite: row.is_favorite === 1,
        }));
      }
    } catch (error) {
      // FTS5 쿼리 문법 오류 등 예기치 못한 실패 시 아래 LIKE 폴백으로 계속 진행한다.
      console.warn("recipes_fts MATCH failed, falling back to LIKE", error);
    }
  }

  const rows = await db.getAllAsync<{
    id: string;
    title: string;
    total_time_minutes: number | null;
    is_favorite: number;
  }>(
    "SELECT id, title, total_time_minutes, is_favorite FROM recipes WHERE title LIKE ? AND deleted_at IS NULL",
    [`%${normalized}%`]
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    totalTimeMinutes: row.total_time_minutes,
    isFavorite: row.is_favorite === 1,
  }));
}
