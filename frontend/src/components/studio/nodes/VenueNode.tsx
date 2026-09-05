import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function VenueNode({ data }: { data: any }) {
  return (
    <div className="bg-[#1a1d24]/90 border border-[#8B5CF6] rounded-lg p-4 shadow-lg min-w-[200px] backdrop-blur-md">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-[#8B5CF6]" />
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-purple-300 flex items-center justify-center text-black font-bold">
          V
        </div>
        <div>
          <h3 className="text-white font-bold text-sm m-0">{data.label}</h3>
          <p className="text-slate-400 text-xs m-0">Capacity: {data.capacity || 'Unknown'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-[#8B5CF6]" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-[#8B5CF6]" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-[#8B5CF6]" />
    </div>
  );
}
