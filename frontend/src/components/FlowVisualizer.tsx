import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { FlowRun } from "../api/flows";

interface FlowVisualizerProps {
  flowRun: FlowRun;
}

export function FlowVisualizer({ flowRun }: FlowVisualizerProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );
  
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId);
  }, [nodes, selectedNodeId]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={setReactFlowInstance}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        className="bg-surface-900"
      >
        <Background color="#353545" gap={20} size={1} />
        <Controls className="bg-surface-800 border-surface-700" />
        <MiniMap
          className="bg-surface-800 border-surface-700"
          nodeColor={() => "#64748b"}
          maskColor="rgba(10, 10, 15, 0.7)"
        />

        <Panel position="top-left" className="bg-surface-800/90 backdrop-blur border border-surface-700 rounded-lg p-3">
          <div className="text-sm font-medium text-text-primary mb-2">Flow Info</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Name:</span>
              <span className="text-text-secondary">{flowRun.manifest.flowName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Status:</span>
              <span className="text-text-secondary">{flowRun.manifest.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Run ID:</span>
              <span className="text-text-secondary font-mono text-[10px]">{flowRun.runId.slice(0, 8)}...</span>
            </div>
          </div>
        </Panel>

        <Panel position="top-center">
          <div className="bg-surface-800/90 backdrop-blur border border-surface-700 rounded-lg px-4 py-2 text-sm text-text-muted">
            Flow visualization requires steps data from trace file
          </div>
        </Panel>
      </ReactFlow>

      {selectedNode && (
        <div className="absolute right-4 top-4 bottom-4 w-80 bg-surface-800/95 backdrop-blur border border-surface-700 rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-surface-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">{selectedNode.id}</h3>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-sm text-text-muted">
              Node details require steps data from trace file
            </div>
          </div>
        </div>
      )}
    </div>
  );
}