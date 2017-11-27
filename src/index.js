const assert = require('assert')
const http = require('http')
const axios = require('axios')
const httpProxy = require('http-proxy')
const svg2png = require('svg2png')
const { parse } = require('url')
const {
  makeOpenGraphForRoute,
  makeRouteBanner,
  makeRouteSitemap,
} = require('./openGraph')

const CRAWLER_USER_AGENTS = /facebookexternalhit|Facebot|Slackbot|TelegramBot|WhatsApp|Twitterbot|Pinterest/

const { ROBOTS_URL, BACKEND_URL, PORT } = process.env

assert(BACKEND_URL, 'BACKEND_URL is not set')
assert(ROBOTS_URL, 'ROBOTS_URL is not set')
assert(PORT, 'PORT is not set')

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
})

const isIndexableTab = url => url.startsWith('/tabs/route/') || (url.startsWith('/tabs/crowdstart/') && url.endsWith('/detail'))
const isTabPath = url => url.match(/\./) === null && url.startsWith('/tabs')
const isRouteBanner = url => url.startsWith('/images/banners/routes/')

const listener = async (req, res) => {
  const { url } = req
  const { query, pathname } = parse(url, true)

  const isGrab = query.operator === 'grab' || req.headers.host === 'grabshuttle.beeline.sg'
  const [robotAgent] = (req.headers['user-agent'] || '').match(CRAWLER_USER_AGENTS) || []
  if (robotAgent && isIndexableTab(url)) {
    console.log(`Receiving request from ${req.headers['user-agent']}`)
    const [routeId] = url.match(/\d+/) || []
    if (!routeId) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`${url} not found`)
    } else {
      const payload =
        await axios.get(`${ROBOTS_URL}/routes/${routeId}`).then(r => makeOpenGraphForRoute(r.data, isGrab))
      res.end(payload)
    }
  } else if (pathname === '/sitemap.txt') {
    const payload = await axios.get(`${ROBOTS_URL}/routes`).then(r => makeRouteSitemap(r.data))
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(payload)
  } else if (isIndexableTab(url)) {
    const [routeId] = url.match(/\d+/) || []
    if (!routeId) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`${url} not found`)
    } else {
      const payloadPromise = axios.get(BACKEND_URL + (isGrab ? '/grab.html' : '')).then(r => r.data)
      const routeDataPromise = routeId
        ? axios.get(`${ROBOTS_URL}/routes/${routeId}`).then(r => r.data)
        : Promise.resolve(undefined)

      const [payload, routeData] = await Promise.all([payloadPromise, routeDataPromise])

      const h = rawStr => rawStr.replace(/[<>&]/g, i => `&#${i.charCodeAt(0)};`)
      const response = payload
        .replace('<ion-nav-view></ion-nav-view>', `
  <ion-nav-view>
    <h1>${h(routeData.label)}: ${h(routeData.from)} – ${h(routeData.to)}</h1>
    <h2>${h(routeData.schedule)}</h2>
    <p>Your browser is unable to display this page correctly.</p>
    <p>Download the Beeline app for your phone and book this route today!</p>

    <a href="https://play.google.com/store/apps/details?id=sg.beeline&utm_source=global_co&utm_medium=prtnr&utm_content=Mar2515&utm_campaign=PartBadge&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1">
      Download from Android Play
    </a><br/>
    <a href="https://itunes.apple.com/sg/app/beeline-sg/id1010615256?ls=1&mt=8">
      Download from the App Store
    </a>
  </ion-nav-view>
        `)
        .replace('<head>', '<head><base href="/" /><meta property="description" content="Beeline Singapore - Book a ride on crowdsourced bus shuttles." />')

      res.end(response)
    }
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
      const payload = trip ? await makeRouteBanner(route, isGrab) : undefined
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
