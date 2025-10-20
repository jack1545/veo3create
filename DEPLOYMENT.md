# 部署方案：Vercel + MongoDB Atlas + Cloudflare

本项目（`veo3_video`，Next.js + App Router）可以在 Vercel 上部署，使用 MongoDB Atlas 存储任务与历史元数据，Cloudflare 负责域名解析与可选的前置代理/CDN。

## 总体结论
- 可行性高：Vercel（Next.js）+ Atlas（数据库）+ Cloudflare（DNS/CDN）是常见组合。
- 关键点是数据库连接策略与运行时选择：
  - 使用 Node.js Runtime 的 Serverless Functions 连接 Atlas（Node 驱动 + 连接复用）；
  - 若需要 Edge Runtime，使用 Atlas Data API（HTTP）替代 Node 驱动。

## 架构与职责
- 前端与接口：Vercel 托管 Next.js；`app/api/*/route.ts` 处理 API 请求，并与 `https://yunwu.ai` 交互。
- 数据存储（Atlas）：存储任务与历史元数据（taskId、status、video_url、prompt、createdAt 等）。不在数据库保存视频文件（单文档上限16MB）。
- DNS/CDN（Cloudflare）：
  - DNS 指向 Vercel；
  - 对静态资源强缓存；对 `/api/*` 及 SSR 页面绕过缓存；
  - 可开启 WAF/速率限制保护接口。

## 环境变量（Vercel Project Settings）
- `MONGODB_URI`：Atlas 连接串，`mongodb+srv://...`
- `MONGODB_DB_NAME`：数据库名称，例如 `veo3`
- `SORA2_API_KEY`：Sora2 服务端备用密钥（已在服务端实现 token fallback）
- `VEO3_API_KEY`：Veo3 服务端备用密钥（已在服务端实现 token fallback）
- 可选：`NEXT_PUBLIC_APP_BASE_URL`（如需在前端使用绝对地址）

## Atlas 准备步骤
1. 创建 Atlas 集群，区域与 Vercel 部署区域尽量靠近。
2. 新建数据库用户，并在 Network Access 添加 IP 访问（一般允许所有出站即可）。
3. 复制连接串 `mongodb+srv://...`，填入 Vercel 环境变量。
4. 预建集合与索引（可通过 `mongosh` 或 Atlas UI）：
   - 创建集合 `jobs` 用于任务元数据。
   - TTL 索引（示例：对 `createdAt` 设置一周自动清理）：
     ```
     db.jobs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 })
     ```

## 代码接入（Node 驱动 + 连接复用）
> 注：以下代码片段是建议；本仓库尚未写入到实际文件中，你可按此方案添加。

- 新增 `app/lib/mongodb.ts`：
  ```ts
  import { MongoClient } from 'mongodb'

  const uri = process.env.MONGODB_URI!
  const options = { maxPoolSize: 5 }

  declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined
  }

  let clientPromise: Promise<MongoClient>

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise!

  export default clientPromise
  ```
- 在需要读写数据库的 API Route 顶部声明运行时并使用连接：
  ```ts
  export const runtime = 'nodejs'
  import clientPromise from '@/app/lib/mongodb'

  export async function POST(req: Request) {
    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB_NAME || 'veo3')
    const jobs = db.collection('jobs')
    const payload = await req.json()

    await jobs.insertOne({
      taskId: payload.id,
      status: payload.status || 'created',
      prompt: payload.prompt,
      video_url: payload.video_url,
      createdAt: new Date()
    })

    return Response.json({ ok: true })
  }
  ```

## Edge Runtime 方案（Atlas Data API）
如需将部分接口改为 Edge Runtime（或避免 Node 驱动）：使用 Atlas Data API（HTTP）。注意 Data API 有速率与功能限制，写入频繁场景更推荐 Node 驱动。

- 示例（伪代码，仅示意）：
  ```ts
  export const runtime = 'edge'

  export async function POST(req: Request) {
    const body = await req.json()
    const resp = await fetch('https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1/action/insertOne', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.MONGODB_DATA_API_KEY!
      },
      body: JSON.stringify({
        dataSource: '<cluster-name>',
        database: process.env.MONGODB_DB_NAME || 'veo3',
        collection: 'jobs',
        document: {
          taskId: body.id,
          status: body.status || 'created',
          prompt: body.prompt,
          video_url: body.video_url,
          createdAt: new Date()
        }
      })
    })
    return new Response(await resp.text(), { status: resp.status })
  }
  ```

## Cloudflare 配置建议
- **DNS**：将域名 CNAME 到 Vercel；按 Vercel 文档开启 CNAME flattening。
- **缓存规则**：
  - `/_next/static/*`、`/public/*`：强缓存（Vercel/Next 输出 `Cache-Control: immutable, max-age`）。
  - `/api/*`、SSR 页面：绕过缓存（避免旧状态与鉴权问题）。
- **代理与安全**：可启用 WAF/速率限制、Bot 保护；若不需二次 CDN，可设为 `DNS only`。

## 部署步骤（顺序操作）
1. Atlas：完成集群、用户、Network Access、连接串复制与索引准备。
2. Vercel：导入 `veo3_video` 项目，设置环境变量（见上）。
3. 在需要使用数据库的 `route.ts` 顶部加 `export const runtime = 'nodejs'`，并使用 `lib/mongodb.ts`。
4. 确保所有对外 API 均使用 `https://`（目前已切换 `yunwu.ai` 为 HTTPS）。
5. （可选）绑定自定义域名并在 Cloudflare 完成 DNS/代理与缓存规则配置。
6. 部署；在 Vercel Logs 与 Atlas Metrics 验证读写正常。

## 测试清单
- 打开 `/sora2` 与 `/veo3` 页面，使用客户端 Token 或服务端 API Key fallback 进行任务创建；
- 验证 `/api/sora2/create` 与 `/api/sora2/query`、`/api/veo3/create` 与 `/api/veo3/detail` 正常；
- 在 Atlas 查询 `jobs` 集合，确认写入元数据；TTL 索引是否自动清理过期文档；
- Cloudflare 代理时，确认 `/api/*` 未被缓存，静态资源命中缓存。

## 常见坑与规避
- 不要在 Edge Runtime 使用 MongoDB Node 驱动；必须回退 Node Runtime 或改用 Data API。
- 连接复用：在 Serverless 中用全局变量缓存 `MongoClient`，避免冷启动反复握手导致延迟与连接占满。
- 并发控制：`maxPoolSize` 不宜过大；批量写入时做队列/批处理。
- 视频文件不要入库：仅保存外链与元数据；如需对象存储可考虑 Cloudflare R2。
- 区域选择：Atlas 与 Vercel 尽量靠近；降低网络往返。

## 后续扩展
- 将历史页的查询结果落库，并提供基于 Mongo 的分页与筛选。
- 对 `video_url` 增加签名校验与过期检测逻辑，避免前端展示过期链接。
- 加入简单审计日志（谁创建了任务、何时查询）。