import { NextResponse } from 'next/server'

type Veo3Model =
  | 'veo3-fast'
  | 'veo3-pro'
  | 'veo3-pro-frames'
  | 'veo3-frames'
  | 'veo3-fast-frames'
  | 'veo3'

interface Veo3CreateOptions {
  model?: Veo3Model
  images?: string[]
  enhancePrompt?: boolean
  enableUpsample?: boolean
  aspectRatio?: '16:9' | '9:16'
}

interface Veo3CreatePayload {
  prompt: string
  options?: Veo3CreateOptions
  token?: string
}

async function resolveVeo3ApiKey(): Promise<string | null> {
  const directKey = process.env.VEO3_API_KEY
  if (directKey && directKey !== 'your_veo3_api_key' && directKey.length >= 16) {
    return directKey
  }
  return null
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Veo3CreatePayload

    if (!payload?.prompt || typeof payload.prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid request payload: prompt is required' }, { status: 400 })
    }

    // Resolve API key securely on the server
    const clientToken = (payload as any)?.token
    let apiKey = (clientToken && clientToken.length >= 16) ? clientToken : (await resolveVeo3ApiKey())
    if (!apiKey) {
      return NextResponse.json({ error: 'Veo3 API key not configured' }, { status: 401 })
    }

    const opts = payload.options || {}
    const body: Record<string, unknown> = {
      model: opts.model ?? 'veo3-fast-frames',
      prompt: payload.prompt,
      enhance_prompt: opts.enhancePrompt ?? true,
      enable_upsample: opts.enableUpsample ?? false,
      aspect_ratio: opts.aspectRatio ?? '16:9'
    }

    if (opts.images && Array.isArray(opts.images) && opts.images.length) {
      body.images = opts.images
    }

    const response = await fetch('https://yunwu.ai/v1/video/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorPayload = await response.text()
      return NextResponse.json({ error: `Veo3 API error: ${response.status} ${errorPayload}` }, { status: response.status })
    }

    const data = await response.json()
    const jobId = data?.id ?? data?.choices?.[0]?.message?.content ?? `veo3-${Date.now()}`
    const status = data?.choices?.[0]?.finish_reason ?? 'submitted'

    return NextResponse.json({ id: jobId, status, response: data })
  } catch (error) {
    console.error('Veo3 create route error', error)
    return NextResponse.json({ error: 'Failed to submit Veo3 job' }, { status: 500 })
  }
}