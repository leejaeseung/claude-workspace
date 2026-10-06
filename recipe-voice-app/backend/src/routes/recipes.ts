import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "../db/pool";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const RecipeBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  totalTimeMinutes: z.number().nullable().optional(),
  servings: z.number().nullable().optional(),
  source: z.enum(["voice", "manual"]),
  ingredients: z.array(
    z.object({ name: z.string(), quantity: z.number().nullable(), unit: z.string().nullable() })
  ),
  steps: z.array(z.object({ text: z.string(), timerSeconds: z.number().nullable() })),
  tags: z.array(z.string()),
});

router.get("/", async (req: AuthenticatedRequest, res) => {
  const result = await pool.query(
    `SELECT id, title, total_time_minutes, is_favorite, updated_at
     FROM recipes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [req.userId]
  );
  res.json(result.rows);
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  const recipe = await pool.query(
    "SELECT * FROM recipes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [req.params.id, req.userId]
  );
  if (recipe.rowCount === 0) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const ingredients = await pool.query(
    "SELECT name, quantity, unit, order_index FROM ingredients WHERE recipe_id = $1 ORDER BY order_index",
    [req.params.id]
  );
  const steps = await pool.query(
    "SELECT text, timer_seconds, order_index FROM steps WHERE recipe_id = $1 ORDER BY order_index",
    [req.params.id]
  );
  const tags = await pool.query(
    `SELECT t.name FROM tags t JOIN recipe_tags rt ON rt.tag_id = t.id WHERE rt.recipe_id = $1`,
    [req.params.id]
  );
  res.json({ ...recipe.rows[0], ingredients: ingredients.rows, steps: steps.rows, tags: tags.rows.map((r) => r.name) });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = RecipeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const body = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO recipes (id, user_id, title, description, total_time_minutes, servings, source, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [id, req.userId, body.title, body.description ?? null, body.totalTimeMinutes ?? null, body.servings ?? null, body.source, now]
    );
    for (let i = 0; i < body.ingredients.length; i++) {
      const ing = body.ingredients[i];
      await client.query(
        "INSERT INTO ingredients (id, recipe_id, name, quantity, unit, order_index) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), id, ing.name, ing.quantity, ing.unit, i]
      );
    }
    for (let i = 0; i < body.steps.length; i++) {
      const step = body.steps[i];
      await client.query(
        "INSERT INTO steps (id, recipe_id, order_index, text, timer_seconds) VALUES ($1,$2,$3,$4,$5)",
        [randomUUID(), id, i, step.text, step.timerSeconds]
      );
    }
    for (const tagName of body.tags) {
      const tagId = await upsertTag(client, req.userId!, tagName);
      await client.query(
        "INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [id, tagId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.status(201).json({ id });
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const FavoriteSchema = z.object({ isFavorite: z.boolean() }).partial();
  const parsed = FavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const result = await pool.query(
    "UPDATE recipes SET is_favorite = COALESCE($1, is_favorite), updated_at = now() WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL",
    [parsed.data.isFavorite ?? null, req.params.id, req.userId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(204).send();
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const result = await pool.query(
    "UPDATE recipes SET deleted_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(204).send();
});

async function upsertTag(client: { query: typeof pool.query }, userId: string, name: string): Promise<string> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM tags WHERE user_id = $1 AND name = $2",
    [userId, name]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await client.query("INSERT INTO tags (id, user_id, name) VALUES ($1,$2,$3)", [id, userId, name]);
  return id;
}

export default router;
