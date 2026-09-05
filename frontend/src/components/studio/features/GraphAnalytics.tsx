import React, { useMemo } from 'react';
import { useGraphState } from '@/lib/graphStore';

export default function GraphAnalytics() {
  const { nodes, edges } = useGraphState();

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let orphans = 0;

    nodes.forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1;
      
      const isConnected = edges.some(e => e.source === n.id || e.target === n.id);
      if (!isConnected) orphans++;
    });

    const density = nodes.length > 1 
      ? (edges.length / (nodes.length * (nodes.length - 1))).toFixed(3)
      : '0.000';

    return { counts, orphans, density };
  }, [nodes, edges]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border border-[#333] rounded">
      <div className="p-3 border-b border-[#333] bg-[#1a1d24]">
        <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 m-0">
          <span className="text-green-500">📊</span> Graph Analytics
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h4 className="text-white/50 text-[10px] uppercase font-bold tracking-wider m-0 border-b border-[#333] pb-1">Network Health</h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-[#1a1d24] border border-[#333] rounded p-2 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{stats.orphans}</span>
              <span className="text-white/50 text-[9px] uppercase tracking-wider">Orphan Nodes</span>
            </div>
            <div className="bg-[#1a1d24] border border-[#333] rounded p-2 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{stats.density}</span>
              <span className="text-white/50 text-[9px] uppercase tracking-wider">Edge Density</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-white/50 text-[10px] uppercase font-bold tracking-wider m-0 border-b border-[#333] pb-1">Entity Distribution</h4>
          <div className="flex flex-col gap-1 mt-1">
            {Object.entries(stats.counts).map(([type, count]) => {
              const percentage = (count / nodes.length) * 100;
              return (
                <div key={type} className="flex flex-col gap-1 py-1">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                    <span className="text-white/80">{type}</span>
                    <span className="text-white">{count}</span>
                  </div>
                  <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
