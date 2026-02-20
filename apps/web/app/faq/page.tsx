export default function FaqPage() {
  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">الأسئلة الشائعة</div>
      </div>
      <div className="cardBody space-y-3">
        <div>
          <b>كيف يتم تسعير الشحن؟</b>
          <div className="small">يتم التسعير حسب الوزن. الأسعار يمكن أن تتغير حسب إعدادات الإدارة والعروض.</div>
        </div>
        <div>
          <b>هل يمكنني طلب شراء من Temu / SHEIN؟</b>
          <div className="small">نعم من داخل حسابك عبر (شراء عالمي) مع إدخال رابط/رقم المنتج والسعر بالدولار.</div>
        </div>
        <div>
          <b>متى يتم تأكيد الطلب؟</b>
          <div className="small">لا يتم تأكيد الطلب إلا بعد الدفع ورفع الإيصال ومراجعته من الإدارة.</div>
        </div>
        <div>
          <b>كيف أتواصل معكم؟</b>
          <div className="small">عبر واتساب أو رسائل الصفحة حسب الروابط الموجودة أسفل الموقع.</div>
        </div>
      </div>
    </div>
  );
}
