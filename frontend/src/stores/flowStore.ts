import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface FlowState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  zoomLevel: number;
  layoutAlgorithm: 'elk' | 'dagre';
}

interface FlowActions {
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setZoom: (zoomLevel: number) => void;
  setLayout: (layoutAlgorithm: 'elk' | 'dagre') => void;
}

type FlowStore = FlowState & FlowActions;

const initialState: FlowState = {
  selectedNodeId: null,
  selectedEdgeId: null,
  zoomLevel: 1,
  layoutAlgorithm: 'elk',
};

export const useFlowStore = create<FlowStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    selectNode: (selectedNodeId) => set({ selectedNodeId }),

    selectEdge: (selectedEdgeId) => set({ selectedEdgeId }),

    setZoom: (zoomLevel) => set({ zoomLevel }),

    setLayout: (layoutAlgorithm) => set({ layoutAlgorithm }),
  }))
);