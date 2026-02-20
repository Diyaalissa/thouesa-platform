"use client";
import { formatOrderNumber } from "../lib/orderNumber";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setErr("NOT_LOGGED_IN"); return; }

    fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setErr(d?.error || "LOAD_FAILED");
        else setOrders(d.orders || []);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">لوحة التحكم</h1>
        <Link className="btn btnPrimary" href="/dashboard/new-order">إنشاء طلب جديد</Link>
      </div>

      {err && <div className="border p-2 rounded text-red-700">خطأ: {err}</div>}

      <div className="card">
        <div className="cardHead">طلباتي</div>
        <div className="cardBody space-y-2">
          {orders.length === 0 && <div className="text-neutral-600">لا يوجد طلبات بعد.</div>}
          {orders.map(o => (
            <Link href={`/dashboard/orders/${o.id}`} className="card no-underline block">
              <div className="flex justify-between">
                <div>#{o.id.slice(0,8)} — {o.direction}</div>
                <span className={`statusPill ${o.status === "CONFIRMED" ? "ok" : (o.status === "PAYMENT_UNDER_REVIEW" ? "review" : "pending")}`}>{o.status}</span>
              </div>
              <div className="text-sm text-neutral-600">وزن تقديري: {o.weightDeclaredKg} كغ — سعر تقديري: {o.priceEstimated} {o.currency}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
