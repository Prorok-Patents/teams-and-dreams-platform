import React from 'react';

export default function ComparisonView() {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border border-[#333] rounded">
      <div className="p-3 border-b border-[#333] flex justify-between items-center bg-[#1a1d24]">
        <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
          <span className="text-purple-500">🔄</span> Snapshot Comparison
        </h3>
        <select className="bg-[#0a0a0c] text-white text-[10px] uppercase border border-[#333] rounded px-2 py-1">
          <option>Current vs Last Week</option>
          <option>Current vs Baseline</option>
        </select>
      </div>
      
      <div className="flex-1 flex p-4 gap-4">
        {/* Mock Diff view */}
        <div className="flex-1 border border-red-900/50 bg-red-950/20 rounded p-3 flex flex-col gap-2">
          <h4 className="text-red-400 font-bold text-[10px] uppercase tracking-widest text-center border-b border-red-900/50 pb-2">Previous (Last Week)</h4>
          <div className="flex-1 flex items-center justify-center text-red-500/50 text-xs">
            Missing 3 Competitions
          </div>
        </div>
        
        <div className="flex-1 border border-green-900/50 bg-green-950/20 rounded p-3 flex flex-col gap-2">
          <h4 className="text-green-400 font-bold text-[10px] uppercase tracking-widest text-center border-b border-green-900/50 pb-2">Current State</h4>
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className="text-green-400 text-xs">+ Added League A</span>
            <span className="text-green-400 text-xs">+ Added League B</span>
            <span className="text-green-400 text-xs">+ Added Cup C</span>
          </div>
        </div>
      </div>
      
      <div className="p-3 border-t border-[#333] bg-[#1a1d24] flex justify-end gap-2">
        <button className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white text-[10px] font-bold uppercase rounded">
          Restore Previous
        </button>
        <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase rounded">
          Merge Changes
        </button>
      </div>
    </div>
  );
}
