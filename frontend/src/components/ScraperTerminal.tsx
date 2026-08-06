"use client";

import { useState, useEffect, useRef } from 'react';
import { Play, RotateCw, Terminal, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from './ToastContext';

interface ScraperRun {
  id: string;
  target: string;
  status: string;
  started_at: string;
  finished_at?: string;
  events_found?: number;
  logs: string[];
}

export default function ScraperTerminal() {
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const fetchRuns = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/scraper/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        if (data.length > 0 && !activeRunId) {
          setActiveRunId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // Poll every 5s if scraping
    let interval: NodeJS.Timeout;
    if (isScraping) {
      interval = setInterval(fetchRuns, 5000);
    }
    return () => clearInterval(interval);
  }, [isScraping]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runs, activeRunId]);

  const activeRun = runs.find(r => r.id === activeRunId);

  const handleRunScraper = async (target: string) => {
    if (!window.confirm(`Are you sure you want to run the scraper for ${target}?`)) return;
    
    setIsScraping(true);
    addToast(`Started scraper for ${target}`, 'info');
    try {
      const res = await fetch('http://localhost:8000/api/v1/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      if (res.ok) {
        const data = await res.json();
        setRuns(prev => [data, ...prev]);
        setActiveRunId(data.id);
        addToast(`Scraper run created: ${data.id}`, 'success');
      } else {
        addToast('Failed to start scraper', 'error');
        setIsScraping(false);
      }
    } catch (err) {
      console.error(err);
      addToast('Network error starting scraper', 'error');
      setIsScraping(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-app)' }}>
      {/* Left List */}
      <div style={{ width: '300px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Run History</h3>
          <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleRunScraper('curling')}>
            <Play size={12} /> Run Curling
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Loading runs...</div>
          ) : runs.map(run => (
            <div 
              key={run.id}
              onClick={() => setActiveRunId(run.id)}
              style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                background: activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent',
                borderLeft: activeRunId === run.id ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{run.target}</span>
                <span style={{ 
                  fontSize: '0.6875rem', 
                  textTransform: 'uppercase',
                  color: run.status === 'completed' ? 'var(--emerald-400)' : run.status === 'failed' ? 'var(--rose-400)' : 'var(--amber-400)'
                }}>
                  {run.status}
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {new Date(run.started_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Right Terminal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
        <div style={{ padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Terminal size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {activeRun ? `terminal - ${activeRun.id} - ${activeRun.status}` : 'terminal - no run selected'}
          </span>
        </div>
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {activeRun ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activeRun.logs.map((log, i) => (
                <div key={i}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>
                    [{new Date(activeRun.started_at).toLocaleTimeString()}]
                  </span>
                  <span style={{ 
                    color: log.includes('ERROR') ? 'var(--rose-400)' : 
                           log.includes('SUCCESS') ? 'var(--emerald-400)' : 'inherit'
                  }}>{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          ) : (
            <div>Select a run to view logs...</div>
          )}
        </div>
      </div>
    </div>
  );
}
