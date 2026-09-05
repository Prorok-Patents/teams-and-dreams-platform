import React from 'react';

export default function GroupNode({ data }: { data: any }) {
  return (
    <div className="bg-transparent border-2 border-dashed border-white/20 rounded-xl p-4 min-w-[300px] min-h-[300px]">
      <div className="text-white/50 text-sm font-bold uppercase tracking-wider mb-2">
        {data.label || 'Group'}
      </div>
    </div>
  );
}
