const fs = require('fs')
const Handlebars = require('handlebars')
const path = require('path')
const _ = require('lodash')
const querystring = require('querystring')

const htmlFrom = async (payload, templateFileName) => {
  const templateText = fs.readFileSync(
    path.join(path.dirname(module.filename), `../static/${templateFileName}`),
    'utf8',
  )
  const template = Handlebars.compile(templateText)
  return template(payload)
}

// we are in effect just using a template to make a payload, so this alias is safe
const svgFrom = htmlFrom

const makeRouteSitemap = (data) => {
  const routeIdsAndTags = _.filter(data, r => _.intersection(r.tags, ['lite', 'failed', 'success']).length === 0)
  const crowdstartOrRoute = row => (row.tags.includes('crowdstart') ? `crowdstart/${row.id}/detail` : `route/${row.id}`)

  return routeIdsAndTags
    .map(row => `https://app.beeline.sg/tabs/${crowdstartOrRoute(row)}`)
    .join('\n')
}

const makeOpenGraphForRoute = async (route, operatorQuery) => {
  const isCrowdstart = route.tags.includes('crowdstart')
  const urlPath = isCrowdstart ? `crowdstart/${route.id}/detail` : `route/${route.id}`
  const verb = isCrowdstart ? 'Crowdstart' : 'Book'
  const app = operatorQuery.operator === 'grab' ? 'GrabShuttle' : 'Beeline'
  const smallHero = operatorQuery.operator === 'grab'
    ? 'https://app.beeline.sg/grab/mstile-310x310.png'
    : 'https://www.beeline.sg/images/fb_hero_small.png'
  const payload = {
    operatorQuery: operatorQuery ? `?${querystring.stringify(operatorQuery)}` : '',
    smallHero,
    urlPath,
    verb,
    app,
  }
  return htmlFrom(_.assign(payload, route), 'og-route.html')
}

const gmtToSGTString = dateTimeString => dateTimeString.replace('Z', '+0800')

const makeRouteBanner = async (route, operatorQuery) => {
  const isCrowdstart = route.tags.includes('crowdstart')
  const firstStopTime = new Date(route.trip.tripStops[0].time)
  const tripDate = new Date(gmtToSGTString(route.trip.date))
  const isMorning = firstStopTime.getTime() - tripDate.getTime() < 12 * 3600 * 1000
  const payload = {
    route,
    isCrowdstart,
    label: {
      prefix: route.label.charAt(0),
      number: route.label.substring(1),
      location: isMorning ? route.from : route.to,
    },
    height: (operatorQuery.operator === 'grab') ? 479 : 630,
    bannerPath: (operatorQuery.operator === 'grab')
      ? 'https://www.beeline.sg/images/fb_gs_hero_large.jpg'
      : 'https://www.beeline.sg/images/fb_hero_large.png',
  }
  return svgFrom(payload, 'route-banner.svg')
}

module.exports = {
  makeOpenGraphForRoute,
  makeRouteBanner,
  makeRouteSitemap,
}
