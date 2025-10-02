'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Veo3 批量视频生成项目</h1>
      <p>前往提交页面：</p>
      <Link href="/veo3">/veo3</Link>
    </div>
  )
}