import React, { useState } from 'react';
import { useGraphState } from '@/lib/graphStore';

export default function ScraperPanel({ nodeId }: { nodeId: string }) {
  const { nodes } = useGraphState();
  const node = nodes.find(n => n.id === nodeId);
  
  const [profile, setProfile] = useState(JSON.stringify({
    url: node?.data?.url || 'https://example.com',
    selectors: {
      events: '.event-card',
      title: '.title',
      date: '.date'
    },
    proxy: 'standard',
    timeout: 30000
  }, null, 2));

  const [logs, setLogs] = useState<string[]>([
    '[system] Scraper engine ready.',
    '[system] Awaiting profile configuration...'
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setLogs(prev => [...prev, '[info] Starting scraper run with profile...']);
    
    // Simulate scraping process
    setTimeout(() => setLogs(prev => [...prev, '[info] Navigating to URL...']), 1000);
    setTimeout(() => setLogs(prev => [...prev, '[info] Extracting events...']), 2500);
    setTimeout(() => {
      setLogs(prev => [...prev, '[success] Found 12 events. Sent to verification pipeline.']);
      setIsRunning(false);
    }, 4000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#333] flex flex-col gap-2">
        <label className="text-white/70 text-xs uppercase tracking-wider font-bold">Scraper Profile (JSON)</label>
        <textarea
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className="w-full h-48 bg-[#1a1d24] text-white/80 p-3 rounded font-mono text-xs border border-[#333] focus:border-white/50 focus:outline-none"
        />
        
        <button 
          onClick={handleRun}
          disabled={isRunning}
          className={`mt-2 py-2 rounded font-bold uppercase tracking-wider text-xs transition-colors
            ${isRunning ? 'bg-[#333] text-white/30 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
        >
          {isRunning ? 'Running...' : 'Run Scraper'}
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col min-h-0">
        <label className="text-white/70 text-xs uppercase tracking-wider font-bold mb-2">Live Logs</label>
        <div className="flex-1 bg-[#1a1d24] rounded border border-[#333] p-3 overflow-y-auto font-mono text-[10px] text-green-400">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
