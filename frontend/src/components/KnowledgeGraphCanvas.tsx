"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// dynamically import react-force-graph to prevent SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface KnowledgeGraphCanvasProps {
  selectedSportId?: string;
}

export default function KnowledgeGraphCanvas({ selectedSportId }: KnowledgeGraphCanvasProps) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    setLoading(true);
    // If a sport is selected, fetch its subgraph. Otherwise fetch the global graph.
    const url = selectedSportId 
      ? `http://localhost:8000/api/v1/knowledge-graph/sports/${selectedSportId}/graph`
      : `http://localhost:8000/api/v1/knowledge-graph/sports/1/graph`; // Fallback to first sport for now

    fetch(url)
      .then(res => res.json())
      .then(data => {
        // Force graph expects 'links' instead of 'edges'
        setGraphData({
          nodes: data.nodes || [],
          edges: data.edges?.map((e: any) => ({ ...e, source: e.source, target: e.target })) || []
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedSportId]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'var(--bg-app)', position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <div className="kg-spinner" style={{ border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        </div>
      )}
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ nodes: graphData.nodes, links: graphData.edges }}
        nodeLabel="name"
        nodeColor={(node: any) => {
          if (node.type === 'sport') return '#D4AF37'; // gold
          if (node.type === 'organization') return '#3B82F6'; // blue
          return '#10B981'; // green for competitions
        }}
        nodeRelSize={6}
        linkColor={() => 'rgba(255, 255, 255, 0.1)'}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor="#0A0A0C" // var(--bg-app)
      />
      
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 'var(--space-6)', right: 'var(--space-6)', background: 'rgba(10, 10, 12, 0.8)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(8px)' }}>
        <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Node Types</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D4AF37' }}></div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sport</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }}></div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Organization</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Competition</span>
          </div>
        </div>
      </div>
    </div>
  );
}
