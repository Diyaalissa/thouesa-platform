"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Marketplace = "TEMU" | "SHEIN" | "OTHER";

export default function NewOrderPage() {
  const r = useRouter();

  const [direction, setDirection] = useState<"JO_TO_DZ" | "DZ_TO_JO">("JO_TO_DZ");
  const [weight, setWeight] = useState(1);
  const [contents, setContents] = useState("ملابس");

  const [assistedPurchase, setAssistedPurchase] = useState(false);
  const [marketplace, setMarketplace] = useState<Marketplace>("TEMU");
  const [productCode, setProductCode] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productPriceUsd, setProductPriceUsd] = useState<number | "">("");
  const [customsUsd, setCustomsUsd] = useState<number | "">("");
  const [purchaseNotes, setPurchaseNotes] = useState("");

  const [insuranceRequested, setInsuranceRequested] = useState(false);
  const [declaredValue, setDeclaredValue] = useState<number | "">("");

  const [estimate, setEstimate] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const [senderCity, setSenderCity] = useState("Amman");
  const [senderAddr, setSenderAddr] = useState("...");
  const [receiverCity, setReceiverCity] = useState("Algiers");
  const [receiverAddr, setReceiverAddr] = useState("...");

  const commissionUsd = useMemo(() => {
    if (!assistedPurchase) return 0;
    const p = productPriceUsd === "" ? 0 : Number(productPriceUsd);
    const c = customsUsd === "" ? 0 : Number(customsUsd);
    return Math.round(((p + c) * 0.02) * 100) / 100;
  }, [assistedPurchase, productPriceUsd, customsUsd]);

  const purchaseDetailsJson = useMemo(() => {
    if (!assistedPurchase) return undefined;

    return JSON.stringify({
      type: "ECOM_PURCHASE",
      marketplace,
      productCode: productCode || undefined,
      productUrl: productUrl || undefined,
      productPriceUsd: productPriceUsd === "" ? undefined : Number(productPriceUsd),
      customsUsd: customsUsd === "" ? undefined : Number(customsUsd),
      commissionUsd,
      notes: purchaseNotes || undefined,
      pricingNotes:
        "Shipping fee is calculated by weight separately from product price. Commission is 2% of (product+customs if any).",
    });
  }, [assistedPurchase, marketplace, productCode, productUrl, productPriceUsd, customsUsd, commissionUsd, purchaseNotes]);

  async function doEstimate() {
    setErr(null);

    const effDirection = assistedPurchase ? "JO_TO_DZ" : direction; // purchase flow is Jordan -> Algeria
    const res = await fetch(`${API}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: effDirection, weightKg: Number(weight) }),
    });
    const data = await res.json();
    if (!res.ok) return setErr(data?.error || "ESTIMATE_FAILED");
    setEstimate(data);
  }

  async function submit() {
    setErr(null);
    const token = localStorage.getItem("token");
    if (!token) return setErr("NOT_LOGGED_IN");
    if (!estimate) return setErr("PLEASE_ESTIMATE_FIRST");

    if (assistedPurchase) {
      if (!productCode && !productUrl) return setErr("PLEASE_ADD_PRODUCT_CODE_OR_URL");
      if (productPriceUsd === "") return setErr("PLEASE_ADD_PRODUCT_PRICE_USD");
    }

    const effDirection = assistedPurchase ? "JO_TO_DZ" : direction;

    const body = {
      direction: effDirection,
      sender: { country: effDirection === "JO_TO_DZ" ? "Jordan" : "Algeria", city: senderCity, line1: senderAddr },
      receiver: { country: effDirection === "JO_TO_DZ" ? "Algeria" : "Jordan", city: receiverCity, line1: receiverAddr },
      weightDeclaredKg: Number(weight),
      contents: assistedPurchase ? "طلب شراء من متجر إلكتروني" : contents,
      declaredValue: declaredValue === "" ? undefined : Number(declaredValue),
      assistedPurchase,
      purchaseDetails: assistedPurchase ? purchaseDetailsJson : undefined,
      insuranceRequested,
      insuranceValue: insuranceRequested && declaredValue !== "" ? Number(declaredValue) : undefined,
      priceEstimated: estimate.estimatedPrice, // shipping estimate only
      currency: estimate.currency,
    };

    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return setErr(data?.error || "CREATE_FAILED");

    r.push("/dashboard");
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1" style={{ fontSize: 24 }}>إنشاء طلب جديد</h1>
        <Link className="btn" href="/purchase-info">شرح طلب الشراء</Link>
      </div>

      {err && <div className="card" style={{ padding: 14, borderColor: "rgba(239,68,68,.35)" }}>خطأ: {err}</div>}

      <div className="card">
        <div className="cardBody space-y-3">
          <label className="space-y-1">
            <div className="text-sm">الاتجاه</div>
            <select
              className="input"
              value={assistedPurchase ? "JO_TO_DZ" : direction}
              onChange={(e) => setDirection(e.target.value as any)}
              disabled={assistedPurchase}
              title={assistedPurchase ? "طلب الشراء يعمل ضمن الأردن → الجزائر" : ""}
            >
              <option value="JO_TO_DZ">الأردن → الجزائر</option>
              <option value="DZ_TO_JO">الجزائر → الأردن</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm">الوزن (كغ)</div>
            <input className="input" type="number" min={0.1} step={0.1} value={weight} onChange={(e)=>setWeight(Number(e.target.value))} />
          </label>

          {!assistedPurchase && (
            <label className="space-y-1">
              <div className="text-sm">المحتويات</div>
              <input className="input" value={contents} onChange={(e)=>setContents(e.target.value)} />
            </label>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-sm">مدينة المرسل</div>
              <input className="input" value={senderCity} onChange={(e)=>setSenderCity(e.target.value)} />
            </label>
            <label className="space-y-1">
              <div className="text-sm">عنوان المرسل</div>
              <input className="input" value={senderAddr} onChange={(e)=>setSenderAddr(e.target.value)} />
            </label>
            <label className="space-y-1">
              <div className="text-sm">مدينة المستلم</div>
              <input className="input" value={receiverCity} onChange={(e)=>setReceiverCity(e.target.value)} />
            </label>
            <label className="space-y-1">
              <div className="text-sm">عنوان المستلم</div>
              <input className="input" value={receiverAddr} onChange={(e)=>setReceiverAddr(e.target.value)} />
            </label>
          </div>

          <div className="sep" />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={assistedPurchase} onChange={(e)=>{ setAssistedPurchase(e.target.checked); setEstimate(null); }} />
            <span>شراء منتجات (Temu / SHEIN / وغيرها)</span>
          </label>

          {assistedPurchase && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>تفاصيل المنتج (بالدولار USD)</div>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-sm">المتجر</div>
                  <select className="input" value={marketplace} onChange={(e)=>setMarketplace(e.target.value as any)}>
                    <option value="TEMU">Temu</option>
                    <option value="SHEIN">SHEIN</option>
                    <option value="OTHER">Other (AliExpress/eBay/...)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-sm">رقم المنتج (Product ID / SKU)</div>
                  <input className="input" value={productCode} onChange={(e)=>setProductCode(e.target.value)} placeholder="مثال: 123456789" />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-sm">رابط المنتج (اختياري)</div>
                  <input className="input" value={productUrl} onChange={(e)=>setProductUrl(e.target.value)} placeholder="https://..." />
                </label>

                <label className="space-y-1">
                  <div className="text-sm">سعر المنتج (USD)</div>
                  <input className="input" type="number" min={0} step={0.01} value={productPriceUsd} onChange={(e)=>setProductPriceUsd(e.target.value === "" ? "" : Number(e.target.value))} />
                </label>

                <label className="space-y-1">
                  <div className="text-sm">الجمرك/الرسوم (USD) إن وجدت</div>
                  <input className="input" type="number" min={0} step={0.01} value={customsUsd} onChange={(e)=>setCustomsUsd(e.target.value === "" ? "" : Number(e.target.value))} />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-sm">ملاحظات (مقاس/لون/كمية...)</div>
                  <textarea className="input" rows={3} value={purchaseNotes} onChange={(e)=>setPurchaseNotes(e.target.value)} />
                </label>
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                سيتم إضافة عمولة خدمة 2% على (قيمة المنتج + الجمرك إن وُجد) بعد تحديدها. العمولة الحالية: <b>{commissionUsd}</b> USD.
              </div>
            </div>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={insuranceRequested} onChange={(e)=>setInsuranceRequested(e.target.checked)} />
            <span>تأمين الشحنة (اختياري)</span>
          </label>

          <label className="space-y-1">
            <div className="text-sm">قيمة مصرح بها (اختياري)</div>
            <input className="input" type="number" min={0} step={0.01} value={declaredValue} onChange={(e)=>setDeclaredValue(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>

          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={doEstimate} type="button">احسب سعر التوصيل حسب الوزن</button>
            <button className="btn btnPrimary" onClick={submit} type="button">إرسال الطلب</button>
          </div>

          {estimate && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>سعر التوصيل التقديري</div>
              <div className="small">
                {estimate.weightKg} كغ — {estimate.estimatedPrice} {estimate.currency}
              </div>
              {assistedPurchase && (
                <div className="small" style={{ marginTop: 8 }}>
                  ملاحظة: سعر المنتج بالدولار (USD) يُسجل ضمن تفاصيل الطلب، بينما سعر التوصيل أعلاه يعتمد على الوزن.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
