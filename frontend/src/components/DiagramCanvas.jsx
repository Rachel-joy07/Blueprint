import { useMemo, useCallback } from 'react'
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'
import NodeCard from './NodeCard.jsx'

const nodeTypes = { resource: NodeCard }

export default function DiagramCanvas({ scan, onSelectNode, selectedId }) {
  const nodes = useMemo(
    () =>
      scan.nodes.map((n) => ({
        id: n.id,
        type: 'resource',
        position: { x: n.x, y: n.y },
        data: { ...n, onSelect: onSelectNode, selectedId },
      })),
    [scan, onSelectNode, selectedId]
  )

  const edges = useMemo(
    () =>
      scan.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        style: { stroke: '#2E6293', strokeWidth: 1.5 },
        animated: false,
      })),
    [scan]
  )

  const onNodeClick = useCallback((_, node) => onSelectNode(node.id), [onSelectNode])

  return (
    <div className="blueprint-canvas w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
      >
        <Controls
          className="!bg-blueprint-panel !border !border-blueprint-border !fill-blueprint-line !rounded-lg !shadow-panel [&>button]:!border-blueprint-border [&>button]:!text-blueprint-line/70 [&>button:hover]:!bg-blueprint-grid [&>button:hover]:!text-accent [&>button]:!transition-colors"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-blueprint-panel !border !border-blueprint-border !rounded-lg !shadow-panel"
          maskColor="rgba(11,30,51,0.75)"
          nodeColor={(n) =>
            n.data.status === 'risk' ? '#FF5D5D' : n.data.status === 'waste' ? '#FFB454' : '#45D6AE'
          }
        />
      </ReactFlow>
    </div>
  )
}
