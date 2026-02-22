import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "UNAUTHORIZED" });

  try {
    const decoded = verifyToken(token) as { id: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: "INVALID_TOKEN" });
  }
};

// السماح للمسؤول فقط
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "FORBIDDEN_ADMIN_ONLY" });
  }
  next();
};

// السماح للمسؤول أو موظف العمليات (Phase 4)
export const requireStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
    const staffRoles = ["ADMIN", "OPERATIONS", "DRIVER"];
    if (!req.user || !staffRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN_STAFF_ONLY" });
    }
    next();
  };