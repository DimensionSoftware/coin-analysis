const Koa = require('koa')
const koa = new Koa()

const {poloniex, bittrex} = require('./lib/ex')
const Bot   = require('./lib/bot')
const token = process.env.TOKEN

;(async function() {
  let b   = await bittrex.rest.init()
  let bot = new Bot({ token, events: b.events })
  let c   = await bot.connect()
  let b2  = await bittrex.rest.start(b)
})()

// [+] laziness
// [+] Impatience !
// [+] HUBRIS     !!!
