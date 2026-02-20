"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, API_BASE, getToken } from "../../../lib/api";
import { formatOrderNumber } from "../../../lib/orderNumber";

type Order = any;

function statusClass(status: string) {
  if (status === "CONFIRMED" || status === "DELIVERED" || status === "SHIPPED") return "ok";
  if (status === "REJECTED" || status === "CANCELLED") return "bad";
  if (status === "PAYMENT_UNDER_REVIEW") return "review";
  return "pending";
}

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const r = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const payment = useMemo(() => (order?.payments?.[0] ? order.payments[0] : null), [order]);

  async function load() {
    const token = getToken();
    if (!token) { setErr("NOT_LOGGED_IN"); return; }

    const res = await apiFetch(`/orders/${id}`);
    const d = await res.json();
    if (!res.ok) { setErr(d?.error || "LOAD_FAILED"); return; }
    setOrder(d.order);
  }

  useEffect(() => { load(); }, [id]);

  async function uploadReceipt() {
    setUploadMsg(null);
    setErr(null);

    if (!file) return setErr("NO_FILE_SELECTED");
    const token = getToken();
    if (!token) return setErr("NOT_LOGGED_IN");

    const fd = new FormData();
    fd.append("receipt", file);

    const res = await fetch(`${API_BASE}/orders/${id}/receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) return setErr(data?.error || "UPLOAD_FAILED");

    setUploadMsg("تم رفع الإيصال بنجاح. سيتم التحقق من قبل الإدارة.");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1" style={{ fontSize: 24 }}>تفاصيل الطلب</h1>
        <button className="btn" onClick={() => r.push("/dashboard")} type="button">رجوع</button>
      </div>

      {err && <div className="card" style={{ padding: 14, borderColor: "rgba(239,68,68,.35)" }}>خطأ: {err}</div>}
      {uploadMsg && <div className="card" style={{ padding: 14, borderColor: "rgba(34,197,94,.35)" }}>{uploadMsg}</div>}

      {order && (
        <div className="card">
          <div className="cardHead">
            <div className="cardTitle">{formatOrderNumber(order.id, order.createdAt)}</div>
            <span className={`statusPill ${statusClass(order.status)}`}>{order.status}</span>
          </div>
          <div className="cardBody space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="small">الاتجاه</div>
                <div style={{ fontWeight: 900 }}>{order.direction}</div>
              </div>
              <div>
                <div className="small">السعر التقديري</div>
                <div style={{ fontWeight: 900 }}>{order.priceEstimated} {order.currency}</div>
              </div>
              <div>
                <div className="small">الوزن التقديري</div>
                <div style={{ fontWeight: 900 }}>{order.weightDeclaredKg} كغ</div>
              </div>
              <div>
                <div className="small">المحتويات</div>
                <div style={{ fontWeight: 900 }}>{order.contents}</div>
              </div>
            </div>

            <div className="sep" />

            <div className="grid md:grid-cols-2 gap-3">
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>المرسل</div>
                <div className="small">{order.senderAddress?.country} — {order.senderAddress?.city}</div>
                <div>{order.senderAddress?.line1}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>المستلم</div>
                <div className="small">{order.receiverAddress?.country} — {order.receiverAddress?.city}</div>
                <div>{order.receiverAddress?.line1}</div>
              </div>
            </div>

            <div className="sep" />

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>الدفع</div>
              <div className="small">الحالة: {payment?.status || "-"}</div>
              {payment?.receiptUrl ? (
                <a className="btn" href={`${API_BASE}${payment.receiptUrl}`} target="_blank" rel="noreferrer">
                  عرض الإيصال
                </a>
              ) : (
                <div className="small">لم يتم رفع إيصال بعد.</div>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>رفع إيصال الدفع</div>
              <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div className="small" style={{ marginTop: 8 }}>
                ارفع صورة أو PDF واضح. بعد الرفع تتحول الحالة إلى "PAYMENT_UNDER_REVIEW".
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn btnPrimary" onClick={uploadReceipt} type="button">رفع الإيصال</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
