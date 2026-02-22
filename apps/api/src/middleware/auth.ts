import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import type { UserRole } from "@prisma/client";

export type AuthRequest = Request & {
  user: { id: string; email?: string; role: UserRole };
};

function getBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    const payload = verifyToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "UNAUTHORIZED" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });
  next();
}