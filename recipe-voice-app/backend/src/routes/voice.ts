import { Router } from "express";
import { z } from "zod";
import { inferIntentFromText } from "../llm/intentFallback";
import { requireAuthOrAnonVoice } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();
router.use(requireAuthOrAnonVoice);

const IntentBodySchema = z.object({ text: z.string().min(1) });

/** 요리 모드에서 온디바이스 로컬 매처가 실패한 발화(텍스트만)의 온라인 인텐트 추정. */
router.post("/intent", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const parsed = IntentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const intent = await inferIntentFromText(parsed.data.text);
  res.json(intent);
});

export default router;
