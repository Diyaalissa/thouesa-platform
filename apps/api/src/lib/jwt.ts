import jwt, { type Secret } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

export type TokenPayload = {
  id: string;
  email?: string;
  role: UserRole;
};

function getJwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s || !s.trim()) throw new Error("JWT_SECRET_MISSING");
  return s;
}

export function signToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);

  if (typeof decoded !== "object" || decoded === null) throw new Error("JWT_INVALID");

  const p = decoded as any;
  if (!p.id || !p.role) throw new Error("JWT_INVALID_PAYLOAD");

  return {
    id: String(p.id),
    email: p.email ? String(p.email) : undefined,
    role: p.role as UserRole,
  };
}