"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE, getToken } from "../lib/api";
import { formatOrderNumber } from "../lib/orderNumber";

type Order = any;

function statusClass(status: string) {
  if (status === "CONFIRMED" || status === "DELIVERED" || status === "SHIPPED") return "ok";
  if (status === "REJECTED" || status === "CANCELLED") return "bad";
  if (status === "PAYMENT_UNDER_REVIEW") return "review";
  return "pending";
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const token = useMemo(() => getToken(), []);

  async function load() {
    if (!token) { setErr("NOT_LOGGED_IN"); return; }
    const r = await apiFetch("/admin/orders");
    const d = await r.json();
    if (!r.ok) { setErr(d?.error || "LOAD_FAILED"); return; }
    setOrders(d.orders || []);
  }

  useEffect(() => { load(); }, [token]);

  async function confirm(orderId: string, approve: boolean) {
    setErr(null);
    setMsg(null);

    const weightFinalKgStr = (document.getElementById(`w_${orderId}`) as HTMLInputElement | null)?.value;
    const priceFinalStr = (document.getElementById(`p_${orderId}`) as HTMLInputElement | null)?.value;

    const weightFinalKg = weightFinalKgStr ? Number(weightFinalKgStr) : undefined;
    const priceFinal = priceFinalStr ? Number(priceFinalStr) : undefined;

    const res = await apiFetch(`/admin/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, weightFinalKg, priceFinal }),
    });

    const d = await res.json();
    if (!res.ok) return setErr(d?.error || "ACTION_FAILED");

    setMsg(approve ? "تم تأكيد الدفع." : "تم رفض الدفع.");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1" style={{ fontSize: 24 }}>لوحة الإدارة</h1>
        <div className="pill">مراجعة الطلبات وتأكيد الدفع</div>
      </div>

      {err && <div className="card" style={{ padding: 14, borderColor: "rgba(239,68,68,.35)" }}>خطأ: {err}</div>}
      {msg && <div className="card" style={{ padding: 14, borderColor: "rgba(34,197,94,.35)" }}>{msg}</div>}

      <div className="card">
        <div className="cardHead">
          <div className="cardTitle">الطلبات</div>
          <div className="badge">{orders.length}</div>
        </div>

        <div className="cardBody space-y-3">
          {orders.length === 0 && <div className="small">لا يوجد طلبات.</div>}

          {orders.map((o) => {
            const pay = o.payments?.[0];
            const receiptUrl = pay?.receiptUrl ? `${API_BASE}${pay.receiptUrl}` : null;

            return (
              <div key={o.id} className="card" style={{ padding: 14 }}>
                <div className="flex justify-between flex-wrap gap-2 items-center">
                  <div>
                    <div style={{ fontWeight: 950 }}>{formatOrderNumber(o.id, o.createdAt)} — {o.direction}</div>
                    <div className="small">{o.user?.fullName} — {o.user?.email}</div>
                  </div>
                  <span className={`statusPill ${statusClass(o.status)}`}>{o.status}</span>
                </div>

                <div className="sep" />

                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <div className="small">وزن تقديري</div>
                    <div style={{ fontWeight: 900 }}>{o.weightDeclaredKg} كغ</div>
                  </div>
                  <div>
                    <div className="small">سعر تقديري</div>
                    <div style={{ fontWeight: 900 }}>{o.priceEstimated} {o.currency}</div>
                  </div>
                  <div>
                    <div className="small">وزن نهائي</div>
                    <input id={`w_${o.id}`} className="input" defaultValue={o.weightFinalKg ?? ""} placeholder="مثال: 2.5" />
                  </div>
                  <div>
                    <div className="small">سعر نهائي</div>
                    <input id={`p_${o.id}`} className="input" defaultValue={o.priceFinal ?? ""} placeholder="مثال: 30" />
                  </div>
                </div>

                <div style={{ marginTop: 10 }} className="flex gap-2 flex-wrap items-center">
                  {receiptUrl ? (
                    <a className="btn" href={receiptUrl} target="_blank" rel="noreferrer">
                      عرض الإيصال
                    </a>
                  ) : (
                    <span className="small">لا يوجد إيصال مرفوع</span>
                  )}

                  <button className="btn btnPrimary" onClick={() => confirm(o.id, true)} type="button">
                    تأكيد
                  </button>
                  <button className="btn" onClick={() => confirm(o.id, false)} type="button">
                    رفض
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
