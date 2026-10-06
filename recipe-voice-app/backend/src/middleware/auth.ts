import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * /api/voice/* 전용: Milestone 0(음성 스파이크)는 로그인 화면이 아직 없는 상태에서 진행되므로,
 * ALLOW_ANON_VOICE=true일 때는 인증 없이 IP 기준으로 사용량을 추적한다.
 * Milestone 1(인증 도입) 이후에는 반드시 false로 되돌려야 한다.
 */
export function requireAuthOrAnonVoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (process.env.ALLOW_ANON_VOICE === "true") {
    req.userId = req.userId ?? `anon:${req.ip}`;
    next();
    return;
  }
  requireAuth(req, res, next);
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!JWT_SECRET) {
    res.status(500).json({ error: "server_misconfigured", message: "JWT_SECRET not set" });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}
