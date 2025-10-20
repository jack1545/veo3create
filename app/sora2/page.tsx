'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { compressImageIfNeededToDataUrl } from '../lib/image'

type Orientation = 'portrait' | 'landscape'
type SoraModel = 'sora-2' | 'sora-2-pro'
type Size = 'small' | 'large'

type SubmitItem = {
  id?: string
  prompt: string
  orientation?: Orientation
  firstImage?: string
  status?: string
  videoUrl?: string
}

type GlobalSettings = {
  model: SoraModel
  orientation: Orientation
  size: Size
  duration: number
}

const defaultSettings: GlobalSettings = {
  model: 'sora-2',
  orientation: 'portrait',
  size: 'small',
  duration: 15
}

async function createSoraJob(item: SubmitItem, settings: GlobalSettings, token?: string): Promise<{ id?: string; status?: string } | null> {
  const images: string[] = []
  if (item.firstImage) images.push(item.firstImage)
  const resp = await fetch('/api/sora2/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      model: settings.model,
      orientation: item.orientation || settings.orientation,
      prompt: item.prompt,
      size: settings.size,
      duration: settings.duration,
      token
    })
  })
  if (!resp.ok) return null
  return await resp.json()
}

async function fetchSoraDetail(id: string, token?: string): Promise<{ status?: string; video_url?: string; enhanced_prompt?: string } | null> {
  const url = new URL('/api/sora2/query', location.origin)
  url.searchParams.set('id', id)
  if (token) url.searchParams.set('token', token)
  const resp = await fetch(url.toString(), { method: 'GET' })
  if (!resp.ok) return null
  return await resp.json()
}

