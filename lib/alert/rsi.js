
const
  moment = require('moment'),
  ti = require('technicalindicators'),
  h = require('../helpers')

module.exports = class RSI {
  constructor({interval, limit, currencyPair}) {
    this.opts = {interval, limit, currencyPair}
  }

  async init({exchange}) {
    const {interval} = this.opts
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

  async shouldAlert(candle) {
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
  }
}
