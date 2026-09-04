import { Handle, Position } from 'reactflow'

const ICONS = {
  azurerm_virtual_network: '▦',
  azurerm_subnet: '▤',
  azurerm_network_security_group: '⛨',
  azurerm_linux_virtual_machine: '▣',
  azurerm_storage_account: '▥',
  azurerm_mssql_database: '⛁',
  azurerm_public_ip: '◈',
}

const STATUS_STYLES = {
  risk: {
    accentBorder: 'before:bg-risk',
    ring: 'hover:shadow-glow-risk',
    dot: 'bg-risk',
    label: 'Risk',
    text: 'text-risk',
  },
  waste: {
    accentBorder: 'before:bg-waste',
    ring: 'hover:shadow-glow-waste',
    dot: 'bg-waste',
    label: 'Oversized',
    text: 'text-waste',
  },
  clean: {
    accentBorder: 'before:bg-clean/50',
    ring: 'hover:shadow-glow-clean',
    dot: 'bg-clean',
    label: 'Clean',
    text: 'text-clean',
  },
}

export default function NodeCard({ data }) {
  const style = STATUS_STYLES[data.status] || STATUS_STYLES.clean
  const icon = ICONS[data.type] || '◆'
  const selected = data.selectedId === data.id

  return (
    <div
      onClick={() => data.onSelect?.(data.id)}
      className={`group relative w-[192px] cursor-pointer overflow-hidden rounded-[6px] border bg-blueprint-panel/95 backdrop-blur-sm px-3.5 py-3 shadow-panel transition-all duration-200 ease-out hover:-translate-y-[3px] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${style.accentBorder} ${style.ring} ${
        selected ? 'border-accent shadow-glow-accent' : 'border-blueprint-border'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent !w-1.5 !h-1.5 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-accent !w-1.5 !h-1.5 !border-0" />

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-base leading-none text-accent/90">{icon}</span>
        {data.status !== 'clean' && (
          <span className={`flex items-center gap-1.5 text-[10.5px] font-medium ${style.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse-ring`} />
            {style.label}
          </span>
        )}
      </div>

      <div className="font-display text-[13.5px] font-medium text-blueprint-line leading-tight truncate">
        {data.label}
      </div>
      <div className="font-mono text-[10px] text-blueprint-line/40 mt-0.5 truncate">{data.type}</div>
    </div>
  )
}
