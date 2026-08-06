'use client';

import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { fetchProfiles, fetchProfileDetail, updateProfile, runScraper } from '@/lib/api';

export default function StudioPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [profileData, setProfileData] = useState<string>('{\n  "message": "Select a profile to edit"\n}');
  const [logs, setLogs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchProfiles().then(data => {
      setProfiles(data);
      if (data.length > 0) setSelectedSiteId(data[0].site_id);
    });
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    fetchProfileDetail(selectedSiteId).then(data => {
      setProfileData(JSON.stringify(data, null, 2));
    });
  }, [selectedSiteId]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSave = async () => {
    if (!selectedSiteId) return;
    setIsSaving(true);
    try {
      await updateProfile(selectedSiteId, JSON.parse(profileData));
      alert('Profile saved successfully.');
    } catch (err) {
      alert('Failed to save profile. Ensure it is valid JSON.');
    }
    setIsSaving(false);
  };

  const handleRun = async () => {
    if (!selectedSiteId) return;
    setIsRunning(true);
    setLogs(['$ Starting scraper...']);
    
    if (wsRef.current) wsRef.current.close();
    
    try {
      const res = await runScraper(selectedSiteId);
      const apiHost = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');
      const wsUrl = `${apiHost}/api/v1/scraper/runs/${res.run_id}/stream`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        setLogs(prev => [...prev, event.data]);
      };
      ws.onclose = () => {
        setLogs(prev => [...prev, '$ Stream closed.']);
        setIsRunning(false);
      };
    } catch (err) {
      setLogs(prev => [...prev, '$ Failed to start scraper.']);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border bg-card flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold">Scraper Studio</h1>
            <p className="text-muted-foreground text-sm">Interactive IDE for AI-assisted scraper healing.</p>
          </div>
          <select 
            className="bg-muted text-foreground border border-border rounded-md px-3 py-1.5"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
          >
            {profiles.map(p => <option key={p.site_id} value={p.site_id}>{p.name || p.site_id}</option>)}
          </select>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
          <button 
            onClick={handleRun}
            disabled={isRunning}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            {isRunning ? 'Running...' : 'Run Scraper'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Editor */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <div className="bg-muted px-4 py-2 text-xs font-mono border-b border-border text-muted-foreground flex justify-between">
            <span>{selectedSiteId}.json</span>
            <span>JSON</span>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              theme="vs-dark"
              language="json"
              value={profileData}
              onChange={(val: string | undefined) => setProfileData(val || '')}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </div>
        
        {/* Right: Output/Terminal */}
        <div className="w-1/2 flex flex-col bg-background">
          <div className="h-full bg-black text-green-400 p-4 font-mono text-xs overflow-y-auto" ref={terminalRef}>
            {logs.length === 0 ? <p className="text-muted-foreground">Ready to run scraper. Output will stream here.</p> : null}
            {logs.map((log, i) => (
              <p key={i} className="whitespace-pre-wrap">{log}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
