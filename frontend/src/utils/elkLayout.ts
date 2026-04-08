import ELK from "elkjs";
import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeData } from "../components/FlowNode";

const elk = new ELK();

export interface ElkEdgeData extends Record<string, unknown> {
  points?: Array<{ x: number; y: number }>;
}

export interface LayoutOptions {
  direction?: "DOWN" | "UP" | "RIGHT" | "LEFT";
  nodeSpacing?: number;
  layerSpacing?: number;
}

const defaultLayoutOptions: LayoutOptions = {
  direction: "DOWN",
  nodeSpacing: 50,
  layerSpacing: 100,
};

export async function layoutGraph(
  nodes: Node<FlowNodeData>[],
  edges: Edge<ElkEdgeData>[],
  options: LayoutOptions = {}
): Promise<{ nodes: Node<FlowNodeData>[]; edges: Edge<ElkEdgeData>[] }> {
  const opts = { ...defaultLayoutOptions, ...options };

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": opts.direction as string,
      "elk.spacing.nodeNode": String(opts.nodeSpacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(opts.layerSpacing),
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.edgeRouting": "POLYLINE",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.type === "compute" ? 120 : 180,
      height: node.type === "compute" ? 120 : 100,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph);

    const positionedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
        return {
          ...node,
          position: {
            x: elkNode.x,
            y: elkNode.y,
          },
        };
      }
      return node;
    });

    const positionedEdges = edges.map((edge) => {
      const elkEdge = layoutedGraph.edges?.find((e) => e.id === edge.id) as {
        id: string;
        sections?: Array<{ startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }> }>;
      } | undefined;
      if (elkEdge?.sections && elkEdge.sections.length > 0) {
        const section = elkEdge.sections[0];
        return {
          ...edge,
          data: {
            ...edge.data,
            points: section.bendPoints
              ? [section.startPoint, ...section.bendPoints, section.endPoint]
              : [section.startPoint, section.endPoint],
          },
        };
      }
      return edge;
    });

    return { nodes: positionedNodes, edges: positionedEdges };
  } catch (error) {
    console.error("ELK layout failed:", error);
    return { nodes, edges };
  }
}

export function buildFlowGraph(
  flowDefinition: {
    nodes: Record<string, { nodeType: string }>;
    edges: Array<{ from: string; to?: string; switch?: { on: string; cases: Record<string, string> } }>;
    startAt: string;
  },
  flowRun?: {
    results?: Record<string, { outcome: string; durationMs: number; nodeType: string }>;
    currentNode?: string;
    status: string;
  }
): { nodes: Node<FlowNodeData>[]; edges: Edge<ElkEdgeData>[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge<ElkEdgeData>[] = [];
  const nodeIds = Object.keys(flowDefinition.nodes);

  const terminalNodes = new Set<string>();
  nodeIds.forEach((id) => {
    const hasOutgoing = flowDefinition.edges.some(
      (e) => e.from === id || (e.switch && e.from === id)
    );
    if (!hasOutgoing) {
      terminalNodes.add(id);
    }
  });

  nodeIds.forEach((nodeId, index) => {
    const nodeDef = flowDefinition.nodes[nodeId];
    const result = flowRun?.results?.[nodeId];

    let status: FlowNodeData["status"] = "pending";
    if (result) {
      switch (result.outcome) {
        case "ok":
          status = "completed";
          break;
        case "failed":
          status = "failed";
          break;
        case "timed_out":
          status = "timed_out";
          break;
        case "cancelled":
          status = "cancelled";
          break;
        default:
          status = "pending";
      }
    } else if (flowRun?.currentNode === nodeId) {
      status = "running";
    }

    nodes.push({
      id: nodeId,
      type: nodeDef.nodeType === "compute" ? "compute" : "default",
      position: { x: index * 200, y: index * 100 },
      data: {
        nodeId,
        label: nodeId,
        nodeType: nodeDef.nodeType as FlowNodeData["nodeType"],
        status,
        isStart: nodeId === flowDefinition.startAt,
        isTerminal: terminalNodes.has(nodeId),
        durationMs: result?.durationMs,
      },
    });
  });

  flowDefinition.edges.forEach((edgeDef, index) => {
    if (edgeDef.to) {
      edges.push({
        id: `e-${edgeDef.from}-${edgeDef.to}-${index}`,
        source: edgeDef.from,
        target: edgeDef.to,
        type: "smoothstep",
        animated: flowRun?.currentNode === edgeDef.from,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      });
    } else if (edgeDef.switch) {
      Object.entries(edgeDef.switch.cases).forEach(([caseValue, targetId], caseIndex) => {
        edges.push({
          id: `e-${edgeDef.from}-${targetId}-switch-${caseValue}-${caseIndex}`,
          source: edgeDef.from,
          target: targetId,
          type: "smoothstep",
          animated: flowRun?.currentNode === edgeDef.from,
          label: caseValue,
          labelStyle: { fill: "#94a3b8", fontSize: 12 },
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
        });
      });
    }
  });

  return { nodes, edges };
}
