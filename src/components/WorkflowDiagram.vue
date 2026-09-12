<template>
  <div class="kb-workflow">
    <template v-for="(stage, i) in stages" :key="stage.key || i">
      <div class="kb-stage" :class="stageClass(stage)">
        <div class="kb-stage-role">{{ roleLabel(stage.role) }}</div>
        <div class="kb-stage-name">{{ stage.name || stage.parser || stage.label }}</div>
        <div v-if="stage.note" class="kb-stage-note" :title="stage.note">{{ stage.note }}</div>
      </div>
      <div v-if="i < stages.length - 1" class="kb-stage-arrow">→</div>
    </template>
    <span v-if="!stages.length" class="kb-dim">无阶段信息</span>
  </div>
</template>

<script setup>
const props = defineProps({
  stages: { type: Array, default: () => [] },
  activeParser: { type: String, default: '' },
})

const ROLE_LABEL = {
  detect: '检测',
  route: '路由',
  primary: '主解析',
  fallback: '兜底',
  enrich: '增强',
  post: '后处理',
}

function roleLabel(role) {
  return ROLE_LABEL[role] || role || '阶段'
}

function stageClass(stage) {
  const name = stage.name || stage.parser || ''
  const isActive =
    props.activeParser && String(name).toLowerCase().includes(String(props.activeParser).toLowerCase())
  return {
    'kb-stage-active': Boolean(isActive),
    'kb-stage-fallback': stage.role === 'fallback',
  }
}
</script>

<style scoped>
.kb-workflow {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 6px;
}
.kb-stage {
  background: #20203a;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 110px;
  max-width: 190px;
}
.kb-stage-active {
  border-color: #66ccff;
  box-shadow: 0 0 0 1px rgba(102, 204, 255, 0.35);
}
.kb-stage-fallback {
  opacity: 0.75;
}
.kb-stage-role {
  font-size: 10px;
  color: #66ccff;
  letter-spacing: 1px;
}
.kb-stage-name {
  font-size: 12px;
  color: #dfe4f0;
  margin-top: 2px;
  word-break: break-all;
}
.kb-stage-note {
  font-size: 10px;
  color: #7f8fa4;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-stage-arrow {
  align-self: center;
  color: #4a4a68;
}
</style>
