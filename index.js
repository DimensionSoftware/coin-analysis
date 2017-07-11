
const
  autobahn = require('autobahn'),
  moment = require('moment')

// main
// ---------
const cx = new autobahn.Connection({ url: "wss://api.poloniex.com", realm: "realm1" })
// cx.onopen = function(s) { s.subscribe('ticker', function(market, ev) { console.log(market) }) };
cx.onopen = function(s) { s.subscribe('ticker', showFn('BTC_ETH')) }
cx.open()

function showFn(market) {
  return function(x, ev) {
    if (x[0] == market) {
      console.log(x, moment().format())
    } else {
      console.log(x[0], moment().format())
    }
  }
}
