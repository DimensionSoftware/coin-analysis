const Koa = require('koa')
const koa = new Koa()

const poloniex = require('./lib/exchange/poloniex')
const bittrex = require('./lib/exchange/bittrex')

let p = poloniex.ws.init()
p = poloniex.ws.start(p)

console.log('Streaming...')
