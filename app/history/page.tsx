'use client'

import React, { useEffect, useMemo, useState } from 'react'

type Source = 'veo3' | 'sora2'

type BaseItem = {
  id?: string
  prompt?: string
  status?: string
  videoUrl?: string
}

type HistoryItem = BaseItem & { source: Source }

function readLocal<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default function UnifiedHistoryPage() {
  const [veo3, setVeo3] = useState<BaseItem[]>([])
  const [sora2, setSora2] = useState<BaseItem[]>([])
  const [filter, setFilter] = useState<'all' | Source>('all')

  // Top query state
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryInfo, setQueryInfo] = useState<{ source?: Source; id?: string; status?: string; video?: string } | null>(null)

  // Per-card query state
  const [cardQueries, setCardQueries] = useState<Record<string, { loading?: boolean; status?: string; video?: string }>>({})
  const setCardQuery = (key: string, patch: Partial<{ loading: boolean; status: string; video: string }>) => {
    setCardQueries(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const load = () => {
    const v = readLocal<BaseItem[]>('veo3_history') || []
    const s = readLocal<BaseItem[]>('sora2_history') || []
    setVeo3(v)
    setSora2(s)
  }

  useEffect(() => { load() }, [])

  const items: HistoryItem[] = useMemo(() => {
    const v = (veo3 || []).map(h => ({ ...h, source: 'veo3' as const }))
    const s = (sora2 || []).map(h => ({ ...h, source: 'sora2' as const }))
    const joined = [...v, ...s]
    if (filter === 'all') return joined
    return joined.filter(i => i.source === filter)
  }, [veo3, sora2, filter])

  const statusClass = (status?: string) => {
    const s = (status || '').toLowerCase()
    if (s.includes('completed')) return 'text-green-700'
    if (s.includes('failed') || s.includes('error')) return 'text-red-700'
    if (s.includes('submitted') || s.includes('submitting') || s.includes('processing')) return 'text-amber-700'
    return 'text-gray-700'
  }

  return (
    <div className="px-4 py-6 max-w-screen-xl mx-auto">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">统一历史记录</h1>
        <div className="text-sm text-gray-600">来源：Veo3 与 Sora2（本地缓存最多100条）</div>
      </div>
      <p className="mt-1 text-xs text-red-700">请尽快下载视频，异步任务可能将会在数小时或数天内删除</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm">来源：
          <select className="ml-2 border rounded px-2 py-1" value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">全部</option>
            <option value="veo3">Veo3</option>
            <option value="sora2">Sora2</option>
          </select>
        </label>
        <button className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors" onClick={load}>刷新</button>

        <div className="ml-auto w-full sm:w-auto flex items-center gap-2">
          <select id="q-source" className="border rounded px-2 py-1" defaultValue="veo3">
            <option value="veo3">Veo3</option>
            <option value="sora2">Sora2</option>
          </select>
          <input id="q-id" type="text" placeholder="输入任务ID" className="border rounded px-2 py-1 w-40" />
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 bg-brand hover:bg-brand-dark border border-gray-300 disabled:opacity-50"
            onClick={async () => {
              const sel = (document.getElementById('q-source') as HTMLSelectElement)?.value as Source
              const id = (document.getElementById('q-id') as HTMLInputElement)?.value.trim()
              if (!id) return
              setQueryLoading(true)
              setQueryInfo(null)
              const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
              const getToken = (key: string) => {
                try {
                  const raw = localStorage.getItem(key)
                  if (!raw) return ''
                  const obj = JSON.parse(raw)
                  const ts = obj?.ts || 0
                  if (Date.now() - ts > ONE_WEEK_MS) return ''
                  return obj?.value || ''
                } catch { return '' }
              }
              const token = sel==='veo3' ? getToken('veo3_token') : getToken('sora2_token')
              const url = new URL(sel==='veo3' ? '/api/veo3/detail' : '/api/sora2/query', location.origin)
              url.searchParams.set('id', id)
              if (token) url.searchParams.set('token', token)
              try {
                const resp = await fetch(url.toString(), { method: 'GET' })
                const data = await resp.json().catch(() => ({}))
                const video = (data as any)?.video_url
                const status = (data as any)?.status || 'unknown'
                setQueryInfo({ source: sel, id, status, video })
              } catch {
                setQueryInfo({ source: sel, id, status: 'error', video: undefined })
              } finally {
                setQueryLoading(false)
              }
            }}
          >查询</button>
        </div>
      </div>

      {/* Top query feedback */}
      {queryLoading && (
        <div className="mt-2 text-sm text-gray-600">查询中……</div>
      )}
      {queryInfo && (
        <div className="mt-2 p-2 border rounded bg-white">
          <div className="text-sm">来源：{queryInfo.source}，任务：{queryInfo.id}</div>
          <div className={`text-sm ${statusClass(queryInfo.status)}`}>状态：{queryInfo.status || '-'}</div>
          {queryInfo.video ? (
            <video src={queryInfo.video} controls className="mt-2 w-full rounded" />
          ) : (
            <div className="mt-1 text-xs text-gray-500">暂无视频返回或任务未完成</div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-gray-600">暂无历史记录。请先在 Veo3 或 Sora2 页面提交任务。</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((h, i) => {
            const key = h.id || String(i)
            const q = cardQueries[key] || {}
            return (
              <div key={i} className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">ID: {h.id || '-'}</div>
                  <span className={`text-[11px] uppercase font-medium px-2 py-0.5 rounded-full border ${h.source==='veo3' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{h.source}</span>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap break-words line-clamp-4">{h.prompt || '-'}</div>
                <div className={`mt-1 text-sm ${statusClass(h.status)}`}>状态：{h.status || '-'}</div>
                {(h.videoUrl || q.video) ? (
                  <video src={q.video || h.videoUrl} controls className="mt-2 w-full rounded" />
                ) : q.loading ? (
                  <div className="mt-2 text-xs text-gray-600">查询中……</div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">暂无视频返回或任务未完成</div>
                )}
                {q.status && (
                  <div className={`mt-1 text-xs ${statusClass(q.status)}`}>最新状态：{q.status}</div>
                )}
                <div className="mt-2 flex gap-2">
                  {h.videoUrl && (
                    <a href={h.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">新窗口打开</a>
                  )}
                  {h.videoUrl && (
                    <a href={h.videoUrl} download className="text-sm text-blue-600 hover:underline">下载</a>
                  )}
                  {h.id && (
                    <button
                      className="text-sm px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50"
                      onClick={async () => {
                        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
                        const getToken = (key: string) => {
                          try {
                            const raw = localStorage.getItem(key)
                            if (!raw) return ''
                            const obj = JSON.parse(raw)
                            const ts = obj?.ts || 0
                            if (Date.now() - ts > ONE_WEEK_MS) return ''
                            return obj?.value || ''
                          } catch { return '' }
                        }
                        setCardQuery(key, { loading: true, status: undefined, video: undefined })
                        const token = h.source==='veo3' ? getToken('veo3_token') : getToken('sora2_token')
                        const url = new URL(h.source==='veo3' ? '/api/veo3/detail' : '/api/sora2/query', location.origin)
                        url.searchParams.set('id', h.id || '')
                        if (token) url.searchParams.set('token', token)
                        try {
                          const resp = await fetch(url.toString(), { method: 'GET' })
                          const data = await resp.json().catch(() => ({}))
                          const video = (data as any)?.video_url
                          const status = (data as any)?.status || 'unknown'
                          setCardQuery(key, { loading: false, status, video })
                        } catch {
                          setCardQuery(key, { loading: false, status: 'error', video: undefined })
                        }
                      }}
                    >查询</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}