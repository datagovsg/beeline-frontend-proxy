const fs = require('fs')
const Handlebars = require('handlebars')
const path = require('path')
const _ = require('lodash')

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

const makeRouteIndexHTML = (data) => {
  const routeIdsAndTags = _.filter(data, r => _.intersection(r.tags, ['lite', 'failed', 'success']).length === 0)
  const crowdstartOrRoute = row => (row.tags.includes('crowdstart') ? `crowdstart/${row.id}/detail` : `route/${row.id}`)

  return routeIdsAndTags
    .map(row => `<a href="/tabs/${crowdstartOrRoute(row)}">${row.id}</a>`)
    .join('<br/>\n')
}

const makeRouteIndex = async (data) => {
  const payload = { links: await makeRouteIndexHTML(data) }
  return htmlFrom(payload, 'og-route-index.html')
}

const makeOpenGraphForRoute = async (route) => {
  const isCrowdstart = route.tags.includes('crowdstart')
  const urlPath = isCrowdstart ? `crowdstart/${route.id}/detail` : `route/${route.id}`
  const verb = isCrowdstart ? 'Crowdstart' : 'Book'
  return htmlFrom(_.assign({ urlPath, verb }, route), 'og-route.html')
}

const gmtToSGTString = dateTimeString => dateTimeString.replace('Z', '+0800')

const makeRouteBanner = async (route) => {
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
  }
  return svgFrom(payload, 'route-banner.svg')
}

module.exports = { makeOpenGraphForRoute, makeRouteIndex, makeRouteBanner }
