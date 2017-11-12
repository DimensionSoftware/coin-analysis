
const
  moment = require('moment'),
  ti     = require('technicalindicators'),
  h      = require('../helpers')

module.exports = class MACD {
  constructor({interval, currencyPair}) {
    this.opts = {
      interval,
      currencyPair,
      fastPeriod:         12,
      slowPeriod:         26,
      signalPeriod:       9,
      SimpleMAOscillator: false,
      SimpleMASignal:     false
    }
  }

  async init({exchange}) {
    const {interval, currencyPair} = this.opts
    let d    = db[exchange]
    let past = moment().subtract(20, 'days')
    let r    = await d.summarizePrices(currencyPair, interval, past, moment())

    let initialPrices = r.map((p) => p.close)

    this.macd30m = new ti.MACD({...this.opts, values: initialPrices})
    let macd                = this.macd30m.getResult()
    let macdLast            = macd[macd.length - 1]
    this.macd30mCenterCross = h.crossConstantFn(h.crossState(macdLast.MACD, 0), 0)
    this.macd30mSignalCross = h.crossPairFn(h.crossState(macdLast.MACD, macdLast.signal))
  }

  shouldAlert(candle) {
    const
      time = moment(candle.time),
      interval = this.opts.interval
    if (h.isIntervalBoundry(interval, time)) {
      const
        macd               = this.macd30m.nextValue(candle.close),
        macd30mCenterCross = this.macd30mCenterCross(macd.MACD),
        macd30mSignalCross = this.macd30mSignalCross([macd.MACD, macd.signal])
      // alert if 30m macd crosses in either direction
      if (macd30mCenterCross === 'below' && macd30mSignalCross === 'crossAbove') return true
      if (macd30mCenterCross === 'above' && macd30mSignalCross === 'crossBelow') return true
      return false
    }
    return false
  }
}
