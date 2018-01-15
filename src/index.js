const assert = require('assert')
const http = require('http')
const proxy = require('./proxy')

const { PORT } = process.env

assert(PORT, 'PORT is not set')

const listener = proxy

http.createServer(listener).listen(PORT)
