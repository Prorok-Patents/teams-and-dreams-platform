import React, { useState } from 'react';
import { useOnSelectionChange, useReactFlow } from '@xyflow/react';
import { useGraphState } from '@/lib/graphStore';
import { ResearchNode } from '@/lib/graphTypes';
import ProvenanceTracker from '../features/ProvenanceTracker';

export default function NodeInspector() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { setNodes } = useReactFlow();
  const { nodes, updateNodeData } = useGraphState();

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      } else {
        setSelectedNodeId(null);
      }
    },
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as ResearchNode | undefined;

  if (!selectedNode) {
    return (
      <div className="w-96 flex flex-col h-full p-4">
        <h2 className="text-white/50 text-sm font-bold uppercase tracking-widest text-center mt-10">
          No Node Selected
        </h2>
      </div>
    );
  }

  const handleDataChange = (key: string, value: any) => {
    updateNodeData(selectedNode.id, { [key]: value });
  };

  return (
    <div className="w-96 flex flex-col h-full">
      <div className="p-4 border-b border-[#333]">
        <h2 className="text-white font-bold m-0 uppercase tracking-widest text-sm">Inspector</h2>
        <p className="text-white/50 text-xs m-0">Edit node properties</p>
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Type</label>
          <div className="text-white bg-[#1a1d24] px-3 py-2 rounded text-sm uppercase">
            {selectedNode.type}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Label</label>
          <input
            type="text"
            value={selectedNode.data.label || ''}
            onChange={(e) => handleDataChange('label', e.target.value)}
            className="bg-[#1a1d24] text-white px-3 py-2 rounded border border-[#333] focus:border-white/50 focus:outline-none"
          />
        </div>

        {/* Dynamic fields based on type */}
        {selectedNode.type === 'sport' && (
          <div className="flex flex-col gap-1">
            <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Category</label>
            <input
              type="text"
              value={selectedNode.data.category || ''}
              onChange={(e) => handleDataChange('category', e.target.value)}
              className="bg-[#1a1d24] text-white px-3 py-2 rounded border border-[#333] focus:border-white/50 focus:outline-none"
            />
          </div>
        )}

        {selectedNode.type === 'organization' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Org Type</label>
              <input
                type="text"
                value={selectedNode.data.org_type || ''}
                onChange={(e) => handleDataChange('org_type', e.target.value)}
                className="bg-[#1a1d24] text-white px-3 py-2 rounded border border-[#333] focus:border-white/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Scope</label>
              <input
                type="text"
                value={selectedNode.data.scope || ''}
                onChange={(e) => handleDataChange('scope', e.target.value)}
                className="bg-[#1a1d24] text-white px-3 py-2 rounded border border-[#333] focus:border-white/50 focus:outline-none"
              />
            </div>
          </>
        )}

        <div className="mt-4 pt-4 border-t border-[#333]">
          <ProvenanceTracker nodeId={selectedNode.id} />
        </div>
      </div>
    </div>
  );
}
