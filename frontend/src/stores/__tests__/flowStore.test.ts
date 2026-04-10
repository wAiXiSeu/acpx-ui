import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '../flowStore';

describe('flowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({
      selectedNodeId: null,
      selectedEdgeId: null,
      zoomLevel: 1,
      layoutAlgorithm: 'elk',
    });
  });

  it('should initialize with default state', () => {
    const state = useFlowStore.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
    expect(state.zoomLevel).toBe(1);
    expect(state.layoutAlgorithm).toBe('elk');
  });

  it('should select node', () => {
    useFlowStore.getState().selectNode('node-1');
    expect(useFlowStore.getState().selectedNodeId).toBe('node-1');
  });

  it('should deselect node', () => {
    useFlowStore.getState().selectNode('node-1');
    useFlowStore.getState().selectNode(null);
    expect(useFlowStore.getState().selectedNodeId).toBeNull();
  });

  it('should select edge', () => {
    useFlowStore.getState().selectEdge('edge-1');
    expect(useFlowStore.getState().selectedEdgeId).toBe('edge-1');
  });

  it('should set zoom level', () => {
    useFlowStore.getState().setZoom(1.5);
    expect(useFlowStore.getState().zoomLevel).toBe(1.5);
  });

  it('should set layout algorithm', () => {
    useFlowStore.getState().setLayout('dagre');
    expect(useFlowStore.getState().layoutAlgorithm).toBe('dagre');
  });
});
