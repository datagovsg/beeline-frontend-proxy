const _ = require('lodash')
const querystring = require('querystring')

const proxy = require('./proxy')

const reqFrom = (event) => {
  const qs = querystring.stringify(event.queryParameters)
  return {
    headers: _.mapKeys(event.headers, k => k.toLowerCase()),
    url: event.path + (qs ? `?${qs}` : ''),
  }
}

module.exports = {
  handler: (event, context, callback) => {
    proxy(reqFrom(event))
      .then((response) => {
        const headers = {
          'Access-Control-Allow-Origin': '*', // Required for CORS support to work
        }
        const isBase64Encoded = response.body instanceof Buffer
        const body = isBase64Encoded ? response.body.toString('base64') : response.body
        const payload = {
          isBase64Encoded,
          statusCode: response.statusCode,
          headers: _.merge(response.headers, headers),
          body,
        }
        callback(null, payload)
      })
      .catch(console.error)
  },
}
