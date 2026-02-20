"use client";

import Link from "next/link";

export default function PurchaseEntryPage() {
  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">شراء من Temu / SHEIN والمتاجر العالمية</div>
        <div className="badge">من داخل الحساب</div>
      </div>
      <div className="cardBody space-y-2">
        <div className="small">
          هذه الخدمة متاحة فقط بعد تسجيل الدخول. اختر المتجر وأدخل رقم المنتج/الرابط والسعر بالدولار.
        </div>
        <Link className="btn btnPrimary" href="/dashboard/new-order?service=PURCHASE_GLOBAL">ابدأ طلب شراء عالمي</Link>
      </div>
    </div>
  );
}
