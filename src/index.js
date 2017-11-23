const assert = require('assert')
const http = require('http')
const axios = require('axios')
const httpProxy = require('http-proxy')
const svg2png = require('svg2png')
const { parse } = require('url')
const { makeOpenGraphForRoute, makeRouteIndex, makeRouteBanner } = require('./openGraph')

const CRAWLER_USER_AGENTS = /facebookexternalhit|Facebot|Slackbot|TelegramBot|WhatsApp|Twitterbot|Pinterest|Googlebot|Google.*snippet|Google-Structured/

const { ROBOTS_URL, BACKEND_URL, PORT } = process.env

assert(BACKEND_URL, 'BACKEND_URL is not set')
assert(ROBOTS_URL, 'ROBOTS_URL is not set')
assert(PORT, 'PORT is not set')

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
})

const shouldRedirect = url => url.startsWith('/tabs/route') || url.startsWith('/tabs/crowdstart')
const isTabPath = url => url.match(/\./) === null && url.startsWith('/tabs')
const isRouteBanner = url => url.startsWith('/images/banners/routes/')

const listener = async (req, res) => {
  const { url } = req
  const { query, pathname } = parse(url, true)

  const isGrab = query.operator === 'grab'
  const [robotAgent] = (req.headers['user-agent'] || '').match(CRAWLER_USER_AGENTS) || []
  if (robotAgent && shouldRedirect(url)) {
    console.log(`Receiving request from ${req.headers['user-agent']}`)
    const [routeId] = url.match(/\d+/) || []
    const payload = routeId
      ? await axios.get(`${ROBOTS_URL}/routes/${routeId}`).then(r => makeOpenGraphForRoute(r.data, query))
      : await axios.get(`${ROBOTS_URL}/routes`).then(r => makeRouteIndex(r.data))
    res.end(payload)
  } else if (isTabPath(url) || pathname === '/') {
    const payload = await axios.get(BACKEND_URL + (isGrab ? '/grab.html' : '')).then(r => r.data)
    res.end(payload.replace('<head>', '<head><base href="/" />'))
  } else if (isRouteBanner(url)) {
    const [routeId] = url.match(/\d+/) || []
    if (!routeId) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`${url} not found`)
    } else {
      const route = await axios.get(`${ROBOTS_URL}/routes/${routeId}?includeIndicative=true&includeTrips=false`).then(r => r.data)
      const { nextTripId } = route.indicativeTrip
      const trip = await axios.get(`${ROBOTS_URL}/trips/${nextTripId}`).then(r => r.data)
      Object.assign(route, { trip })
      const payload = trip ? await makeRouteBanner(route, query) : undefined
      if (!payload) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end(`${url} refers to a route with no trip`)
      } else {
        const [, ext] = url.match(/\.(.*)$/) || []
        if (ext === 'png') {
          res.setHeader('Content-Type', 'image/png')
          const png = await svg2png(Buffer.from(payload, 'utf8'))
          res.end(png)
        } else {
          res.setHeader('Content-Type', 'image/svg+xml')
          res.end(payload)
        }
      }
    }
  } else {
    proxy.web(req, res, { ignorePath: false, target: BACKEND_URL })
  }
}

http.createServer(listener).listen(PORT)
