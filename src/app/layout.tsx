import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
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
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 group">
              <span className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-105">
                K
              </span>
              Kargo <span className="text-slate-400 font-normal">/ Hiring</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
