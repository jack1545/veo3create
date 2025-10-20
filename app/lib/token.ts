import React from 'react'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function getCachedWithTTL(key: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return ''
    const obj = JSON.parse(raw)
    const ts = obj?.ts || 0
    if (Date.now() - ts > ONE_WEEK_MS) {
      try { localStorage.removeItem(key) } catch {}
      return ''
    }
    return String(obj?.value || '')
  } catch {
    return ''
  }
}

function setCachedWithTTL(key: string, value: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }))
  } catch {}
}

export function useTokenCache(tokenKey: string) {
  const [token, setToken] = React.useState<string>('')

  React.useEffect(() => {
    const t = getCachedWithTTL(tokenKey)
    if (t) setToken(t)
  }, [tokenKey])

  const saveToken = React.useCallback(() => {
    const t = token.trim()
    if (!t) return
    setCachedWithTTL(tokenKey, t)
  }, [token, tokenKey])

  const clearToken = React.useCallback(() => {
    try { localStorage.removeItem(tokenKey) } catch {}
    setToken('')
  }, [tokenKey])

  return { token, setToken, saveToken, clearToken }
}