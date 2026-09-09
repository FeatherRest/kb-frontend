export function resolveKbApiBase(value) {
  const configured = typeof value === 'string' ? value.trim() : ''
  return configured || '/kb/api'
}
