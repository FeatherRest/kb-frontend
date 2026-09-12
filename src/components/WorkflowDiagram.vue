<template>
  <div class="kb-workflow">
    <template v-for="(stage, i) in stages" :key="i">
      <div class="kb-stage" :class="{ 'kb-stage-active': isActive(stage) }">
        <div class="kb-stage-role" :class="`kb-role-${stage.role || 'process'}`">
          {{ roleLabel(stage.role) }}
        </div>
        <div class="kb-stage-name">{{ stage.label }}</div>
        <div v-if="stage.desc" class="kb-stage-desc" :title="stage.desc">{{ stage.desc }}</div>
      </div>
      <div v-if="i < stages.length - 1" class="kb-stage-arrow">→</div>
    </template>
    <span v-if="!stages.length" class="kb-dim">无阶段信息</span>
  </div>
</template>

<script setup>
import { STAGE_ROLE_META } from '../data/parserWorkflows.js'

const props = defineProps({
  stages: { type: Array, default: () => [] },
  activeParser: { type: String, default: '' },
})

function roleLabel(role) {
  return STAGE_ROLE_META[role]?.label || role || '处理'
}

function isActive(stage) {
  const p = String(props.activeParser || '').toLowerCase()
  if (!p) return false
  return (
    String(stage.label || '').toLowerCase().includes(p) ||
    String(stage.desc || '').toLowerCase().includes(p)
  )
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
  background: #ffffff;
  border: 1px solid #e8e8ed;
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 130px;
  max-width: 230px;
}
.kb-stage-active {
  border-color: #0071e3;
  box-shadow: 0 0 0 1px rgba(102, 204, 255, 0.35);
}
.kb-stage-role {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  letter-spacing: 1px;
}
.kb-role-input { background: #e8f1fd; color: #0071e3; }
.kb-role-process { background: #ffffff; color: #3a3a3c; }
.kb-role-branch { background: #fff4e5; color: #ff9500; }
.kb-role-output { background: #eaf8ee; color: #34c759; }
.kb-stage-name {
  font-size: 12px;
  color: #1d1d1f;
  margin-top: 4px;
  font-weight: 600;
}
.kb-stage-desc {
  font-size: 10.5px;
  color: #6e6e73;
  margin-top: 3px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kb-stage-arrow {
  align-self: center;
  color: #6e6e73;
}
</style>
