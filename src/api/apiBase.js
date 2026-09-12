/**
 * 解析知识库 API 基地址。
 *
 * 默认 `/kb/api`（同源，经 nginx 或 vite dev proxy 转发到 kb-api:9999）。
 * 仅当知识库服务被独立托管时才需要设置 VITE_KB_API。
 */
export function resolveKbApiBase(value) {
  const configured = typeof value === 'string' ? value.trim() : ''
  return (configured || '/kb/api').replace(/\/+$/, '')
}
