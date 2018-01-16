const assert = require('assert')
const http = require('http')
const proxy = require('./proxy')

const { PORT } = process.env

assert(PORT, 'PORT is not set')

const listener = (req, res) => proxy(req)
  .then((response) => {
    res.writeHead(response.statusCode || 200, response.headers || {})
    res.end(response.body)
  })

http.createServer(listener).listen(PORT)
