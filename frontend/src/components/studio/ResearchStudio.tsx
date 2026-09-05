import React, { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './GraphCanvas';
import NodePalette from './panels/NodePalette';
import NodeInspector from './panels/NodeInspector';
import PipelinePanel from './pipeline/PipelinePanel';
import GraphAnalytics from './features/GraphAnalytics';
import ComparisonView from './features/ComparisonView';
import ExportPanel from './features/ExportPanel';
import '@xyflow/react/dist/style.css';

export default function ResearchStudio() {
  const [activePanel, setActivePanel] = useState<'inspector' | 'pipeline' | 'research'>('inspector');

  return (
    <div className="flex h-full w-full bg-[#0a0a0c]">
      <ReactFlowProvider>
        <NodePalette />
        <div className="flex-1 relative h-full">
          <GraphCanvas />
        </div>
        
        <div className="flex flex-col h-full bg-[#0a0a0c] border-l border-[#333]">
          <div className="flex border-b border-[#333]">
            <button 
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activePanel === 'inspector' ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white/80'}`}
              onClick={() => setActivePanel('inspector')}
            >
              Inspector
            </button>
            <button 
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activePanel === 'pipeline' ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white/80'}`}
              onClick={() => setActivePanel('pipeline')}
            >
              Pipeline
            </button>
            <button 
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activePanel === 'research' ? 'text-white border-b-2 border-green-500' : 'text-white/50 hover:text-white/80'}`}
              onClick={() => setActivePanel('research')}
            >
              Research
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden">
            {activePanel === 'inspector' && <NodeInspector />}
            {activePanel === 'pipeline' && <PipelinePanel />}
            {activePanel === 'research' && (
              <div className="w-96 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-[#0a0a0c]">
                <GraphAnalytics />
                <ComparisonView />
                <ExportPanel />
              </div>
            )}
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
