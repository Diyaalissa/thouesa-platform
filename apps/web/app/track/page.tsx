"use client";

import { useState } from "react";
import { API_BASE } from "../lib/api";

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function track() {
    setErr(null); setData(null);
    const res = await fetch(`${API_BASE}/public/track/${encodeURIComponent(orderNumber.trim())}`);
    const d = await res.json();
    if (!res.ok) return setErr(d?.error || "NOT_FOUND");
    setData(d.order);
  }

  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">تتبع الطلب</div>
      </div>
      <div className="cardBody space-y-3">
        <div className="small">أدخل رقم الطلب لمشاهدة الحالة فقط.</div>
        <div className="flex gap-2 flex-wrap">
          <input className="input" style={{ minWidth: 280 }} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="مثال: TH-2026-000001" />
          <button className="btn btnPrimary" type="button" onClick={track} disabled={!orderNumber.trim()}>بحث</button>
        </div>
        {err && <div className="small" style={{ color: "crimson" }}>خطأ: {err}</div>}
        {data && (
          <div className="card" style={{ padding: 14 }}>
            <div><b>رقم الطلب:</b> {data.orderNumber}</div>
            <div><b>الاتجاه:</b> {data.direction}</div>
            <div><b>الحالة:</b> {data.status}</div>
            <div className="small">آخر تحديث: {new Date(data.updatedAt).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
