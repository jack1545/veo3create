import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      images = [],
      model = 'sora-2',
      orientation = 'portrait', // portrait | landscape
      prompt = '',
      size = 'small', // small(720p) | large(1080p)
      duration = 15,
      token
    } = body || {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const resp = await fetch('http://yunwu.ai/v1/video/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ images, model, orientation, prompt, size, duration })
    })

    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      return NextResponse.json({ error: 'create_failed', detail: data }, { status: resp.status })
    }
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: 'unexpected_error', message: String(err?.message || err) }, { status: 500 })
  }
}