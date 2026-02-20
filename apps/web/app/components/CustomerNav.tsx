"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Me = { user: { id: string; fullName: string; email: string; role: "CUSTOMER" | "ADMIN" } };

export default function CustomerNav() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => setIsAuthed(r.ok))
      .catch(() => setIsAuthed(false));
  }, []);

  if (!isAuthed) return null;

  return (
    <nav className="flex gap-3 text-sm flex-wrap justify-end">
      <Link href="/dashboard" className="badge">لوحة التحكم</Link>
      <Link href="/dashboard/new-order" className="badge">إنشاء طلب</Link>
      <Link href="/dashboard/purchase" className="badge">شراء (Temu/SHEIN)</Link>
    </nav>
  );
}
