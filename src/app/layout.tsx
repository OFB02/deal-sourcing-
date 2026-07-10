import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal Sourcing · Udlejningsejendomme",
  description:
    "Screening og deal sourcing af danske udlejningsejendomme - automatisk registerdata plus manuel indhentning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        <nav className="topbar">
          <Link href="/" className="brand">
            Deal<span>Sourcing</span>
          </Link>
          <Link href="/">Pipeline</Link>
          <Link href="/datakilder">Datakilder</Link>
          <Link href="/deals/new" className="ny-deal">
            + Ny deal
          </Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
