
const BlueBird = require('bluebird')
const fs = require('fs')
const Handlebars = require('handlebars')
const path = require('path')
const _ = require('lodash')

const htmlFrom = async (payload, templateFileName) => {
  const templateText = await BlueBird.promisify(fs.readFile)(
    path.join(path.dirname(module.filename), `../static/${templateFileName}`),
    'utf8',
  )
  const template = Handlebars.compile(templateText)
  return template(payload)
}

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


module.exports = { makeOpenGraphForRoute, makeRouteIndex }
