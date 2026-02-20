'use client';

import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"EMAIL" | "CODE">("EMAIL");
  const [msg, setMsg] = useState<string>("");

  async function requestCode() {
    setMsg("");
    const r = await apiFetch("/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(d?.error || "REQUEST_FAILED");
    setStep("CODE");
    setMsg("تم إرسال رمز التحقق إلى بريدك.");
  }

  async function verify() {
    setMsg("");
    const r = await apiFetch("/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(d?.error || "VERIFY_FAILED");
    // token is stored by apiFetch helper (if implemented) or returned; fallback store:
    if (d?.token) localStorage.setItem("token", d.token);
    window.location.href = "/dashboard";
  }

  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%" }}>
        <div className="cardHead"><div className="cardTitle">تسجيل الدخول</div></div>
        <div className="cardBody space-y-3">
          <label className="small">البريد الإلكتروني</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />

          {step === "CODE" && (
            <>
              <label className="small">رمز التحقق</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </>
          )}

          <div className="flex gap-2 flex-wrap">
            {step === "EMAIL" ? (
              <button className="btn btnPrimary" onClick={requestCode} disabled={!email}>إرسال الرمز</button>
            ) : (
              <button className="btn btnPrimary" onClick={verify} disabled={!email || !code}>تأكيد</button>
            )}
            <a className="btn" href="/">رجوع</a>
          </div>

          {msg && <div className="small" style={{ color: "var(--muted)" }}>{msg}</div>}
          <div className="small">إن لم يكن لديك حساب: <a className="badge" href="/register">إنشاء حساب</a></div>
        </div>
      </div>
    </div>
  );
}
