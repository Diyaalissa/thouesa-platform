import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "CHANGE_ME";

export function signToken(payload: object) {
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, secret) as any;
}
