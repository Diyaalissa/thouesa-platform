import Link from "next/link";

export default function PurchaseInfoPage() {
  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">كيفية طلب الشراء من Temu / SHEIN</div>
      </div>
      <div className="cardBody space-y-2">
        <ol className="list-decimal pr-6">
          <li>اختر المتجر (Temu أو SHEIN أو غيره).</li>
          <li>انسخ رابط المنتج أو رقم المنتج (Product ID / SKU).</li>
          <li>حدد اللون/المقاس/الكمية في الملاحظات.</li>
          <li>أدخل سعر المنتج بالدولار (USD) والجمرك إن وجد.</li>
        </ol>
        <div className="sep" />
        <div className="small">لبدء الطلب يجب تسجيل الدخول أولاً.</div>
        <div className="flex gap-2 flex-wrap">
          <Link className="btn btnPrimary" href="/auth/login">تسجيل الدخول</Link>
          <Link className="btn" href="/dashboard/purchase">الذهاب لشراء (من داخل الحساب)</Link>
        </div>
      </div>
    </div>
  );
}
