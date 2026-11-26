import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

/**
 * Vercel serverless proxy for Euron's EURI gateway.
 *
 * The gateway only allows browser requests from a short list of origins, so the app
 * calls /api/euri/* on its own domain and this function forwards to the gateway.
 * The API key lives in the private EURI_API_KEY environment variable and never
 * reaches the browser. A caller may still send its own Authorization header, which
 * is passed through unchanged.
 */

const UPSTREAM = 'https://api.euron.one/api/v1/euri'
const ALLOWED = new Set(['chat/completions', 'audio/speech', 'audio/transcriptions', 'models', 'embeddings', 'responses'])

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/^\/api\/euri\/?/, '')
  url.searchParams.delete('...path') // added by Vercel's catch-all routing
  const serverKey = (process.env.EURI_API_KEY ?? '').trim()

  if (path === 'health') return json(res, 200, { configured: serverKey.startsWith('euri-') })
  if (!ALLOWED.has(path)) return json(res, 404, { error: { message: `Unknown endpoint ${path}` } })

  const incomingAuth = req.headers.authorization
  const auth = incomingAuth || (serverKey ? `Bearer ${serverKey}` : '')
  if (!auth) return json(res, 401, { error: { message: 'No EURI API key configured on the server and none supplied.' } })

  const headers: Record<string, string> = { authorization: auth, accept: String(req.headers.accept ?? '*/*') }
  if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type'])

  const method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)

  let upstream: Response
  try {
    upstream = await fetch(`${UPSTREAM}/${path}${url.search}`, { method, headers, body })
  } catch (e) {
    return json(res, 502, { error: { message: `Gateway unreachable: ${e instanceof Error ? e.message : String(e)}` } })
  }

  res.statusCode = upstream.status
  for (const h of ['content-type', 'cache-control']) {
    const v = upstream.headers.get(h)
    if (v) res.setHeader(h, v)
  }
  res.setHeader('x-accel-buffering', 'no')
  if (!upstream.body) return res.end()
  // Stream straight through so SSE chat chunks reach the browser as they arrive.
  Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res)
}
