import React, { useState } from 'react';
import { useGraphState } from '@/lib/graphStore';

export default function ExportPanel() {
  const { nodes, edges } = useGraphState();
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'mermaid'>('json');

  const handleExport = () => {
    // Generate mock export
    let content = '';
    let type = 'text/plain';
    let ext = 'txt';

    if (exportFormat === 'json') {
      content = JSON.stringify({ nodes, edges }, null, 2);
      type = 'application/json';
      ext = 'json';
    } else if (exportFormat === 'mermaid') {
      content = 'graph TD;\n';
      nodes.forEach(n => {
        content += `  ${n.id}["${n.data.label}"]\n`;
      });
      edges.forEach(e => {
        content += `  ${e.source} -->|${e.label || ''}| ${e.target}\n`;
      });
      ext = 'mmd';
    } else if (exportFormat === 'csv') {
      content = 'id,type,label\n' + nodes.map(n => `${n.id},${n.type},${n.data.label}`).join('\n');
      type = 'text/csv';
      ext = 'csv';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-[#333] bg-[#0a0a0c] rounded">
      <div className="flex items-center gap-2 border-b border-[#333] pb-2">
        <span className="text-yellow-500">📤</span>
        <h3 className="text-white font-bold text-xs uppercase tracking-wider m-0">Export Research</h3>
      </div>
      
      <div className="flex flex-col gap-2">
        <label className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Format</label>
        <select 
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as any)}
          className="bg-[#1a1d24] text-white border border-[#333] rounded px-3 py-2 text-xs focus:outline-none focus:border-white/50"
        >
          <option value="json">Raw JSON (Full Data)</option>
          <option value="csv">CSV (Nodes Only)</option>
          <option value="mermaid">Mermaid.js Diagram</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Scope</label>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-white/80 text-xs">
            <input type="radio" name="scope" defaultChecked className="accent-blue-500" />
            Entire Graph
          </label>
          <label className="flex items-center gap-2 text-white/80 text-xs">
            <input type="radio" name="scope" className="accent-blue-500" />
            Selected Nodes Only
          </label>
        </div>
      </div>

      <button 
        onClick={handleExport}
        className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold uppercase tracking-wider text-[10px] transition-colors"
      >
        Download {exportFormat.toUpperCase()}
      </button>
    </div>
  );
}
