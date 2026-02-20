"use client";

import { useState } from "react";
import { API_BASE } from "../lib/api";

export default function EmailOtpForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState<"+213" | "+962">("+213");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    setErr(null); setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: mode === "register" ? fullName : undefined, phoneCountryCode: mode === "register" ? phoneCountryCode : undefined, phoneNumber: mode === "register" ? phoneNumber : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "REQUEST_FAILED");
      setMsg("تم إرسال رمز التحقق إلى بريدك. (في وضع التطوير قد يظهر الرمز في Console الخاص بالسيرفر)");
      setStep("verify");
    } catch (e: any) {
      setErr(e?.message || "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setErr(null); setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "VERIFY_FAILED");
      localStorage.setItem("token", d.token);
      location.href = "/dashboard";
    } catch (e: any) {
      setErr(e?.message || "VERIFY_FAILED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520, width: "100%" }}>
      <div className="cardHead">
        <div className="cardTitle">{mode === "register" ? "إنشاء حساب" : "تسجيل الدخول"}</div>
        <div className="badge">OTP</div>
      </div>
      <div className="cardBody space-y-3">
        {err && <div className="small" style={{ color: "crimson" }}>خطأ: {err}</div>}
        {msg && <div className="small" style={{ color: "green" }}>{msg}</div>}

        {step === "request" ? (
          <>
            {mode === "register" && (
              <div>
                <div className="small">الاسم الكامل</div>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك" />
              </div>
            )}
<div>
  <div className="small">البريد الإلكتروني</div>
  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
</div>

{mode === "register" && (
  <div className="grid" style={{ gridTemplateColumns: "160px 1fr", gap: 10 }}>
    <div>
      <div className="small">الدولة</div>
      <select className="input" value={phoneCountryCode} onChange={(e) => setPhoneCountryCode(e.target.value as any)}>
        <option value="+213">الجزائر (+213)</option>
        <option value="+962">الأردن (+962)</option>
      </select>
    </div>
    <div>
      <div className="small">رقم الهاتف</div>
      <input className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="مثال: 551234567" />
    </div>
  </div>
)}

<button className="btn btnPrimary" onClick={requestCode} disabled={loading || !email || (mode==="register" && !phoneNumber)} type="button">
              {loading ? "..." : "إرسال الرمز"}
            </button>
          </>
        ) : (
          <>
            <div className="small">أدخل رمز التحقق</div>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: 123456" />
            <div className="flex gap-2 flex-wrap">
              <button className="btn btnPrimary" onClick={verifyCode} disabled={loading || !code} type="button">
                {loading ? "..." : "تأكيد"}
              </button>
              <button className="btn" onClick={() => setStep("request")} type="button">
                رجوع
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
