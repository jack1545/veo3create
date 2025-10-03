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
  model: 'veo3-fast-frames',
  aspectRatio: '9:16',
  enhancePrompt: true,
  enableUpsample: false
}

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

  const addItem = () => setItems(prev => [...prev, { prompt: '', aspectRatio: '9:16' }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, patch: Partial<SubmitItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const handleImageUpload = async (idx: number, file?: File) => {
    if (!file) return
    const url = await readFileAsDataUrl(file)
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
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto', paddingRight: 340 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Veo3 批量视频生成</h1>
        <div style={{ color: '#666', fontSize: 14 }}>
          目前仅支持yunwu.ai，VEO3 视频目前￥0.6/8秒。技巧：分镜如果是连续的可以一次生成2个分镜
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <button onClick={() => setActiveTab('submit')} disabled={activeTab === 'submit'}>提交</button>
        <button onClick={() => setActiveTab('history')} style={{ marginLeft: 8 }} disabled={activeTab === 'history'}>历史</button>
      </div>

      {activeTab === 'history' ? (
        <div>
          <h2>历史记录</h2>
          {history.length === 0 ? <p>暂无记录</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {history.map((h, i) => (
                <div key={i} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>ID: {h.id}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{h.prompt}</div>
                  <div>状态: {h.status || 'unknown'}</div>
                  {h.videoUrl && (
                    <video src={h.videoUrl} controls style={{ width: '100%', marginTop: 8 }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2>Token 设置</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              type="password"
              placeholder="填入你的 Veo3 API Token（仅本地缓存一周）"
              value={token}
              onChange={e => setToken(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={saveToken}>保存到缓存</button>
            <button onClick={clearToken}>移除缓存</button>
          </div>
          <div style={{ fontSize: 12, color: '#a00', marginTop: -8, marginBottom: 12 }}>
            风险提示：Token 不会保存到服务器，仅在本地缓存一周。请勿在公共设备输入或分享你的 Token；若担心泄露，随时点击“移除缓存”。
          </div>

          <h2>批量录入提示词</h2>
          <div style={{ marginBottom: 12 }}>
            <textarea
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              rows={6}
              placeholder={'一行一条提示词，示例:\n机器人走到沙雕前，一脚踩坏了沙雕。女孩向后坐在地上大哭。\n女孩悲伤地跑进了一个地下通道，地下通道中有一扇赛博朋克风格的巨门。女孩用手掌纹打开了巨门。'}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={generateItemsFromBatch}>生成条目</button>
              <button onClick={clearBatchInput}>清空</button>
            </div>
          </div>

          <div
            style={{ border: '2px dashed #aaa', borderRadius: 8, padding: 12, marginBottom: 12, background: '#fafafa' }}
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
                const url = await readFileAsDataUrl(file)
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
            <div
              style={{
                position: 'fixed',
                top: 96,
                right: 16,
                width: 300,
                maxHeight: '70vh',
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 10,
                zIndex: 1000
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>已拖入图片（可拖到条目以调整归属）</div>
                <button style={{ fontSize: 12 }} onClick={() => setDroppedImageUrls([])}>清空</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {droppedImageUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 6, padding: 6 }}>
                    <img
                      src={url}
                      alt={`dropped-${i}`}
                      style={{ width: '100%', height: 90, objectFit: 'cover' }}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', url)
                        e.dataTransfer.setData('sourcePoolIndex', String(i))
                      }}
                    />
                    <button
                      title="删除"
                      onClick={() => setDroppedImageUrls(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 12,
                        width: 20,
                        height: 20,
                        lineHeight: '18px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2>全局设置</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              模型：
              <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value as Veo3FrontendModel }))}>
                <option value="veo3">veo3</option>
                <option value="veo3-fast-frames">veo3-fast-frames</option>
                <option value="veo3-fast">veo3-fast</option>
                <option value="veo3-pro">veo3-pro</option>
                <option value="veo3-pro-frames">veo3-pro-frames</option>
                <option value="veo3-frames">veo3-frames</option>
              </select>
            </label>
            <label>
              画幅：
              <select value={settings.aspectRatio} onChange={e => setSettings(s => ({ ...s, aspectRatio: e.target.value as AspectRatio }))}>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={settings.enhancePrompt} onChange={e => setSettings(s => ({ ...s, enhancePrompt: e.target.checked }))} /> 自动润色
            </label>
            <label>
              <input type="checkbox" checked={settings.enableUpsample} onChange={e => setSettings(s => ({ ...s, enableUpsample: e.target.checked }))} /> 超采样
            </label>
          </div>

          <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', gap: 8 }}>
            <button onClick={addItem}>新增条目</button>
            <button onClick={submitAll} disabled={!canSubmitAll}>提交全部</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}
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
                    const url = await readFileAsDataUrl(files[0])
                    updateItem(idx, { firstImage: url })
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>条目 {idx + 1}</strong>
                  <button onClick={() => removeItem(idx)}>删除</button>
                </div>
                <label style={{ display: 'block', marginTop: 8 }}>提示词：</label>
                <textarea value={it.prompt} onChange={e => updateItem(idx, { prompt: e.target.value })} rows={4} style={{ width: '100%' }} placeholder="输入中文提示词即可，API会将中文转为英文" />

                <label style={{ display: 'block', marginTop: 8 }}>画幅：</label>
                <select value={it.aspectRatio || '9:16'} onChange={e => updateItem(idx, { aspectRatio: e.target.value as AspectRatio })}>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                </select>

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <div>
                    <div>首帧图：</div>
                    <input type="file" accept="image/*" onChange={e => handleImageUpload(idx, e.target.files?.[0])}
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
                          const url = await readFileAsDataUrl(f)
                          updateItem(idx, { firstImage: url })
                        }
                      }}
                    />
                    {it.firstImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <img
                          src={it.firstImage}
                          alt="first"
                          style={{ width: 120 }}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', it.firstImage || '')
                            e.dataTransfer.setData('sourceItemIdx', String(idx))
                          }}
                        />
                        <button style={{ fontSize: 12 }} onClick={() => updateItem(idx, { firstImage: undefined })}>移除首帧</button>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div>首帧图 URL：</div>
                    <input
                      type="url"
                    placeholder="https://..."
                    value={it.firstImage || ''}
                    onChange={e => updateItem(idx, { firstImage: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => submitOne(idx)}>提交</button>
                  <span>状态：{it.status || '-'}</span>
                </div>

                {it.videoUrl && (
                  <div style={{ marginTop: 8 }}>
                    <video src={it.videoUrl} controls style={{ width: '100%' }} />
                    <div style={{ marginTop: 6 }}>
                      <a href={it.videoUrl} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>在新窗口打开</a>
                      <a href={it.videoUrl} download>下载视频</a>
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