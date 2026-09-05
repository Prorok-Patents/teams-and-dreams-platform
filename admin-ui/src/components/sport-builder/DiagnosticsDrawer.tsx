"use client";

import React from "react";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ShieldCheck,
  Compass
} from "lucide-react";
import { GraphDiagnosticReport, DiagnosticItem } from "./graphDiagnostics";

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: GraphDiagnosticReport;
  onSelectNode: (nodeId: string) => void;
  onAutoFix?: (item: DiagnosticItem) => void;
}

export default function DiagnosticsDrawer({
  isOpen,
  onClose,
  report,
  onSelectNode,
  onAutoFix
}: DiagnosticsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#0C1226]/95 border-l border-[#1E293B] shadow-2xl backdrop-blur-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#1E293B] flex items-center justify-between shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Graph Diagnostics & Linter
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="p-4 border-b border-[#1E293B] bg-slate-950/40">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300">Intake Readiness</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
              report.isValid
                ? report.warningCount === 0
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "bg-amber-950 text-amber-300 border border-amber-800"
                : "bg-rose-950 text-rose-300 border border-rose-800"
            }`}
          >
            {report.isValid
              ? report.warningCount === 0
                ? "100% Ready"
                : `${report.warningCount} Warning${report.warningCount > 1 ? "s" : ""}`
              : `${report.errorCount} Blocking Error${report.errorCount > 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-lg font-bold font-mono text-rose-400">{report.errorCount}</div>
            <div className="text-[10px] text-slate-500 uppercase">Errors</div>
          </div>
          <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-lg font-bold font-mono text-amber-400">{report.warningCount}</div>
            <div className="text-[10px] text-slate-500 uppercase">Warnings</div>
          </div>
          <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-lg font-bold font-mono text-sky-400">{report.infoCount}</div>
            <div className="text-[10px] text-slate-500 uppercase">Notices</div>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {report.items.length === 0 && (
          <div className="p-6 bg-emerald-950/20 border border-emerald-800/60 rounded-2xl text-center space-y-2 text-emerald-300">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
            <div className="font-semibold text-sm">Clean Graph Topology!</div>
            <p className="text-[11px] opacity-80">
              No disconnected nodes, invalid URLs, or missing roots found. Your graph is optimal for discovery execution.
            </p>
          </div>
        )}

        {report.items.map(item => {
          const isError = item.severity === "error";
          const isWarning = item.severity === "warning";

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border space-y-1.5 transition ${
                isError
                  ? "bg-rose-950/30 border-rose-800/80 text-rose-200"
                  : isWarning
                  ? "bg-amber-950/30 border-amber-800/80 text-amber-200"
                  : "bg-sky-950/30 border-sky-800/80 text-sky-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  {isError ? (
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                  ) : isWarning ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Info className="h-4 w-4 text-sky-400" />
                  )}
                  <span>{item.title}</span>
                </div>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40">
                  {item.severity}
                </span>
              </div>

              <p className="text-[11px] opacity-90 leading-relaxed">{item.message}</p>

              {item.nodeId && (
                <div className="pt-1 flex items-center justify-between border-t border-white/10">
                  <button
                    onClick={() => {
                      if (item.nodeId) onSelectNode(item.nodeId);
                    }}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <Compass className="h-3 w-3" /> Locate Node
                  </button>

                  {item.fixAction === "connect_to_sport" && onAutoFix && (
                    <button
                      onClick={() => onAutoFix(item)}
                      className="text-[10px] font-medium px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-mono"
                    >
                      Auto-Link
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
