'use client';

import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<"JO" | "DZ">("DZ");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"FORM" | "CODE">("FORM");
  const [msg, setMsg] = useState<string>("");

  async function requestCode() {
    setMsg("");
    const r = await apiFetch("/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(d?.error || "REQUEST_FAILED");
    setStep("CODE");
    setMsg("تم إرسال رمز التحقق إلى بريدك. أدخله لإكمال إنشاء الحساب.");
  }

  async function verifyAndCreate() {
    setMsg("");
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, fullName, phoneCountry: country, phoneNumber: phone, code }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(d?.error || "REGISTER_FAILED");
    if (d?.token) localStorage.setItem("token", d.token);
    window.location.href = "/dashboard";
  }

  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%" }}>
        <div className="cardHead"><div className="cardTitle">إنشاء حساب</div></div>
        <div className="cardBody space-y-3">
          <label className="small">الاسم الكامل</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم" />

          <label className="small">البريد الإلكتروني</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />

          <label className="small">دولة الهاتف</label>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value as any)}>
            <option value="JO">الأردن (+962)</option>
            <option value="DZ">الجزائر (+213)</option>
          </select>

          <label className="small">رقم الهاتف</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="مثال: 7xxxxxxxx" />

          {step === "CODE" && (
            <>
              <label className="small">رمز التحقق (OTP)</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </>
          )}

          <div className="flex gap-2 flex-wrap">
            {step === "FORM" ? (
              <button className="btn btnPrimary" onClick={requestCode} disabled={!email || !fullName || !phone}>إرسال الرمز</button>
            ) : (
              <button className="btn btnPrimary" onClick={verifyAndCreate} disabled={!code}>إنشاء الحساب</button>
            )}
            <a className="btn" href="/">رجوع</a>
          </div>

          {msg && <div className="small" style={{ color: "var(--muted)" }}>{msg}</div>}
          <div className="small">لديك حساب؟ <a className="badge" href="/login">تسجيل الدخول</a></div>
        </div>
      </div>
    </div>
  );
}
