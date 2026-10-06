import { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  windowStartedAt: number;
}

/**
 * 단순 in-memory 고정 윈도 레이트리밋. 단일 프로세스 개발/저사용량 배포 기준이며,
 * 여러 인스턴스로 스케일하는 경우 Redis 등 공유 스토어로 교체해야 한다 (Milestone 5).
 */
export function rateLimit(options: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req as Request & { userId?: string }).userId ?? req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStartedAt > options.windowMs) {
      buckets.set(key, { count: 1, windowStartedAt: now });
      next();
      return;
    }

    if (bucket.count >= options.max) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    bucket.count += 1;
    next();
  };
}
