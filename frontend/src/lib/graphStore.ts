import { useReducer, useCallback } from 'react';
import { ResearchNode, ResearchEdge, GraphState, NodeType } from './graphTypes';
import {
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  addEdge as rfAddEdge,
  Edge
} from '@xyflow/react';

type GraphAction =
  | { type: 'SET_NODES'; payload: ResearchNode[] }
  | { type: 'SET_EDGES'; payload: ResearchEdge[] }
  | { type: 'ON_NODES_CHANGE'; payload: NodeChange[] }
  | { type: 'ON_EDGES_CHANGE'; payload: EdgeChange[] }
  | { type: 'ON_CONNECT'; payload: Connection }
  | { type: 'ADD_NODE'; payload: ResearchNode }
  | { type: 'UPDATE_NODE_DATA'; payload: { id: string; data: any } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const initialState: GraphState = {
  nodes: [],
  edges: [],
  history: {
    past: [],
    future: []
  }
};

function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'SET_NODES': {
      return {
        ...state,
        nodes: action.payload,
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'SET_EDGES': {
      return {
        ...state,
        edges: action.payload,
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'ON_NODES_CHANGE': {
      // Don't save history on every drag tick, only on select/deselect or position end if needed,
      // but for simplicity we just apply the changes here.
      const newNodes = applyNodeChanges(action.payload, state.nodes as any) as ResearchNode[];
      return { ...state, nodes: newNodes };
    }
    case 'ON_EDGES_CHANGE': {
      const newEdges = applyEdgeChanges(action.payload, state.edges as any) as ResearchEdge[];
      return { ...state, edges: newEdges };
    }
    case 'ON_CONNECT': {
      const newEdges = rfAddEdge(action.payload, state.edges as any) as ResearchEdge[];
      return {
        ...state,
        edges: newEdges,
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'ADD_NODE': {
      return {
        ...state,
        nodes: [...state.nodes, action.payload],
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'UPDATE_NODE_DATA': {
      const newNodes = state.nodes.map(n => 
        n.id === action.payload.id ? { ...n, data: { ...n.data, ...action.payload.data } } : n
      );
      return {
        ...state,
        nodes: newNodes,
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'DELETE_NODE': {
      const newNodes = state.nodes.filter(n => n.id !== action.payload);
      const newEdges = state.edges.filter(e => e.source !== action.payload && e.target !== action.payload);
      return {
        ...state,
        nodes: newNodes,
        edges: newEdges,
        history: { past: [...state.history.past, { nodes: state.nodes, edges: state.edges }], future: [] }
      };
    }
    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      return {
        ...state,
        nodes: previous.nodes,
        edges: previous.edges,
        history: {
          past: newPast,
          future: [{ nodes: state.nodes, edges: state.edges }, ...state.history.future]
        }
      };
    }
    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      return {
        ...state,
        nodes: next.nodes,
        edges: next.edges,
        history: {
          past: [...state.history.past, { nodes: state.nodes, edges: state.edges }],
          future: newFuture
        }
      };
    }
    default:
      return state;
  }
}

export function useGraphState() {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  const setNodes = useCallback((nodes: ResearchNode[]) => dispatch({ type: 'SET_NODES', payload: nodes }), []);
  const setEdges = useCallback((edges: ResearchEdge[]) => dispatch({ type: 'SET_EDGES', payload: edges }), []);
  const onNodesChange = useCallback((changes: NodeChange[]) => dispatch({ type: 'ON_NODES_CHANGE', payload: changes }), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => dispatch({ type: 'ON_EDGES_CHANGE', payload: changes }), []);
  const onConnect = useCallback((connection: Connection) => dispatch({ type: 'ON_CONNECT', payload: connection }), []);
  const addNode = useCallback((node: ResearchNode) => dispatch({ type: 'ADD_NODE', payload: node }), []);
  const updateNodeData = useCallback((id: string, data: any) => dispatch({ type: 'UPDATE_NODE_DATA', payload: { id, data } }), []);
  const deleteNode = useCallback((id: string) => dispatch({ type: 'DELETE_NODE', payload: id }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    nodes: state.nodes,
    edges: state.edges,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    deleteNode,
    undo,
    redo
  };
}
