"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

type Setting = any;

export default function AdminSettingsPage() {
  const [s, setS] = useState<Setting | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function api(path: string, init: RequestInit = {}) {
    const token = localStorage.getItem("admin_token");
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }

  async function load() {
    const r = await api("/settings/admin");
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "LOAD_FAILED");
    setS(d.setting);
  }

  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function save() {
    setErr(null); setMsg(null);
    const r = await api("/settings/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d?.error || "SAVE_FAILED");
    setS(d.setting);
    setMsg("تم حفظ الإعدادات.");
  }

  if (!s) return <div className="card" style={{ padding: 14 }}>تحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1" style={{ fontSize: 24 }}>إعدادات النظام</h1>
        <button className="btn btnPrimary" onClick={save} type="button">حفظ</button>
      </div>

      {err && <div className="card" style={{ padding: 14, borderColor: "rgba(239,68,68,.35)" }}>خطأ: {err}</div>}
      {msg && <div className="card" style={{ padding: 14, borderColor: "rgba(34,197,94,.35)" }}>{msg}</div>}

      <div className="card">
        <div className="cardHead"><div className="cardTitle">روابط التواصل</div></div>
        <div className="cardBody grid gap-3">
          <div>
            <div className="small">Facebook URL</div>
            <input className="input" value={s.facebookUrl || ""} onChange={(e) => setS({ ...s, facebookUrl: e.target.value })} />
          </div>
          <div>
            <div className="small">WhatsApp URL</div>
            <input className="input" value={s.whatsappUrl || ""} onChange={(e) => setS({ ...s, whatsappUrl: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHead"><div className="cardTitle">أسعار الشحن والعمولة</div></div>
        <div className="cardBody grid md:grid-cols-3 gap-3">
          <div>
            <div className="small">JOD لكل كغ (الأردن → الجزائر)</div>
            <input className="input" value={s.shipJodPerKg_JO_TO_DZ ?? 4} onChange={(e) => setS({ ...s, shipJodPerKg_JO_TO_DZ: Number(e.target.value) })} />
          </div>
          <div>
            <div className="small">DZD لكل كغ (الجزائر → الأردن)</div>
            <input className="input" value={s.shipDzdPerKg_DZ_TO_JO ?? 1000} onChange={(e) => setS({ ...s, shipDzdPerKg_DZ_TO_JO: Number(e.target.value) })} />
          </div>
          <div>
            <div className="small">نسبة ربح/عمولة (%)</div>
            <input className="input" value={s.commissionPercent ?? 2} onChange={(e) => setS({ ...s, commissionPercent: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHead"><div className="cardTitle">العروض</div></div>
        <div className="cardBody grid md:grid-cols-3 gap-3">
          <div>
            <div className="small">تفعيل العرض</div>
            <select className="input" value={s.promoActive ? "1" : "0"} onChange={(e) => setS({ ...s, promoActive: e.target.value === "1" })}>
              <option value="0">لا</option>
              <option value="1">نعم</option>
            </select>
          </div>
          <div>
            <div className="small">اسم العرض</div>
            <input className="input" value={s.promoName || ""} onChange={(e) => setS({ ...s, promoName: e.target.value })} />
          </div>
          <div>
            <div className="small">خصم (%)</div>
            <input className="input" value={s.promoDiscountPercent ?? ""} onChange={(e) => setS({ ...s, promoDiscountPercent: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHead"><div className="cardTitle">USDT (داخلي - لا يظهر للزبون)</div></div>
        <div className="cardBody grid md:grid-cols-2 gap-3">
          <div>
            <div className="small">سعر USDT مقابل DZD</div>
            <input className="input" value={s.usdtDzdPrice ?? ""} onChange={(e) => setS({ ...s, usdtDzdPrice: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <div className="small">Markup (%)</div>
            <input className="input" value={s.usdtMarkupPercent ?? ""} onChange={(e) => setS({ ...s, usdtMarkupPercent: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>
    </div>
  );
}
