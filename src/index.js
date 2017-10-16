const assert = require('assert')
const http = require('http')
const axios = require('axios')
const httpProxy = require('http-proxy')
const { makeOpenGraphForRoute, makeRouteIndex } = require('./openGraph')

const CRAWLER_USER_AGENTS = /facebookexternalhit|Facebot|Twitterbot|Pinterest|Googlebot|Google.*snippet|Google-Structured/

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

const listener = async (req, res) => {
  const { url } = req
  const [robotAgent] = (req.headers['user-agent'] || '').match(CRAWLER_USER_AGENTS) || []

  if (robotAgent && shouldRedirect(url)) {
    const [routeId] = url.match(/\d+/) || []
    const robotsPath = routeId ? `/routes/${routeId}` : '/routes'
    const makeHTML = routeId ? makeOpenGraphForRoute : makeRouteIndex
    const payload = await axios.get(ROBOTS_URL + robotsPath).then(r => makeHTML(r.data))
    res.end(payload)
  } else {
    const ignorePath = url.match(/\./) === null
    proxy.web(req, res, { ignorePath, target: BACKEND_URL })
  }
}

http.createServer(listener).listen(PORT)
