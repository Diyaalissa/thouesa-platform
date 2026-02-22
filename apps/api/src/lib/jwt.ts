import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

const SECRET = process.env.JWT_SECRET!; // علامة ! تنهي مشكلة undefined

export type TokenPayload = {
  id: string;
  role: UserRole;
  email?: string;
};

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}