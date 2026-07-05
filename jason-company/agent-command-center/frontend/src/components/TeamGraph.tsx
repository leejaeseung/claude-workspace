import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Agent, Relation } from '../types'

interface Props {
  agents: Agent[]
  relations: Relation[]
  onSelectAgent?: (id: string) => void
}

const TEAM_HEX: Record<string, string> = {
  'code-quality': '#3B82F6',
  'feature-develop': '#10B981',
  hr: '#8B5CF6',
  supervisor: '#F59E0B',
}

const RELATION_COLOR: Record<string, string> = {
  mentoring: '#3B82F6',
  lead: '#10B981',
  collaboration: '#F59E0B',
  supervision: '#F59E0B',
  'hr-lead': '#8B5CF6',
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  agent: Agent
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string
  label: string
}

export function TeamGraph({ agents, relations, onSelectAgent }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ agent: Agent; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !agents.length) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('width', width).attr('height', height)

    const defs = svg.append('defs')
    Object.entries(RELATION_COLOR).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.7)
    })

    const nodes: D3Node[] = agents.map((agent) => ({ id: agent.id, agent }))
    const links: D3Link[] = relations.map((r) => ({
      source: r.source,
      target: r.target,
      type: r.type,
      label: r.label,
    }))

    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(40))

    const g = svg.append('g')

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => RELATION_COLOR[d.type] ?? '#4B5563')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d) => `url(#arrow-${d.type})`)

    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('fill', '#6B7280')
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .attr('text-anchor', 'middle')
      .text((d) => d.label)

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (_event, d) => {
        onSelectAgent?.(d.agent.id)
        setTooltip(null)
      })
      .on('mouseenter', (event, d) => {
        const rect = svgRef.current!.getBoundingClientRect()
        const ctRect = containerRef.current!.getBoundingClientRect()
        setTooltip({
          agent: d.agent,
          x: event.clientX - ctRect.left,
          y: event.clientY - ctRect.top,
        })
      })
      .on('mouseleave', () => setTooltip(null))

    node.append('circle')
      .attr('r', (d) => 14 + Math.sqrt(d.agent.level) * 2)
      .attr('fill', (d) => `${TEAM_HEX[d.agent.team]}22`)
      .attr('stroke', (d) => TEAM_HEX[d.agent.team])
      .attr('stroke-width', 2)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d) => TEAM_HEX[d.agent.team])
      .attr('font-size', 11)
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d) => d.agent.avatar)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => 20 + Math.sqrt(d.agent.level) * 2)
      .attr('fill', '#CBD5E1')
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .text((d) => d.agent.displayName)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => 30 + Math.sqrt(d.agent.level) * 2)
      .attr('fill', '#64748B')
      .attr('font-size', 8)
      .attr('font-family', 'monospace')
      .text((d) => `LV${d.agent.level}`)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x!)
        .attr('y1', (d) => (d.source as D3Node).y!)
        .attr('x2', (d) => (d.target as D3Node).x!)
        .attr('y2', (d) => (d.target as D3Node).y!)

      linkLabel
        .attr('x', (d) => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr('y', (d) => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [agents, relations, onSelectAgent])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 rounded p-3 space-y-1.5">
        {Object.entries(RELATION_COLOR).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: color }} />
            <span className="font-mono text-[10px] text-slate-400">{type}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 font-mono text-[10px] text-slate-600">
        스크롤로 확대/축소 · 드래그로 이동
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-900 border rounded-lg p-3 shadow-xl"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 40,
            borderColor: TEAM_HEX[tooltip.agent.team],
          }}
        >
          <div className="font-mono text-sm font-bold text-slate-100">{tooltip.agent.displayName}</div>
          <div className="font-mono text-xs" style={{ color: TEAM_HEX[tooltip.agent.team] }}>
            {tooltip.agent.role} · LV{tooltip.agent.level}
          </div>
        </div>
      )}
    </div>
  )
}
