"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Network,
  Zap,
  Search,
  Plus,
  Trophy,
  Globe
} from "lucide-react";
import MasterMenuDrawer from "./MasterMenuDrawer";

export default function MasterNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Global keyboard shortcut: Ctrl+K or Cmd+K toggles Master Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsMenuOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isIntakeActive = pathname?.startsWith("/intake");
  const isPipelineActive = pathname === "/" || pathname?.startsWith("/site-intelligence");

  return (
    <>
      <header className="h-14 bg-[#0A0E1C]/95 backdrop-blur-md border-b border-slate-800/90 text-slate-100 flex items-center justify-between px-4 shrink-0 z-40 select-none">
        {/* Left: Master Menu & Brand & Primary Tabs */}
        <div className="flex items-center gap-3">
          {/* Master Menu Trigger */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white transition shadow-sm group"
            title="Open Master Menu (Ctrl+K)"
          >
            <Menu className="h-4 w-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold tracking-wide">Menu</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-xs ml-0.5">
              ⌘K
            </kbd>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:shadow-sky-500/30 transition">
              <Network className="h-4 w-4 text-white" />
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-sky-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                  Teams & Dreams
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Ops
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none">Sports Intelligence Hub</p>
            </div>
          </Link>

          <div className="h-5 w-px bg-slate-800 ml-1" />

          {/* Core Route Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 text-xs">
            <Link
              href="/intake"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                isIntakeActive
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Network className="h-3.5 w-3.5 text-sky-400" />
              <span>Intake Studio</span>
            </Link>
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                isPipelineActive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Pipeline Ops</span>
            </Link>
          </nav>
        </div>

        {/* Center: Command Search Bar */}
        <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs transition"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <span>Search sports, scrapers...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Metrics & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Metrics */}
          <div className="hidden xl:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300">
              <Trophy className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-medium">4 Sports Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300">
              <Globe className="h-3 w-3 text-sky-400" />
              <span className="text-[11px] font-medium">12 Monitored Sites</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono">Engine Online</span>
            </div>
          </div>

          {/* Quick Onboard Action */}
          <Link
            href="/intake?action=new"
            className="px-3 py-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-950/40 flex items-center gap-1.5 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Sport</span>
          </Link>
        </div>
      </header>

      {/* Master Menu Slide-Over Drawer */}
      <MasterMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSelectSport={(sportId) => {
          setIsMenuOpen(false);
          router.push(`/intake?sport=${sportId}`);
        }}
      />
    </>
  );
}
