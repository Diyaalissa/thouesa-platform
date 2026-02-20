"use client";

import { useState } from "react";
import { API_BASE } from "./lib/api";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setErr(null);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d?.error || "LOGIN_FAILED");
    // require admin role
    if (d?.user?.role !== "ADMIN") return setErr("NOT_ADMIN");
    localStorage.setItem("admin_token", d.token);
    location.href = "/dashboard";
  }

  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%" }}>
        <div className="cardHead">
          <div className="cardTitle">تسجيل دخول الإدارة</div>
          <div className="badge">Admin</div>
        </div>
        <div className="cardBody space-y-3">
          {err && <div className="small" style={{ color: "crimson" }}>خطأ: {err}</div>}
          <div>
            <div className="small">البريد</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="small">كلمة المرور</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btnPrimary" type="button" onClick={login}>دخول</button>
          <div className="small">ملاحظة: هذه البوابة مخصصة للإدارة فقط.</div>
        </div>
      </div>
    </div>
  );
}
