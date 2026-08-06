"use client";

import { useState, useEffect } from 'react';
import { Database, Network } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface KGNode {
  id: string;
  name: string;
  label: string;
  type: string;
}

interface KGEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: KGNode[];
  edges: KGEdge[];
}

export default function KnowledgeGraphSidebar() {
  const [sports, setSports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSports() {
      try {
        const { data, error } = await supabase.from('sports').select('*');
        if (error) console.error('Supabase error fetching sports:', error);
        setSports(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSports();
  }, []);

  return (
    <div className="sidebar-content-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Domain Explorer</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Visualize the hierarchical relationships between sports, organizations, and competitions.
        </p>
      </div>

      <div className="kg-stats" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="kg-stat" style={{ background: 'var(--bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
          <Database size={16} className="text-accent" />
          <span>{loading ? '...' : sports.length} Root Domains (Sports)</span>
        </div>
        <div className="kg-stat" style={{ background: 'var(--bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
          <Network size={16} className="text-accent" />
          <span>Graph Layout: Force-Directed</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          Available Domains
        </h4>
        {loading ? (
          <div className="kg-loading"><div className="kg-spinner" style={{ border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }}></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {sports.map(sport => (
              <div key={sport.id} className="kg-org-card" style={{ cursor: 'pointer' }}>
                <div className="kg-org-header" style={{ marginBottom: 0 }}>
                  <span className="kg-org-name">{sport.name}</span>
                  <span className="kg-org-type">SPORT</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
