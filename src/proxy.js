const assert = require('assert')
const axios = require('axios')
const { parse } = require('url')
const {
  makeOpenGraphForRoute,
  makeRouteSitemap,
} = require('./openGraph')

const CRAWLER_USER_AGENTS = /facebookexternalhit|Facebot|Slackbot|TelegramBot|WhatsApp|Twitterbot|Pinterest/

const { ROBOTS_URL, BACKEND_URL } = process.env

assert(BACKEND_URL, 'BACKEND_URL is not set')
assert(ROBOTS_URL, 'ROBOTS_URL is not set')

const isIndexableTab = url => url.startsWith('/tabs/route/') || (url.startsWith('/tabs/crowdstart/') && url.endsWith('/detail'))
const isTabPath = url => url.match(/\./) === null && url.startsWith('/tabs')
const isRouteBanner = url => url.startsWith('/images/banners/routes/')

module.exports = async (req, res) => {
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
        .replace('<head>', `
          <head><base href="/" />
          <meta name="keywords" content="Beeline, Beeline Singapore , GrabShuttle,  book, routes, crowdstart,  crowdsourced,  shuttle,  bus service " />
          <meta property="description" content="Label: ${h(routeData.label)}, From: ${h(routeData.from)},  To: ${h(routeData.to)}, Schedule: ${h(routeData.schedule)}" />
        `)
        .replace(/.*?<title>(.*?)<\/title>.*/, `
          <title>${h(routeData.label)}: ${h(routeData.from)} – ${h(routeData.to)}</title>
        `)

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
      const imageUrl = isGrab
        ? 'https://www.beeline.sg/images/fb_gs_hero_large.jpg'
        : 'https://www.beeline.sg/images/fb_hero_large.png'
      const image = await axios.get(imageUrl, { responseType: 'arraybuffer' }).then(r => r.data)
      res.writeHead(200, { 'Content-Type': isGrab ? 'image/jpg' : 'image/png' })
      res.end(image)
    }
  } else {
    const response = await axios
      .get(
        BACKEND_URL + url,
        url.match(/\.(png|(woff|ttf)2?(\?.+)?)$/) ? { responseType: 'arraybuffer' } : {},
      )
      .catch(({ response: r }) => r)
    const contentType = response.headers['content-type']
    res.writeHead(response.status, { 'Content-Type': contentType })
    if (response.data) {
      res.end(contentType.startsWith('application/json') ? JSON.stringify(response.data) : response.data)
    } else {
      res.end('')
    }
  }
}
