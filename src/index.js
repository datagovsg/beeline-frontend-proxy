const assert = require('assert')
const http = require('http')

const httpProxy = require('http-proxy')

const CRAWLER_USER_AGENTS = /facebookexternalhit|Facebot|Twitterbot|Pinterest|Googlebot|Google.*snippet|Google-StructuredDataTestingTool/

const { ROBOTS_URL, BACKEND_URL, PORT } = process.env

assert(BACKEND_URL, 'BACKEND_URL is not set')
assert(ROBOTS_URL, 'ROBOTS_URL is not set')
assert(PORT, 'PORT is not set')

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
})

function shouldRedirect (url) {
  return url.startsWith('/tabs/route') || url.startsWith('/tabs/crowdstart')
}

function rewrite (url) {
  const [routeId] = url.match(/\d+/) || []
  return routeId ? `/routes/${routeId}` : '/routes'
}

const listener = (req, res) => {
  const { url } = req
  const [robotAgent] = (req.headers['user-agent'] || '').match(CRAWLER_USER_AGENTS) || []

  if (robotAgent && shouldRedirect(url)) {
    req.url = rewrite(url)
    proxy.web(req, res, { target: ROBOTS_URL })
  } else {
    const ignorePath = url.match(/\./) === null
    proxy.web(req, res, { ignorePath, target: BACKEND_URL })
  }
}

http.createServer(listener).listen(PORT)
