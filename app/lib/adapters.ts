export interface SourceAdapter<Item, Settings, Detail> {
  name: string
  tokenKey: string
  createEndpoint: string
  detailEndpoint: string
  buildCreateBody: (item: Item, settings: Settings, token?: string) => any
  parseDetailResponse: (resp: any) => Detail | null
}

// ---- Sora2 Adapter ----
export type SoraItem = {
  id: string
  prompt: string
  image_urls?: string[]
}

export type SoraSettings = {
  duration: number
  fps: number
  resolution: string
}

export type SoraDetail = {
  status: string
  video_url?: string
  error?: string
}

export const Sora2Adapter: SourceAdapter<SoraItem, SoraSettings, SoraDetail> = {
  name: 'Sora2',
  tokenKey: 'sora2_token',
  createEndpoint: '/api/sora2/create',
  detailEndpoint: '/api/sora2/query',
  buildCreateBody: (item, settings, token) => ({
    token,
    prompt: item.prompt,
    image_urls: item.image_urls || [],
    duration: settings.duration,
    fps: settings.fps,
    resolution: settings.resolution,
  }),
  parseDetailResponse: (resp: any) => {
    if (!resp) return null
    const status = resp?.status || resp?.data?.status || 'unknown'
    const video_url = resp?.video_url || resp?.data?.video_url
    const error = resp?.error || resp?.data?.error
    return { status, video_url, error }
  },
}

// ---- Veo3 Adapter ----
export type VeoItem = {
  id: string
  prompt: string
  images?: string[]
}

export type VeoSettings = {
  model: string
  enhancePrompt: boolean
  enableUpsample: boolean
  aspectRatio: string
}

export type VeoDetail = {
  status: string
  video_url?: string
  error?: string
}

export const Veo3Adapter: SourceAdapter<VeoItem, VeoSettings, VeoDetail> = {
  name: 'Veo3',
  tokenKey: 'veo3_token',
  createEndpoint: '/api/veo3/create',
  detailEndpoint: '/api/veo3/detail',
  buildCreateBody: (item, settings, token) => ({
    token,
    prompt: item.prompt,
    options: {
      model: settings.model,
      images: item.images || [],
      enhancePrompt: settings.enhancePrompt,
      enableUpsample: settings.enableUpsample,
      aspectRatio: settings.aspectRatio,
    },
  }),
  parseDetailResponse: (resp: any) => {
    if (!resp) return null
    const status = resp?.status || resp?.data?.status || 'unknown'
    const video_url = resp?.video_url || resp?.data?.video_url
    const error = resp?.error || resp?.data?.error
    return { status, video_url, error }
  },
}