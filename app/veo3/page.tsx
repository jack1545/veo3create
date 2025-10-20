'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type AspectRatio = '16:9' | '9:16'

type Veo3FrontendModel =
  | 'veo3'
  | 'veo3-fast-frames'
  | 'veo3-fast'
  | 'veo3-pro'
  | 'veo3-pro-frames'
  | 'veo3-frames'
  | 'veo3.1'
  | 'veo3.1-fast'
  | 'veo3.1-pro'

type SubmitItem = {
  id?: string
  prompt: string
  aspectRatio?: AspectRatio
  firstImage?: string
  status?: string
  videoUrl?: string
}

type GlobalSettings = {
  model: Veo3FrontendModel
  aspectRatio: AspectRatio
  enhancePrompt: boolean
  enableUpsample: boolean
}

const defaultSettings: GlobalSettings = {
  model: 'veo3.1',
  aspectRatio: '9:16',
  enhancePrompt: true,
  enableUpsample: false
}

import { compressImageIfNeededToDataUrl } from '../lib/image'

async function createVeo3Job(item: SubmitItem, settings: GlobalSettings, token?: string): Promise<{ id?: string; status?: string } | null> {
  const images: string[] = []
  if (item.firstImage) images.push(item.firstImage)

  const resp = await fetch('/api/veo3/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: item.prompt,
      options: {
        model: settings.model,
        images,
        enhancePrompt: settings.enhancePrompt,
        enableUpsample: settings.enableUpsample,
        aspectRatio: item.aspectRatio || settings.aspectRatio
      },
      token
    })
  })
  if (!resp.ok) return null
  return await resp.json()
}

