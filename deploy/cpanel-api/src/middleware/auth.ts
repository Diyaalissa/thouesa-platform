import type { RequestHandler, Request } from "express";
import type { UserRole } from "@prisma/client";
import { verifyToken } from "../lib/jwt.js";

export type TokenUser = {
  id: string;
  email?: string;
  role?: UserRole;
};

export type AuthRequest = Request & { user?: TokenUser };

function getBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const payload = verifyToken(token);

    const id = (payload.userId || payload.id) as string | undefined;
    if (!id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    req.user = {
      id,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });
  return next();
};