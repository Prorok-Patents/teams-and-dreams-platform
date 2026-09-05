import React from 'react';

const NODE_TYPES = [
  { type: 'sport', label: 'Sport', color: 'border-[#D4AF37]', icon: 'S' },
  { type: 'organization', label: 'Organization', color: 'border-[#3B82F6]', icon: 'O' },
  { type: 'competition', label: 'Competition', color: 'border-[#10B981]', icon: 'C' },
  { type: 'venue', label: 'Venue', color: 'border-[#8B5CF6]', icon: 'V' },
  { type: 'event', label: 'Event', color: 'border-[#F59E0B]', icon: 'E' },
  { type: 'web_source', label: 'Web Source', color: 'border-[#0EA5E9]', icon: 'W' },
  { type: 'scraper_config', label: 'Scraper Config', color: 'border-[#F43F5E]', icon: 'SC' },
];

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-[#0a0a0c] border-r border-[#333] flex flex-col h-full">
      <div className="p-4 border-b border-[#333]">
        <h2 className="text-white font-bold m-0 uppercase tracking-widest text-sm">Palette</h2>
        <p className="text-white/50 text-xs m-0">Drag nodes to canvas</p>
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        {NODE_TYPES.map((nt) => (
          <div
            key={nt.type}
            className={`bg-[#1a1d24] border ${nt.color} rounded p-3 flex items-center gap-3 cursor-grab hover:bg-[#252830] transition-colors`}
            draggable
            onDragStart={(e) => onDragStart(e, nt.type)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-black bg-gradient-to-tr from-white/20 to-white/60`}>
              {nt.icon}
            </div>
            <span className="text-white font-medium text-sm">{nt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
