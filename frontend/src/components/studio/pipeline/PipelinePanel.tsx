import React, { useState } from 'react';
import { useOnSelectionChange } from '@xyflow/react';
import { useGraphState } from '@/lib/graphStore';
import { ResearchNode } from '@/lib/graphTypes';
import ScraperPanel from './ScraperPanel';
import VerifyPanel from './VerifyPanel';

type PipelineStage = 'discover' | 'map' | 'configure' | 'scrape' | 'verify';

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'map', label: 'Map' },
  { id: 'configure', label: 'Configure' },
  { id: 'scrape', label: 'Scrape' },
  { id: 'verify', label: 'Verify' }
];

export default function PipelinePanel() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { nodes } = useGraphState();
  const [activeStage, setActiveStage] = useState<PipelineStage>('scrape');

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      const sourceNode = selectedNodes.find(n => n.type === 'web_source');
      if (sourceNode) {
        setSelectedNodeId(sourceNode.id);
      } else {
        setSelectedNodeId(null);
      }
    },
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as ResearchNode | undefined;

  if (!selectedNode || selectedNode.type !== 'web_source') {
    return (
      <div className="w-96 flex flex-col h-full p-4">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50 text-sm font-bold uppercase tracking-widest text-center">
            Select a Web Source<br/>to view Pipeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 flex flex-col h-full">
      <div className="p-4 border-b border-[#333]">
        <h2 className="text-white font-bold m-0 uppercase tracking-widest text-sm flex items-center gap-2">
          <span className="text-blue-500">⚡</span> Pipeline Ops
        </h2>
        <p className="text-white/50 text-xs m-0 truncate mt-1">Source: {selectedNode.data.label || selectedNode.id}</p>
      </div>
      
      {/* Stepper */}
      <div className="px-4 py-3 border-b border-[#333] flex justify-between">
        {STAGES.map((stage, idx) => (
          <div 
            key={stage.id} 
            className={`flex flex-col items-center cursor-pointer ${activeStage === stage.id ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
            onClick={() => setActiveStage(stage.id)}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1
              ${activeStage === stage.id ? 'bg-blue-500 text-white' : 'bg-[#333] text-white/50'}
            `}>
              {idx + 1}
            </div>
            <span className="text-[9px] uppercase tracking-wider font-bold text-white">{stage.label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeStage === 'scrape' && <ScraperPanel nodeId={selectedNode.id} />}
        {activeStage === 'verify' && <VerifyPanel nodeId={selectedNode.id} />}
        {['discover', 'map', 'configure'].includes(activeStage) && (
          <div className="p-6 flex items-center justify-center h-full text-white/30 text-xs uppercase tracking-widest text-center">
            {activeStage} Stage<br/>(Coming Soon)
          </div>
        )}
      </div>
    </div>
  );
}
