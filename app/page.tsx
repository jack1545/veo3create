'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Veo3 批量视频生成</h2>
        <p className="text-sm text-gray-600 mb-4">支持拖拽排序与价格提示</p>
        <Link href="/veo3" className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark">进入 Veo3</Link>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Sora-2 视频生成</h2>
        <p className="text-sm text-gray-600 mb-4">新增价格与时长限制</p>
        <Link href="/sora2" className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark">进入 Sora-2</Link>
      </div>
    </div>
  )
}