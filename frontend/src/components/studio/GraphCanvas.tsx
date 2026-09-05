import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import { useGraphState } from '@/lib/graphStore';
import SportNode from './nodes/SportNode';
import OrganizationNode from './nodes/OrganizationNode';
import CompetitionNode from './nodes/CompetitionNode';
import VenueNode from './nodes/VenueNode';
import EventNode from './nodes/EventNode';
import WebSourceNode from './nodes/WebSourceNode';
import ScraperConfigNode from './nodes/ScraperConfigNode';
import GroupNode from './nodes/GroupNode';
import RelationshipEdge from './edges/RelationshipEdge';

const nodeTypes = {
  sport: SportNode,
  organization: OrganizationNode,
  competition: CompetitionNode,
  venue: VenueNode,
  event: EventNode,
  web_source: WebSourceNode,
  scraper_config: ScraperConfigNode,
  group: GroupNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

export default function GraphCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    undo,
    redo,
    canUndo,
    canRedo,
    addNode,
  } = useGraphState();
  const { screenToFlowPosition } = useReactFlow();

  const defaultEdgeOptions = useMemo(() => ({ type: 'relationship' }), []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { label: `New ${type}` },
      } as any;

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="research-graph-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#333" />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.type) {
              case 'sport': return '#D4AF37';
              case 'organization': return '#3B82F6';
              case 'competition': return '#10B981';
              default: return '#eee';
            }
          }}
          maskColor="rgba(0,0,0,0.7)"
          style={{ backgroundColor: '#0a0a0c', border: '1px solid #333' }}
        />
        
        <Panel position="top-right">
          <div className="flex gap-2 bg-black/50 p-2 rounded-lg backdrop-blur-md border border-white/10">
            <button 
              onClick={undo} 
              disabled={!canUndo}
              className={`px-3 py-1 text-sm rounded ${canUndo ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/30'}`}
            >
              Undo
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo}
              className={`px-3 py-1 text-sm rounded ${canRedo ? 'bg-white/10 hover:bg-white/20 text-white' : 'text-white/30'}`}
            >
              Redo
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
