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

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/euri\/?/, '')
  const serverKey = (process.env.EURI_API_KEY ?? '').trim()

  if (path === 'health') {
    return Response.json({ configured: serverKey.startsWith('euri-') })
  }
  if (!ALLOWED.has(path)) {
    return Response.json({ error: { message: `Unknown endpoint ${path}` } }, { status: 404 })
  }

  const auth = req.headers.get('authorization') || (serverKey ? `Bearer ${serverKey}` : '')
  if (!auth) {
    return Response.json({ error: { message: 'No EURI API key configured on the server and none supplied.' } }, { status: 401 })
  }

  const headers = new Headers()
  headers.set('authorization', auth)
  const ct = req.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  headers.set('accept', req.headers.get('accept') ?? '*/*')

  const upstream = await fetch(`${UPSTREAM}/${path}${url.search}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    // @ts-expect-error Node fetch needs this to stream a request body.
    duplex: 'half',
  })

  const out = new Headers()
  for (const h of ['content-type', 'cache-control']) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }
  out.set('x-accel-buffering', 'no')
  return new Response(upstream.body, { status: upstream.status, headers: out })
}
