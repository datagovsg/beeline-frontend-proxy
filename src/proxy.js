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

const notFound = url => Promise.resolve({
  statusCode: 404,
  headers: { 'Content-Type': 'text/plain' },
  body: `${url} not found`,
})

module.exports = ({ url, headers }) => {
  const { query, pathname } = parse(url, true)

  const isGrab = query.operator === 'grab' || headers.host === 'grabshuttle.beeline.sg'
  const [robotAgent] = (headers['user-agent'] || '').match(CRAWLER_USER_AGENTS) || []
  if (robotAgent && isIndexableTab(url)) {
    console.log(`Receiving request from ${headers['user-agent']}`)
    const [routeId] = url.match(/\d+/) || []
    return routeId
      ? axios.get(`${ROBOTS_URL}/routes/${routeId}`)
        .then(r => ({
          body: makeOpenGraphForRoute(r.data, isGrab),
        }))
      : notFound(url)
  } else if (pathname === '/sitemap.txt') {
    return axios.get(`${ROBOTS_URL}/routes`)
      .then(r => ({
        body: makeRouteSitemap(r.data),
        headers: { 'Content-Type': 'text/plain' },
      }))
  } else if (isIndexableTab(url)) {
    const [routeId] = url.match(/\d+/) || []
    if (!routeId) {
      return notFound(url)
    }
    const payloadPromise = axios.get(BACKEND_URL + (isGrab ? '/grab.html' : '')).then(r => r.data)
    const routeDataPromise = routeId
      ? axios.get(`${ROBOTS_URL}/routes/${routeId}`).then(r => r.data)
      : Promise.resolve(undefined)

    return Promise.all([payloadPromise, routeDataPromise])
      .then(([payload, routeData]) => {
        const h = rawStr => rawStr.replace(/[<>&]/g, i => `&#${i.charCodeAt(0)};`)
        const body = payload
          .replace('<head>', `
            <head><base href="/" />
            <meta name="keywords" content="Beeline, Beeline Singapore , GrabShuttle,  book, routes, crowdstart,  crowdsourced,  shuttle,  bus service " />
            <meta property="description" content="Label: ${h(routeData.label)}, From: ${h(routeData.from)},  To: ${h(routeData.to)}, Schedule: ${h(routeData.schedule)}" />
          `)
          .replace(/.*?<title>(.*?)<\/title>.*/, `
            <title>${h(routeData.label)}: ${h(routeData.from)} – ${h(routeData.to)}</title>
          `)
        return { body }
      })
  } else if (isTabPath(url) || pathname === '/') {
    return axios.get(BACKEND_URL + (isGrab ? '/grab.html' : ''))
      .then(r => ({
        headers: { 'Content-Type': r.headers['content-type'] },
        body: r.data.replace('<head>', '<head><base href="/" />'),
      }))
  } else if (isRouteBanner(url)) {
    const [routeId] = url.match(/\d+/) || []
    if (!routeId) {
      return notFound(url)
    }
    const imageUrl = isGrab
      ? 'https://www.beeline.sg/images/fb_gs_hero_large.jpg'
      : 'https://www.beeline.sg/images/fb_hero_large.png'
    return axios.get(imageUrl, { responseType: 'arraybuffer' })
      .then(r => ({
        headers: { 'Content-Type': isGrab ? 'image/jpg' : 'image/png' },
        body: r.data,
      }))
  }

  return axios
    .get(
      BACKEND_URL + url,
      url.match(/\.(ico|png|gif|(woff|ttf)2?(\?.+)?)$/) ? { responseType: 'arraybuffer' } : {} // eslint-disable-line
    )
    .catch(({ response }) => response)
    .then((response) => {
      const contentType = response.headers['content-type']
      const body = response.data && contentType.startsWith('application/json')
        ? JSON.stringify(response.data) : response.data
      return {
        statusCode: response.status,
        headers: { 'Content-Type': contentType },
        body: body || '',
      }
    })
}
