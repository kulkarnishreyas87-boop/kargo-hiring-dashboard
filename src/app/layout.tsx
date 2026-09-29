import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kargo Hiring Dashboard",
  description: "Shortlist Arjun can trust — scored against Kargo's hire pattern, not the job spec.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight text-slate-900">
              Kargo <span className="text-slate-400 font-normal">/ Hiring</span>
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="text-slate-600 transition-colors hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/upload" className="text-slate-600 transition-colors hover:text-slate-900">
                Upload CVs
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
