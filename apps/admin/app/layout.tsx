import "./globals.css";
import Link from "next/link";

export const metadata = { title: "THOUESA Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        <div className="mx-auto max-w-5xl p-4">
          <header className="topbar">
            <Link href="/" className="brandRow">
              <span className="brandDot" aria-hidden="true" />
              <span>
                <div style={{ fontWeight: 950, color: "var(--brand)" }}>تحويسة - لوحة الإدارة</div>
                <div className="small">Admin Portal</div>
              </span>
            </Link>
          </header>
          <main className="mt-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
