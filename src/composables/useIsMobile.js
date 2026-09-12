import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 手机端判定（≤768px），随窗口变化实时更新。
 * 用于在手机上切换成卡片式列表 / 抽屉导航等替代布局。
 */
export function useIsMobile(query = '(max-width: 768px)') {
  const isMobile = ref(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  let mql = null

  function sync(e) {
    isMobile.value = e.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(query)
    isMobile.value = mql.matches
    mql.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    if (mql) mql.removeEventListener('change', sync)
  })

  return { isMobile }
}
