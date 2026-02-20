"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

type Me = { user: { id: string; fullName: string; email: string; role: "CUSTOMER" | "ADMIN" } };

export default function AuthActions() {
  const [me, setMe] = useState<Me["user"] | null>(null);

  useEffect(() => {
    apiFetch("/auth/me")
      .then(async (r) => {
        if (!r.ok) return null;
        const d = (await r.json()) as Me;
        return d.user;
      })
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    location.href = "/";
  }

  return (
    <div className="flex gap-2 items-center flex-wrap justify-end">
      {me?.role === "ADMIN" && (
        <Link href="/admin" className="badge">
          Admin
        </Link>
      )}
      {me ? (
        <button className="btn" onClick={logout} type="button">
          تسجيل خروج
        </button>
      ) : null}
    </div>
  );
}
