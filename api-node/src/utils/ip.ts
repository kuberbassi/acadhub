import type { Request } from 'express'

/**
 * Normalizes a raw IP string:
 * - ::1            → 'localhost'
 * - 127.0.0.1      → 'localhost'
 * - ::ffff:x.x.x.x → x.x.x.x  (IPv4-mapped IPv6)
 */
function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null
  const ip = raw.trim()
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'localhost'
  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

/**
 * Extracts the real client IP address behind reverse proxies.
 * Checks 'x-forwarded-for' (first IP) and 'x-real-ip' before falling back.
 */
export function getClientIp(req: Request): string | null {
  const xForwardedFor = req.headers['x-forwarded-for']
  if (xForwardedFor) {
    const raw = typeof xForwardedFor === 'string'
      ? xForwardedFor.split(',')[0]
      : xForwardedFor[0]
    const ip = normalizeIp(raw)
    if (ip) return ip
  }

  const xRealIp = req.headers['x-real-ip']
  if (xRealIp && typeof xRealIp === 'string') {
    const ip = normalizeIp(xRealIp)
    if (ip) return ip
  }

  return normalizeIp(req.ip ?? (req as any).socket?.remoteAddress ?? null)
}

/** Reads the ISO 3166-1 alpha-2 country supplied by the hosting edge. */
export function getClientCountry(req: Request): string | null {
  const ip = getClientIp(req)
  if (ip === 'localhost') return 'LOCAL'
  const raw = req.headers['x-vercel-ip-country'] ?? req.headers['cf-ipcountry']
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase()
  return value && /^[A-Z]{2}$/.test(value) ? value : null
}