export default function Sora2Page() {
  const [settings, setSettings] = useState<GlobalSettings>(() => defaultSettings)
  const [items, setItems] = useState<SubmitItem[]>(() => [{ prompt: '', orientation: undefined }])
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit')
  const [history, setHistory] = useState<SubmitItem[]>([])
  const pollingRef = useRef<Record<string, any>>({})
  const [token, setToken] = useState<string>('')

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const setCachedWithTTL = (key: string, value: any) => {
    try { localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() })) } catch {}
  }
  const getCachedWithTTL = (key: string): any => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const { value, ts } = JSON.parse(raw)
      if (Date.now() - (ts || 0) > ONE_WEEK_MS) return null
      return value
    } catch { return null }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sora2_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sora2_history', JSON.stringify(history.slice(0, 100))) } catch {}
  }, [history])

  useEffect(() => {
    const cachedToken = getCachedWithTTL('sora2_token')
    if (cachedToken) setToken(cachedToken)
  }, [])

  const addItem = () => setItems(prev => [...prev, { prompt: '', orientation: 'portrait' }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, patch: Partial<SubmitItem>) => setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const saveToken = () => {
    const t = token.trim()
    if (!t) return
    setCachedWithTTL('sora2_token', t)
  }
  const clearToken = () => {
    try { localStorage.removeItem('sora2_token') } catch {}
    setToken('')
  }

  const submitOne = async (idx: number) => {
    const it = items[idx]
    if (!it.prompt.trim()) return
    if (!it.firstImage) {
      const proceed = window.confirm('未提供首帧图。是否继续提交？选择“确定”为提交，选择“取消”为补充首帧图。')
      if (!proceed) {
        updateItem(idx, { status: '请补充首帧图' })
        return
      }
    }
    updateItem(idx, { status: 'submitting' })
    const res = await createSoraJob(it, settings, token)
    const id = res?.id || ''
    if (!id) {
      updateItem(idx, { status: 'error' })
      return
    }
    updateItem(idx, { id, status: 'submitted' })
    setHistory(prev => [{ ...it, id, status: 'submitted' }, ...prev])

    const poll = async () => {
      const detail = await fetchSoraDetail(id, token)
      const status = detail?.status || 'unknown'
      const videoUrl = (detail as any)?.video_url
      updateItem(idx, { status, videoUrl })
      if (videoUrl || status === 'completed' || status === 'failed') {
        clearInterval(pollingRef.current[id])
        delete pollingRef.current[id]
      }
    }
    pollingRef.current[id] = setInterval(poll, 60000)
    poll()
  }

  const submitAll = async () => {
    for (let i = 0; i < items.length; i++) {
      await submitOne(i)
    }
  }

  const canSubmitAll = useMemo(() => items.some(i => i.prompt.trim().length > 0), [items])

  const priceTag = useMemo(() => {
    const m = settings.model
    if (m === 'sora-2-pro') return '￥1.575 一条'
    if (m === 'sora-2') return '￥0.14 一条'
    return null
  }, [settings.model])

  const durationOptions = useMemo(() => (
    settings.model === 'sora-2' ? [10, 15] : [15, 25]
  ), [settings.model])

  useEffect(() => {
    if (!durationOptions.includes(settings.duration)) {
      setSettings(s => ({ ...s, duration: durationOptions[0] }))
    }
  }, [settings.model])

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sora-2 批量视频生成</h1>
        <div className="text-sm text-gray-600">基于 yunwu.ai 接口（支持 720p/1080p）。</div>
      </div>

      <div className="mt-3 mb-3">
        <button onClick={() => setActiveTab('submit')} disabled={activeTab === 'submit'} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">提交</button>
        <a href="/history" className="ml-2 text-brand hover:text-brand-dark">历史</a>
      </div>

      {activeTab === 'history' ? (
        <div>
          <h2 className="text-lg font-semibold">历史记录</h2>
          {history.length === 0 ? <p className="text-gray-600 mt-2">暂无记录</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((h, i) => (
                <div key={i} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="text-xs text-gray-500">ID: {h.id}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{h.prompt}</div>
                  <div className="text-sm mt-1">状态: {h.status || 'unknown'}</div>
                  {h.videoUrl && (
                    <video src={h.videoUrl} controls className="w-full mt-2 rounded" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mt-4">Token 设置</h2>
          <div className="flex items-center gap-2 mb-3">
            <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Bearer Token" className="w-80 border rounded px-2 py-1" />
            <button onClick={saveToken} className="px-3 py-1 rounded text-white bg-brand hover:bg-brand-dark bg-blue-600 hover:bg-blue-700">保存到缓存</button>
            <button onClick={clearToken} className="px-3 py-1 rounded border border-gray-300">清除</button>
          </div>

          <h2 className="text-lg font-semibold mt-4">全局设置</h2>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              模型：
              <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value as SoraModel, size: e.target.value === 'sora-2-pro' ? 'large' : s.size }))} className="ml-2 border rounded px-2 py-1">
                <option value="sora-2">sora-2</option>
                <option value="sora-2-pro">sora-2-pro</option>
              </select>
              {priceTag && (
                <span className="ml-2 text-red-600 text-sm">{priceTag}</span>
              )}
            </label>
            <label className="text-sm">
              画幅：
              <select value={settings.orientation} onChange={e => setSettings(s => ({ ...s, orientation: e.target.value as Orientation }))} className="ml-2 border rounded px-2 py-1">
                <option value="portrait">竖屏</option>
                <option value="landscape">横屏</option>
              </select>
            </label>
            <label className="text-sm">
              清晰度：
              <select value={settings.size} onChange={e => setSettings(s => ({ ...s, size: e.target.value as Size }))} className="ml-2 border rounded px-2 py-1">
                <option value="small">720p</option>
                <option value="large">1080p</option>
              </select>
            </label>
            <label className="text-sm">
              时长：
              <select value={String(settings.duration)} onChange={e => setSettings(s => ({ ...s, duration: Number(e.target.value) }))} className="ml-2 border rounded px-2 py-1">
                {durationOptions.map(d => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 mb-2 flex gap-2">
            <button onClick={addItem} className="px-3 py-1 rounded border border-gray-300">新增条目</button>
            <button onClick={submitAll} disabled={!canSubmitAll} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed">提交全部</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-center">
                  <strong className="font-semibold">条目 {idx + 1}</strong>
                  <button onClick={() => removeItem(idx)} className="text-sm text-red-600 hover:underline">删除</button>
                </div>

                <label className="block mt-2 text-sm">提示词：</label>
                <textarea value={it.prompt} onChange={e => updateItem(idx, { prompt: e.target.value })} rows={4} className="w-full mt-1 border rounded px-2 py-1" placeholder="输入中文提示词即可" />

                <label className="block mt-2 text-sm">画幅：</label>
                <select value={it.orientation || 'portrait'} onChange={e => updateItem(idx, { orientation: e.target.value as Orientation })} className="border rounded px-2 py-1">
                  <option value="portrait">竖屏</option>
                  <option value="landscape">横屏</option>
                </select>

                <div className="flex gap-3 mt-2 flex-col md:flex-row">
                  <div className="md:w-48 overflow-hidden">
                    <div>首帧图：</div>
                    <input type="file" accept="image/*" onChange={async e => {
                      const f = e.target.files?.[0]
                      if (f && f.type.startsWith('image/')) {
                        const url = await compressImageIfNeededToDataUrl(f)
                        updateItem(idx, { firstImage: url })
                      }
                    }} className="mt-1 block w-full text-sm file:px-2 file:py-1 file:border file:rounded file:bg-gray-50" />
                    {it.firstImage && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <img src={it.firstImage} alt="first" className="w-28 rounded" />
                        <button className="text-xs text-gray-600 hover:underline" onClick={() => updateItem(idx, { firstImage: undefined })}>移除首帧</button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div>首帧图 URL：</div>
                    <input type="url" placeholder="https://..." value={it.firstImage || ''} onChange={e => updateItem(idx, { firstImage: e.target.value })} className="w-full border rounded px-2 py-1" />
                  </div>
                </div>

                <div className="mt-3 flex gap-2 items-center">
                  <button onClick={() => submitOne(idx)} disabled={!it.prompt.trim()} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed">提交</button>
                  <span className="text-sm text-gray-700">状态：{it.status || '-'}</span>
                </div>

                {it.videoUrl && (
                  <div className="mt-2">
                    <video src={it.videoUrl} controls className="w-full rounded" />
                    <div className="mt-1.5">
                      <a href={it.videoUrl} target="_blank" rel="noreferrer" className="mr-2 text-blue-600 hover:underline">在新窗口打开</a>
                      <a href={it.videoUrl} download className="text-blue-600 hover:underline">下载视频</a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}