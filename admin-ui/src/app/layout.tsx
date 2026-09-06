import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import MasterNav from "@/components/navigation/MasterNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Teams & Dreams | Sports Intelligence Hub & Pipeline Ops",
  description: "Workflow-oriented site management and knowledge graph studio for sports data scraping pipelines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full flex flex-col bg-[#090D1A] text-slate-100 overflow-hidden">
        <MasterNav />
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</div>
      </body>
    </html>
  );
}
