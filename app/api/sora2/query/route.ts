import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const token = url.searchParams.get('token')
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const remote = `http://yunwu.ai/v1/video/query?id=${encodeURIComponent(id)}`
    const resp = await fetch(remote, { method: 'GET', headers })

    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      return NextResponse.json({ error: 'query_failed', detail: data }, { status: resp.status })
    }
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: 'unexpected_error', message: String(err?.message || err) }, { status: 500 })
  }
}