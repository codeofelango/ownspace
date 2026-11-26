import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const UPSTREAM = 'https://api.euron.one/api/v1/euri'

/**
 * Dev-only stand-in for api/euri/[...path].ts: forwards /api/euri/* to the EURI
 * gateway and injects EURI_API_KEY from .env.local when the browser sends no key.
 */
const euriDevProxy = (key: string): Plugin => ({
  name: 'euri-dev-proxy',
  configureServer(server) {
    server.middlewares.use('/api/euri/health', (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ configured: key.startsWith('euri-') }))
    })
  },
  config: () => ({
    server: {
      proxy: {
        '/api/euri': {
          target: UPSTREAM,
          changeOrigin: true,
          rewrite: p => p.replace(/^\/api\/euri/, ''),
          configure: proxy => {
            proxy.on('proxyReq', req => {
              // The gateway rejects unknown browser origins; this is a server-to-server call.
              for (const h of ['origin', 'referer', 'cookie', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest']) req.removeHeader(h)
              if (!req.getHeader('authorization') && key) req.setHeader('authorization', `Bearer ${key}`)
            })
          },
        },
      },
    },
  }),
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), euriDevProxy((env.EURI_API_KEY ?? '').trim())],
  }
})
