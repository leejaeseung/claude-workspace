import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "../db/pool";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/** 마지막 동기화 이후 변경(생성/수정/삭제 툼스톤)된 레시피를 반환한다. */
router.get("/pull", async (req: AuthenticatedRequest, res) => {
  const since = typeof req.query.since === "string" ? req.query.since : "1970-01-01T00:00:00Z";

  const recipes = await pool.query(
    "SELECT * FROM recipes WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at",
    [req.userId, since]
  );

  const detailed = await Promise.all(
    recipes.rows.map(async (recipe) => {
      if (recipe.deleted_at) return recipe;
      const ingredients = await pool.query(
        "SELECT name, quantity, unit, order_index FROM ingredients WHERE recipe_id = $1 ORDER BY order_index",
        [recipe.id]
      );
      const steps = await pool.query(
        "SELECT text, timer_seconds, order_index FROM steps WHERE recipe_id = $1 ORDER BY order_index",
        [recipe.id]
      );
      return { ...recipe, ingredients: ingredients.rows, steps: steps.rows };
    })
  );

  res.json({ recipes: detailed, syncedAt: new Date().toISOString() });
});

const PushItemSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    entityId: z.string().uuid(),
    payload: z.object({
      title: z.string(),
      ingredients: z.array(
        z.object({ name: z.string(), quantity: z.number().nullable(), unit: z.string().nullable() })
      ),
      steps: z.array(z.object({ text: z.string(), timerSeconds: z.number().nullable() })),
      source: z.enum(["voice", "manual"]),
    }),
  }),
  z.object({
    operation: z.literal("update"),
    entityId: z.string().uuid(),
    payload: z.object({ toggledFavorite: z.boolean().optional() }),
  }),
  z.object({
    operation: z.literal("delete"),
    entityId: z.string().uuid(),
    payload: z.object({}).optional(),
  }),
]);

const PushBodySchema = z.object({ items: z.array(PushItemSchema) });

/** 오프라인 중 쌓인 로컬 sync_queue를 배치로 업로드한다. */
router.post("/push", async (req: AuthenticatedRequest, res) => {
  const parsed = PushBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  for (const item of parsed.data.items) {
    if (item.operation === "create") {
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO recipes (id, user_id, title, source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (id) DO NOTHING`,
        [item.entityId, req.userId, item.payload.title, item.payload.source, now]
      );
      for (let i = 0; i < item.payload.ingredients.length; i++) {
        const ing = item.payload.ingredients[i];
        await pool.query(
          "INSERT INTO ingredients (id, recipe_id, name, quantity, unit, order_index) VALUES ($1,$2,$3,$4,$5,$6)",
          [randomUUID(), item.entityId, ing.name, ing.quantity, ing.unit, i]
        );
      }
      for (let i = 0; i < item.payload.steps.length; i++) {
        const step = item.payload.steps[i];
        await pool.query(
          "INSERT INTO steps (id, recipe_id, order_index, text, timer_seconds) VALUES ($1,$2,$3,$4,$5)",
          [randomUUID(), item.entityId, i, step.text, step.timerSeconds]
        );
      }
    } else if (item.operation === "update" && item.payload.toggledFavorite) {
      await pool.query(
        "UPDATE recipes SET is_favorite = NOT is_favorite, updated_at = now() WHERE id = $1 AND user_id = $2",
        [item.entityId, req.userId]
      );
    } else if (item.operation === "delete") {
      await pool.query(
        "UPDATE recipes SET deleted_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2",
        [item.entityId, req.userId]
      );
    }
  }

  res.json({ appliedCount: parsed.data.items.length, syncedAt: new Date().toISOString() });
});

export default router;
