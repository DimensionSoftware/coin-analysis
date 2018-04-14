const Strategy = require('./base'),
      fsm      = require('../fsm'),
      h        = require('../helpers'),
      db       = require('../db'),
      ti       = require('technicalindicators')

module.exports = class HeikinAshi extends Strategy {
  constructor(opts) {
    super(opts)
    this.mode = 'buy'
    this.opts = opts
    this.interval = this.opts.interval || '1d'
    this.candleBuffer = []
  }

  async init({exchange, currencyPair, startTime}) {
    // calculate initial Heikin Ashi candle
  }

  action(candle) {
    let action = null
    if (h.isIntervalBoundry(this.interval, candle.time)) {
      // calculate new heikin ashi candle
      // determine action
      // clear candleBuffer
      this.candleBuffer = []
      return action
    } else {
      this.candleBuffer.push(candle)
      return null
    }
  }
}
