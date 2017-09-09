function reload(module){
  delete require.cache[require.resolve(module)]
  return require(module)
}

global.reload   = reload
global.rl       = reload
global.cl       = console.log

global.Promise  = require('bluebird')
global.Lazy     = require('lazy.js')
global.Influx   = require('influx')
global.moment   = require('moment')
global.sprintf  = require('sprintf')
global.winston  = require('winston')

global.helpers  = require('./lib/helpers')
global.h        = helpers
global.hp       = helpers.percentChange
global.bittrex  = require('./lib/exchange/bittrex')
global.poloniex = require('./lib/exchange/poloniex')
global.analysis = require('./lib/analysis')
global.Bot      = require('./lib/bot')
