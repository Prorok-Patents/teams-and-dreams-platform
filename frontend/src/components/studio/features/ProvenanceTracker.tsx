import React from 'react';
import { useGraphState } from '@/lib/graphStore';

export default function ProvenanceTracker({ nodeId }: { nodeId: string }) {
  const { nodes } = useGraphState();
  const node = nodes.find(n => n.id === nodeId);

  if (!node) return null;

  // Mock provenance data based on node type
  const getProvenance = () => {
    if (node.type === 'event') {
      return { source: 'Scraper (wiki-parser)', confidence: 0.92, verified: false, date: '2026-08-11' };
    }
    if (node.type === 'organization') {
      return { source: 'LLM Extraction (GPT-4)', confidence: 0.85, verified: true, date: '2026-08-10' };
    }
    return { source: 'Manual Entry', confidence: 1.0, verified: true, date: '2026-08-01' };
  };

  const prov = getProvenance();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-white/70 text-xs font-bold uppercase tracking-wider">Provenance</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${prov.verified ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
          {prov.verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      
      <div className="bg-[#1a1d24] rounded border border-[#333] p-3 text-xs flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-white/50">Origin Source:</span>
          <span className="text-white font-mono">{prov.source}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/50">Confidence Score:</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[#333] rounded-full overflow-hidden">
              <div 
                className={`h-full ${prov.confidence > 0.9 ? 'bg-green-500' : prov.confidence > 0.7 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${prov.confidence * 100}%` }}
              />
            </div>
            <span className="text-white font-mono">{(prov.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Discovered On:</span>
          <span className="text-white">{prov.date}</span>
        </div>
      </div>

      {!prov.verified && (
        <div className="flex gap-2">
          <button className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-[10px] font-bold uppercase">
            Verify Data
          </button>
          <button className="flex-1 bg-red-600 hover:bg-red-500 text-white py-1.5 rounded text-[10px] font-bold uppercase">
            Dispute
          </button>
        </div>
      )}
    </div>
  );
}
