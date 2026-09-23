<template>
  <!--
    lacuna 概念图的关系图（纯 SVG，无图形库依赖）。

    · 每个 cluster 一列，列内按入链数降序排（重要的排上面）
    · 边 = wikilink；目标页不存在（ghost link）画成虚线
    · 点击节点/标签 → emit('select', slug)，由父组件加载该页
  -->
  <div class="lc-graph-wrap">
    <svg :viewBox="`0 0 ${width} ${height}`" class="lc-graph" role="img" aria-label="概念图关系图">
      <g class="lc-edges">
        <line
          v-for="(e, i) in edges"
          :key="`e${i}`"
          :x1="pos(e.source).x"
          :y1="pos(e.source).y"
          :x2="pos(e.target).x"
          :y2="pos(e.target).y"
          :class="edgeClass(e)"
        />
      </g>
      <g class="lc-cluster-labels">
        <text v-for="c in columns" :key="c.cluster" :x="c.x" :y="14" class="lc-cluster-text">
          {{ shortCluster(c.cluster) }} ({{ c.nodes.length }})
        </text>
      </g>
      <g class="lc-nodes">
        <g
          v-for="n in nodes"
          :key="n.slug"
          :transform="`translate(${pos(n.slug).x},${pos(n.slug).y})`"
          class="lc-node-g"
          :class="{ 'is-active': n.slug === active }"
          @click="emit('select', n.slug)"
        >
          <title>{{ n.title || n.slug }}{{ n.cluster ? ` · ${n.cluster}` : '' }}</title>
          <circle :r="radius(n)" />
          <text :x="radius(n) + 4" y="4" class="lc-node-text">{{ label(n) }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
/**
 * 关系图组件：只负责布局与绘制，不做任何取数（父组件把 nodes/edges 传进来）。
 * 布局是确定性的（cluster 分列 + 列内排序），所以同样的数据永远画出同样的图。
 */
import { computed } from 'vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  active: { type: String, default: '' },
})
const emit = defineEmits(['select'])

const COL_W = 300
const ROW_H = 26
const PAD_TOP = 28

const shortCluster = (c) => String(c || '未分类').split('/').pop()

/** cluster 分列 + 列内按入链数降序 → 位置一次性算好存 map */
const layout = computed(() => {
  const byCluster = new Map()
  for (const n of props.nodes) {
    const key = n.cluster || '未分类'
    if (!byCluster.has(key)) byCluster.set(key, [])
    byCluster.get(key).push(n)
  }
  const columns = [...byCluster.entries()]
    .map(([cluster, list]) => ({
      cluster,
      nodes: [...list].sort((a, b) => (b.links_in ?? 0) - (a.links_in ?? 0) || a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.cluster.localeCompare(b.cluster))

  const positions = new Map()
  columns.forEach((col, ci) => {
    col.x = ci * COL_W + 20
    col.nodes.forEach((n, ri) => positions.set(n.slug, { x: col.x, y: PAD_TOP + ri * ROW_H + 14 }))
  })
  return { columns, positions }
})

const columns = computed(() => layout.value.columns)
const pos = (slug) => layout.value.positions.get(slug) || { x: 0, y: 0 }
const radius = (n) => Math.min(9, 4 + Math.sqrt(n.links_in ?? 0))
const label = (n) => {
  const t = n.title || n.slug
  return t.length > 30 ? `${t.slice(0, 29)}…` : t
}
const width = computed(() => Math.max(COL_W, columns.value.length * COL_W + 20))
const height = computed(() =>
  Math.max(120, PAD_TOP + Math.max(0, ...columns.value.map((c) => c.nodes.length)) * ROW_H + 20),
)
const edgeClass = (e) => ({
  'is-ghost': e.resolved === false,
  'is-active': props.active && (e.source === props.active || e.target === props.active),
})
</script>

<style scoped>
.lc-graph-wrap {
  overflow: auto;
  max-height: 420px;
}
.lc-graph {
  width: 100%;
  min-width: 560px;
}
.lc-edges line {
  stroke: #d9d9d9;
  stroke-width: 1;
}
.lc-edges line.is-ghost {
  stroke: #ffb3b3;
  stroke-dasharray: 4 3;
}
.lc-edges line.is-active {
  stroke: #2080f0;
  stroke-width: 1.6;
}
.lc-cluster-text {
  font-size: 11px;
  fill: #909399;
}
.lc-node-g {
  cursor: pointer;
}
.lc-node-g circle {
  fill: #2080f0;
  opacity: 0.75;
}
.lc-node-g:hover circle,
.lc-node-g.is-active circle {
  fill: #f0a020;
  opacity: 1;
}
.lc-node-text {
  font-size: 11px;
  fill: #333;
}
.lc-node-g.is-active .lc-node-text {
  fill: #f0a020;
  font-weight: 600;
}
</style>
