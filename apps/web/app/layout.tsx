import "./globals.css";
import Link from "next/link";
import AuthActions from "./components/AuthActions";
import CustomerNav from "./components/CustomerNav";
import SiteFooter from "./components/SiteFooter";

export const metadata = {
  title: "THOUESA - THOUESA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        <div className="mx-auto max-w-5xl p-4">
          <header className="topbar">
            <Link href="/" className="brandRow">
              <span className="brandDot" aria-hidden="true" />
              <span>
                <div style={{ fontWeight: 950, color: "var(--brand)" }}>تحويسة - THOUESA</div>
                <div className="small">شحن وتوصيل الأردن ⇄ الجزائر</div>
              </span>
            </Link>
            <CustomerNav />

            <AuthActions />
          </header>

          <main className="mt-4">{children}</main>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
