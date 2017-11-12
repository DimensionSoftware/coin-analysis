
const
  moment = require('moment'),
  ti     = require('technicalindicators'),
  h      = require('../helpers')

module.exports = class MACD {
  constructor({interval, currencyPair, past}) {
    this.opts = {
      interval,
      currencyPair,
      past,
      fastPeriod:         12,
      slowPeriod:         26,
      signalPeriod:       9,
      SimpleMAOscillator: false,
      SimpleMASignal:     false
    }
  }

  async init({exchange}) {
    const {interval, currencyPair, past} = this.opts
    const
      d    = db[exchange],
      prev = moment().subtract(past || 20, 'days'), // look behind
      r    = await d.summarizePrices(currencyPair, interval, prev, moment())
    const // initial prices
      values = r.map((p) => p.close)

    this.macd = new ti.MACD({...this.opts, values})
    let macd     = this.macd.getResult()
    let macdLast = macd[macd.length - 1]
    this.macdCenterCross = h.crossConstantFn(h.crossState(macdLast.MACD, 0), 0)
    this.macdSignalCross = h.crossPairFn(h.crossState(macdLast.MACD, macdLast.signal))
  }

  shouldAlert(candle) {
    const
      time     = moment(candle.time),
      interval = this.opts.interval
    if (h.isIntervalBoundry(interval, time)) {
      const
        macd            = this.macd.nextValue(candle.close),
        macdCenterCross = this.macdCenterCross(macd.MACD),
        macdSignalCross = this.macdSignalCross([macd.MACD, macd.signal])
      // alert if macd crosses in either direction
      if (macdCenterCross === 'below' && macdSignalCross === 'crossAbove') return true
      if (macdCenterCross === 'above' && macdSignalCross === 'crossBelow') return true
      return false
    }
    return false
  }
}
