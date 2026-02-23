// deploy/cpanel-api/src/middleware/auth.ts
import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

export type TokenPayload = {
  id: string;
  role: UserRole;
  email?: string;
  // دعم توكنات قديمة إن وجدت
  userId?: string;
};

export type AuthUser = {
  id: string;
  role: UserRole;
  email?: string;
};

export type AuthRequest = Request & { user?: AuthUser };

function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token || null;
}

function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET_MISSING");
  return s;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    const secret = requireJwtSecret();

    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== "object" || decoded === null) {
      return res.status(401).json({ error: "INVALID_TOKEN" });
    }

    const payload = decoded as Partial<TokenPayload>;

    const id = (payload.id ?? payload.userId) as string | undefined;
    const role = payload.role as UserRole | undefined;

    if (!id || !role) return res.status(401).json({ error: "INVALID_TOKEN" });

    (req as AuthRequest).user = {
      id,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };

    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const u = (req as AuthRequest).user;
  if (!u) return res.status(401).json({ error: "UNAUTHORIZED" });
  if (u.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });
  next();
};