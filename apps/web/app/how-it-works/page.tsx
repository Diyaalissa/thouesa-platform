export default function HowItWorksPage() {
  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">كيف نعمل؟</div>
      </div>
      <div className="cardBody space-y-2">
        <ol className="list-decimal pr-6">
          <li>أنشئ حساباً بالبريد ورقم الهاتف (الأردن/الجزائر).</li>
          <li>من لوحة التحكم اختر: توصيل بين البلدين أو شراء من المتاجر العالمية.</li>
          <li>أدخل بيانات المرسل/المستلم والوزن والمحتوى.</li>
          <li>ادفع وفق الطريقة المتاحة وارفع الإيصال.</li>
          <li>نراجع الطلب ونؤكده ثم نتابع الشحن حتى التسليم.</li>
        </ol>
        <div className="small">ملاحظة: الالتزام بالشروط والأحكام مطلوب، وتطبق قوانين الجمركة في البلدين.</div>
      </div>
    </div>
  );
}
