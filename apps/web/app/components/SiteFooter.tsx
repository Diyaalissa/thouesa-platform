"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

type PublicSettings = {
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  promoActive?: boolean;
  promoName?: string | null;
  promoDiscountPercent?: number | null;
};

export default function SiteFooter() {
  const [s, setS] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings/public`)
      .then((r) => r.json())
      .then((d) => setS(d))
      .catch(() => setS(null));
  }, []);

  return (
    <footer className="mt-10 small" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        تحويسة - THOUESA
        {s?.promoActive && (
          <span className="badge" style={{ marginInlineStart: 10 }}>
            عروض{ s?.promoName ? `: ${s.promoName}` : "" }
            {typeof s?.promoDiscountPercent === "number" ? ` (${s.promoDiscountPercent}% )` : ""}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/legal/terms" className="badge">الشروط والأحكام</Link>
        <Link href="/legal/privacy" className="badge">الخصوصية</Link>
        <Link href="/contact" className="badge">التواصل</Link>
        {s?.facebookUrl && <a href={s.facebookUrl} target="_blank" rel="noreferrer" className="badge">فيسبوك</a>}
        {s?.whatsappUrl && <a href={s.whatsappUrl} target="_blank" rel="noreferrer" className="badge">واتساب</a>}
      </div>
    </footer>
  );
}
