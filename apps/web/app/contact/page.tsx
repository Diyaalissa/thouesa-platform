"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

type PublicSettings = { facebookUrl?: string | null; whatsappUrl?: string | null };

export default function ContactPage() {
  const [s, setS] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings/public`)
      .then((r) => r.json())
      .then((d) => setS(d))
      .catch(() => setS(null));
  }, []);

  return (
    <div className="card">
      <div className="cardHead">
        <div className="cardTitle">معلومات التواصل</div>
      </div>
      <div className="cardBody space-y-2">
        <ul className="list-disc pr-6">
          <li>
            فيسبوك:{" "}
            {s?.facebookUrl ? (
              <a href={s.facebookUrl} target="_blank" rel="noreferrer">فتح صفحة تحويسة</a>
            ) : (
              <span className="small">غير محدد</span>
            )}
          </li>
          <li>
            واتساب:{" "}
            {s?.whatsappUrl ? (
              <a href={s.whatsappUrl} target="_blank" rel="noreferrer">فتح محادثة واتساب</a>
            ) : (
              <span className="small">غير محدد</span>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
