'use client';

export default function HomePage() {
  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%" }}>
        <div className="cardHead">
          <div className="cardTitle">تحويسة - THOUESA</div>
        </div>

        <div className="cardBody space-y-3">
          <div className="small">مرحباً بك. سجّل دخولك أو أنشئ حساباً للمتابعة.</div>

          <div className="flex gap-2 flex-wrap">
            <a className="btn btnPrimary" href="/login">تسجيل الدخول</a>
            <a className="btn" href="/register">إنشاء حساب</a>
          </div>

          <div className="sep" />

          <div className="flex gap-2 flex-wrap">
            <a className="badge" href="/how-it-works">كيف نعمل؟</a>
            <a className="badge" href="/faq">الأسئلة الشائعة</a>
            <a className="badge" href="/track">تتبع الطلب</a>
          </div>
        </div>
      </div>
    </div>
  );
}
