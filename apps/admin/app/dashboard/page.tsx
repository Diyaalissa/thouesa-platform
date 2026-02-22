"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

type Order = any;

function statusClass(status: string) {
  if (status === "CONFIRMED" || status === "DELIVERED" || status === "SHIPPED") return "ok";
  if (status === "REJECTED" || status === "CANCELLED") return "bad";
  if (status === "PAYMENT_UNDER_REVIEW") return "review";
  return "pending";
}

function toCsv(rows: Record<string, any>[]) {
  const esc = (v: any) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [logsCache, setLogsCache] = useState<Record<string, any[]>>({});
  const [logFilter, setLogFilter] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function api(path: string, init: RequestInit = {}) {
    const token = localStorage.getItem("admin_token");
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }

  async function load() {
    const r = await api("/admin/orders");
    const d = await r.json();
    if (!r.ok) {
      setErr(d?.error || "LOAD_FAILED");
      return;
    }
    setOrders(d.orders || []);
  }

  // ✅ moved to component scope (was incorrectly nested inside load())
  async function loadLogs(orderId: string) {
    if (logsCache[orderId]) return;
    const r = await api(`/admin/orders/${orderId}/logs`);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "LOGS_FAILED");
    setLogsCache((prev) => ({ ...prev, [orderId]: d.logs || [] }));
  }

  useEffect(() => {
    load().catch(() => setErr("LOAD_FAILED"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm(orderId: string, approve: boolean) {
    setErr(null);
    setMsg(null);

    const weightFinalKgStr = (document.getElementById(`w_${orderId}`) as HTMLInputElement | null)?.value;
    const priceFinalStr = (document.getElementById(`p_${orderId}`) as HTMLInputElement | null)?.value;
    const weightFinalKg = weightFinalKgStr ? Number(weightFinalKgStr) : undefined;
    const priceFinal = priceFinalStr ? Number(priceFinalStr) : undefined;

    const res = await api(`/admin/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, weightFinalKg, priceFinal }),
    });

    const d = await res.json();
    if (!res.ok) return setErr(d?.error || "ACTION_FAILED");
    setMsg(approve ? "تم تأكيد الدفع." : "تم رفض الدفع.");
    await load();
  }

  function logout() {
    localStorage.removeItem("admin_token");
    location.href = "/";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1" style={{ fontSize: 24 }}>
          لوحة الإدارة
        </h1>
        <div className="flex gap-2 flex-wrap">
          <a className="btn" href="/settings">
            الإعدادات
          </a>
          <button className="btn" onClick={logout} type="button">
            تسجيل خروج
          </button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ padding: 14, borderColor: "rgba(239,68,68,.35)" }}>
          خطأ: {err}
        </div>
      )}
      {msg && (
        <div className="card" style={{ padding: 14, borderColor: "rgba(34,197,94,.35)" }}>
          {msg}
        </div>
      )}

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
                    <div style={{ fontWeight: 950 }}>
                      {o.orderNumber || o.id.slice(0, 10)} — {o.direction}
                    </div>
                    <div className="small">
                      {o.user?.fullName} — {o.user?.email}
                    </div>
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
                    <div style={{ fontWeight: 900 }}>
                      {o.priceEstimated} {o.currency}
                    </div>
                  </div>
                  <div>
                    <div className="small">وزن نهائي</div>
                    <input id={`w_${o.id}`} className="input" defaultValue={o.weightFinalKg ?? ""} />
                  </div>
                  <div>
                    <div className="small">سعر نهائي</div>
                    <input id={`p_${o.id}`} className="input" defaultValue={o.priceFinal ?? ""} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }} className="flex gap-2 flex-wrap items-center">
                  <button
                    className="btn"
                    type="button"
                    onClick={async () => {
                      const next = !openLogs[o.id];
                      setOpenLogs((p) => ({ ...p, [o.id]: next }));
                      if (next) {
                        try {
                          await loadLogs(o.id);
                        } catch (e: any) {
                          setErr(e?.message || "LOGS_FAILED");
                        }
                      }
                    }}
                  >
                    سجل الحالة
                  </button>

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

                {openLogs[o.id] && (
                  <div style={{ marginTop: 10 }} className="card">
                    <div className="cardHead">
                      <div className="cardTitle">سجل تغيّر الحالة</div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <select
                          className="input"
                          style={{ padding: "6px 10px", minWidth: 180 }}
                          value={logFilter[o.id] || "ALL"}
                          onChange={(e) => setLogFilter((p) => ({ ...p, [o.id]: e.target.value }))}
                        >
                          <option value="ALL">كل الحالات</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="REJECTED">REJECTED</option>
                          <option value="PAYMENT_UNDER_REVIEW">PAYMENT_UNDER_REVIEW</option>
                          <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>

                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            const logs = (logsCache[o.id] || []).slice().reverse();
                            const rows = logs.map((l: any) => ({
                              orderNumber: o.orderNumber || o.id,
                              fromStatus: l.fromStatus || "",
                              toStatus: l.toStatus || "",
                              createdAt: new Date(l.createdAt).toISOString(),
                              actorName: l.actor?.fullName || "",
                              actorEmail: l.actor?.email || "",
                              note: l.note || "",
                            }));
                            downloadCsv(`order-${o.orderNumber || o.id}-status-log.csv`, toCsv(rows));
                          }}
                        >
                          تصدير CSV
                        </button>

                        <div className="badge">{(logsCache[o.id] || []).length}</div>
                      </div>
                    </div>

                    <div className="cardBody space-y-2">
                      {(logsCache[o.id] || []).length === 0 && <div className="small">لا يوجد سجل.</div>}

                      {(logsCache[o.id] || [])
                        .filter((l: any) => ((logFilter[o.id] || "ALL") === "ALL" ? true : l.toStatus === (logFilter[o.id] || "ALL")))
                        .map((l: any) => (
                          <div key={l.id} className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span className="badge">
                              {l.fromStatus || "—"} → {l.toStatus}
                            </span>
                            <span>{new Date(l.createdAt).toLocaleString()}</span>
                            <span className="small" style={{ color: "var(--muted)" }}>
                              {l.actor?.fullName ? `بواسطة: ${l.actor.fullName}` : ""}
                            </span>
                            {l.note && (
                              <span className="small" style={{ color: "var(--muted)" }}>
                                ({l.note})
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}