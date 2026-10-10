// Instance-local backstop. Use platform rate protection for distributed deployments.
let windowStart = 0,
  used = 0;
export function allowAIRequest(now = Date.now()) {
  if (now - windowStart >= 60000) {
    windowStart = now;
    used = 0;
  }
  return ++used <= 20;
}
