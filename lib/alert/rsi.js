
const
  moment = require('moment'),
  ti     = require('technicalindicators'),
  h      = require('../helpers'),
  db     = require('../db')

module.exports = class RSI {
  constructor({interval, limit, currencyPair, rsiLimit}) {
    this.opts = {interval, limit, currencyPair, rsiLimit}
    this.type = 'RSI'
  }

  async init({exchange}) {
    const {interval, currencyPair} = this.opts
    let d    = db[exchange]
    let past = moment().subtract(20, 'days')
    let r    = await d.summarizePrices(currencyPair, interval, past, moment())

    let initialPrices = r.map((p) => p.close)

    let rsiLimit = this.opts.rsiLimit || 77 // sell indicator
    this.rsi = new ti.RSI({
      period: 14,
      values: initialPrices
    })
    let rsi       = this.rsi.getResult()
    let rsiLast   = rsi[rsi.length - 1]
    this.rsiCross = h.crossConstantFn(h.crossState(rsiLast, rsiLimit), rsiLimit)
  }

  shouldAlert(candle) {
    const time = moment(candle.time)
    if (h.isIntervalBoundry(this.opts.interval, time)) {
      let state = this.rsiCross(candle.close)
      if (this.opts.limit > 50) {
        // crossAbove
        return state == 'crossAbove'
      } else {
        // crossBelow
        return state == 'crossBelow'
      }
    }
    return false
  }
}