async function fetchVeo3Detail(id: string, token?: string): Promise<{ status?: string; video_url?: string } | null> {
  const q = new URLSearchParams({ id })
  if (token) q.set('token', token)
  const resp = await fetch(`/api/veo3/detail?${q.toString()}`)
  if (!resp.ok) return null
  return await resp.json()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Veo3Page() {
  const [settings, setSettings] = useState<GlobalSettings>(() => defaultSettings)
  const [items, setItems] = useState<SubmitItem[]>(() => [{ prompt: '', aspectRatio: undefined }])
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit')
  const [history, setHistory] = useState<SubmitItem[]>([])
  const pollingRef = useRef<Record<string, any>>({})
  const [batchInput, setBatchInput] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [droppedImageUrls, setDroppedImageUrls] = useState<string[]>([])
  const [modelOrder, setModelOrder] = useState<Veo3FrontendModel[]>(() => {
    try {
      const raw = localStorage.getItem('veo3_model_order')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          return arr.filter(Boolean) as Veo3FrontendModel[]
        }
      }
    } catch {}
    return ['veo3.1','veo3.1-fast','veo3.1-pro','veo3','veo3-fast-frames','veo3-fast','veo3-pro','veo3-pro-frames','veo3-frames']
  })
  const dragModelIndex = useRef<number | null>(null)
  const onDragStartModel = (idx: number) => { dragModelIndex.current = idx }
  const onDragOverModel = (e: React.DragEvent<HTMLSpanElement>) => { e.preventDefault() }
  const onDropModel = (idx: number) => {
    const from = dragModelIndex.current
    if (from == null) return
    setModelOrder(prev => {
      const next = [...prev]
      const [m] = next.splice(from, 1)
      next.splice(idx, 0, m)
      try { localStorage.setItem('veo3_model_order', JSON.stringify(next)) } catch {}
      return next
    })
    dragModelIndex.current = null
  }
  const [showModelSorter, setShowModelSorter] = useState(false)

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

  const getCachedWithTTL = (key: string): any | null => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj !== 'object') return null
      const ts = obj.ts || 0
      if (Date.now() - ts > ONE_WEEK_MS) {
        localStorage.removeItem(key)
        return null
      }
      return obj.value
    } catch { return null }
  }

  const setCachedWithTTL = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }))
    } catch {}
  }

  const getCachedVideoUrl = (id: string): string | null => {
    return getCachedWithTTL(`veo3_video_${id}`)
  }
  const setCachedVideoUrl = (id: string, url: string) => {
    setCachedWithTTL(`veo3_video_${id}`, url)
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('veo3_history')
      if (saved) {
        setHistory(JSON.parse(saved))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('veo3_history', JSON.stringify(history.slice(0, 100)))
    } catch {}
  }, [history])

  useEffect(() => {
    const cachedToken = getCachedWithTTL('veo3_token')
    if (cachedToken) setToken(cachedToken)
  }, [])

  const canSubmitAll = useMemo(() => items.some(i => i.prompt.trim().length > 0), [items])

  const priceTag = useMemo(() => {
    const m = settings.model
    if (m === 'veo3') return '￥0.63一条'
    if (m === 'veo3.1-pro') return '￥2.45一条'
    if (m === 'veo3.1' || m === 'veo3.1-fast') return '￥0.49一条'
    if (m === 'veo3-pro' || m === 'veo3-pro-frames') return '￥2.8一条'
    return null
  }, [settings.model])

  const addItem = () => setItems(prev => [...prev, { prompt: '', aspectRatio: '9:16' }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, patch: Partial<SubmitItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const handleImageUpload = async (idx: number, file?: File) => {
    if (!file) return
    const url = await compressImageIfNeededToDataUrl(file)
    updateItem(idx, { firstImage: url })
  }

  const generateItemsFromBatch = () => {
    const lines = batchInput
      .replace(/[“”"`]+/g, '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    setItems(lines.map(l => ({ prompt: l, aspectRatio: '9:16' })))
  }

  const clearBatchInput = () => setBatchInput('')

  const saveToken = () => {
    const t = token.trim()
    if (!t) return
    setCachedWithTTL('veo3_token', t)
  }
  const clearToken = () => {
    try { localStorage.removeItem('veo3_token') } catch {}
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
    const res = await createVeo3Job(it, settings, token)
    const id = res?.id || ''
    if (!id) {
      updateItem(idx, { status: 'error' })
      return
    }
    updateItem(idx, { id, status: 'submitted' })
    setHistory(prev => [{ ...it, id, status: 'submitted' }, ...prev])

    // start polling
    const cachedUrl = getCachedVideoUrl(id)
    if (cachedUrl) {
      updateItem(idx, { status: 'completed', videoUrl: cachedUrl })
      return
    }

    const poll = async () => {
      const detail = await fetchVeo3Detail(id, token)
      const status = detail?.status || 'unknown'
      const videoUrl = detail?.video_url
      updateItem(idx, { status, videoUrl })
      if (videoUrl || status === 'completed' || status === 'failed') {
        if (videoUrl) setCachedVideoUrl(id, videoUrl)
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

  return (
    <div className="px-4 max-w-screen-xl mx-auto md:pr-[340px]">
      <div className="flex items-baseline gap-3 justify-between">
        <h1 className="m-0 text-xl sm:text-2xl font-semibold">Veo3 批量视频生成</h1>
        <div className="text-sm text-gray-600">
          目前仅支持yunwu.ai，VEO3.1 视频目前￥0.49/8秒。技巧：分镜如果是连续的可以一次生成2个分镜
        </div>
      </div>

      <div className="mt-3 mb-3">
        <button onClick={() => setActiveTab('submit')} disabled={activeTab === 'submit'} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50">提交</button>
        <a href="/history" className="ml-2 text-blue-600 hover:underline">历史</a>
      </div>

      {activeTab === 'history' ? (
        <div>
          <h2 className="text-lg font-semibold">历史记录</h2>
          {history.length === 0 ? <p className="text-gray-600">暂无记录</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((h, i) => (
                <div key={i} className="border rounded p-2">
                  <div className="text-xs text-gray-600">ID: {h.id}</div>
                  <div className="whitespace-pre-wrap break-words">{h.prompt}</div>
                  <div>状态: {h.status || 'unknown'}</div>
                  {h.videoUrl && (
                    <video src={h.videoUrl} controls className="w-full mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold">Token 设置</h2>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="password"
              placeholder="填入你的 Veo3 API Token（仅本地缓存一周）"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="flex-1 border rounded px-2 py-1"
            />
            <button onClick={saveToken} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">保存到缓存</button>
            <button onClick={clearToken} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">移除缓存</button>
          </div>
          <div className="text-xs text-red-700 -mt-2 mb-3">
            风险提示：Token 不会保存到服务器，仅在本地缓存一周。请勿在公共设备输入或分享你的 Token；若担心泄露，随时点击“移除缓存”。
          </div>

          <h2 className="text-lg font-semibold">批量录入提示词</h2>
          <div className="mb-3">
            <textarea
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              rows={6}
              placeholder={'一行一条提示词，示例:\n机器人走到沙雕前，一脚踩坏了沙雕。女孩向后坐在地上大哭。\n女孩悲伤地跑进了一个地下通道，地下通道中有一扇赛博朋克风格的巨门。女孩用手掌纹打开了巨门。'}
              className="w-full border rounded px-2 py-2"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={generateItemsFromBatch} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">生成条目</button>
              <button onClick={clearBatchInput} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">清空</button>
            </div>
          </div>

          <div
            className="border-2 border-dashed rounded p-3 mb-3 bg-gray-50"
            onDragOver={e => { e.preventDefault() }}
            onDrop={async e => {
              e.preventDefault()
              const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'))
              if (!files.length) return
              const targets = items.map((it, idx) => ({ idx, has: Boolean(it.firstImage) }))
              let ti = 0
              const newUrls: string[] = []
              for (const file of files) {
                while (ti < targets.length && targets[ti].has) ti++
                if (ti >= targets.length) break
                const url = await compressImageIfNeededToDataUrl(file)
                updateItem(targets[ti].idx, { firstImage: url })
                newUrls.push(url)
                ti++
              }
              if (newUrls.length) setDroppedImageUrls(prev => [...prev, ...newUrls])
            }}
          >
            图片批量拖拽区域（支持多张，按顺序分配到未设置首帧的条目）
          </div>

          {droppedImageUrls.length > 0 && (
            <div className="hidden md:block fixed top-24 right-4 w-[300px] max-h-[70vh] overflow-y-auto bg-white border rounded shadow-lg p-2 z-50">
              <div className="flex justify-between items-center mb-1.5">
                <div className="font-semibold">已拖入图片（可拖到条目以调整归属）</div>
                <button className="text-xs" onClick={() => setDroppedImageUrls([])}>清空</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {droppedImageUrls.map((url, i) => (
                  <div key={i} className="relative border rounded p-1.5">
                    <img
                      src={url}
                      alt={`dropped-${i}`}
                      className="w-full h-[90px] object-cover"
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', url)
                        e.dataTransfer.setData('sourcePoolIndex', String(i))
                      }}
                    />
                    <button
                      title="删除"
                      onClick={() => setDroppedImageUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-white border border-gray-300 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2>全局设置</h2>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              模型：
              <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value as Veo3FrontendModel }))} className="ml-2 border rounded px-2 py-1">
                {modelOrder.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {priceTag && (
                <span className="ml-2 text-red-600 text-sm">{priceTag}</span>
              )}
              <div className="mt-2">
                 <button onClick={() => setShowModelSorter(s => !s)} className="px-2 py-1 rounded border border-gray-300 text-sm">{showModelSorter ? '折叠排序' : '展开排序'}</button>
                 {showModelSorter && (
                   <div className="mt-2 flex gap-2 flex-wrap items-center">
                     <span className="text-xs text-gray-600">拖动以调整顺序：</span>
                     {modelOrder.map((m, idx) => (
                       <span
                         key={m}
                         draggable
                         onDragStart={() => onDragStartModel(idx)}
                         onDragOver={onDragOverModel}
                         onDrop={() => onDropModel(idx)}
                         className={`px-2 py-0.5 rounded-full border border-gray-300 cursor-grab ${m===settings.model ? 'bg-blue-50' : 'bg-white'}`}
                       >
                         {m}
                       </span>
                     ))}
                   </div>
                 )}
               </div>
            </label>
            <label className="text-sm">
              画幅：
              <select value={settings.aspectRatio} onChange={e => setSettings(s => ({ ...s, aspectRatio: e.target.value as AspectRatio }))} className="ml-2 border rounded px-2 py-1">
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
            <label className="text-sm">
              <input type="checkbox" checked={settings.enhancePrompt} onChange={e => setSettings(s => ({ ...s, enhancePrompt: e.target.checked }))} className="mr-1" /> 自动润色
            </label>
            <label className="text-sm">
              <input type="checkbox" checked={settings.enableUpsample} onChange={e => setSettings(s => ({ ...s, enableUpsample: e.target.checked }))} className="mr-1" /> 超采样
            </label>
          </div>

          <div className="mt-4 mb-2 flex gap-2">
            <button onClick={addItem} className="px-3 py-1 rounded border border-gray-300">新增条目</button>
            <button onClick={submitAll} disabled={!canSubmitAll} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 bg-brand hover:bg-brand-dark disabled:opacity-50">提交全部</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-4 bg-white shadow-sm"
                onDragOver={e => { e.preventDefault() }}
                onDrop={async e => {
                  e.preventDefault()
                  const text = e.dataTransfer.getData('text/plain')
                  const srcIdxStr = e.dataTransfer.getData('sourceItemIdx')
                  if (text) {
                    updateItem(idx, { firstImage: text })
                    if (srcIdxStr) {
                      const sIdx = Number(srcIdxStr)
                      if (!Number.isNaN(sIdx)) updateItem(sIdx, { firstImage: undefined })
                    }
                    return
                  }
                  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'))
                  if (files.length) {
                    const url = await compressImageIfNeededToDataUrl(files[0])
                    updateItem(idx, { firstImage: url })
                  }
                }}
              >
                <div className="flex justify-between items-center">
                  <strong className="font-semibold">条目 {idx + 1}</strong>
                  <button onClick={() => removeItem(idx)} className="text-sm text-red-600 hover:underline">删除</button>
                </div>
                <label className="block mt-2 text-sm">提示词：</label>
                <textarea value={it.prompt} onChange={e => updateItem(idx, { prompt: e.target.value })} rows={4} className="w-full mt-1 border rounded px-2 py-1" placeholder="输入中文提示词即可，API会将中文转为英文" />

                <label className="block mt-2 text-sm">画幅：</label>
                <select value={it.aspectRatio || '9:16'} onChange={e => updateItem(idx, { aspectRatio: e.target.value as AspectRatio })} className="border rounded px-2 py-1">
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                </select>

                <div className="flex gap-3 mt-2">
                  <div className="md:w-48 overflow-hidden">
                    <div>首帧图：</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(idx, e.target.files?.[0])}
                      onDragOver={e => { e.preventDefault() }}
                      onDrop={async e => {
                        e.preventDefault()
                        const text = e.dataTransfer.getData('text/plain')
                        const srcIdxStr = e.dataTransfer.getData('sourceItemIdx')
                        if (text) {
                          updateItem(idx, { firstImage: text })
                          if (srcIdxStr) {
                            const sIdx = Number(srcIdxStr)
                            if (!Number.isNaN(sIdx)) updateItem(sIdx, { firstImage: undefined })
                          }
                          return
                        }
                        const f = e.dataTransfer.files?.[0]
                        if (f && f.type.startsWith('image/')) {
                          const url = await compressImageIfNeededToDataUrl(f)
                          updateItem(idx, { firstImage: url })
                        }
                      }}
                      className="mt-1 block w-full text-sm file:px-2 file:py-1 file:border file:rounded file:bg-gray-50"
                    />
                    {it.firstImage && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <img
                          src={it.firstImage}
                          alt="first"
                          className="w-28 rounded"
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', it.firstImage || '')
                            e.dataTransfer.setData('sourceItemIdx', String(idx))
                          }}
                        />
                        <button className="text-xs text-gray-600 hover:underline" onClick={() => updateItem(idx, { firstImage: undefined })}>移除首帧</button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div>首帧图 URL：</div>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={it.firstImage || ''}
                      onChange={e => updateItem(idx, { firstImage: e.target.value })}
                      className="w-full border rounded px-2 py-1"
                    />
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