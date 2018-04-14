const Strategy = require('./base'),
      fsm      = require('../fsm'),
      h        = require('../helpers'),
      db       = require('../db'),
      ti       = require('technicalindicators'),
      Lazy     = require('lazy.js')

module.exports = class HeikinAshi extends Strategy {
  constructor(opts) {
    super(opts)
    this.opts = opts
    this.interval = this.opts.interval || '1h'
    this.candleBuffer = []
    this.previousCandleColor = 'green' // or 'red'
  }

  async init({exchange, currencyPair, startTime}) {
    // calculate initial Heikin Ashi candle
    let match       = this.interval.match(/(\d+)(\w)/)
    let units       = match[2]
    let past        = startTime.clone().subtract(3, units)
    let candles     = await db.bittrex.summarizePrices(currencyPair, this.interval, past, startTime)
    let ohlc        = h.ohlc(candles)
    this.heikinAshi = new ti.HeikinAshi(ohlc)

    let res = this.heikinAshi.getResult()
    let lastCandle = {
      open: res.open[res.open.length - 1],
      close: res.close[res.close.length - 1]
    }
    this.previousCandleColor = this.candleColor(lastCandle);
  }

  summarizeCandleBuffer(buffer) {
    let open  = buffer[0].open
    let high  = Lazy(buffer).map((c) => c.high).max()
    let low   = Lazy(buffer).map((c) => c.low).min()
    let close = buffer[buffer.length - 1].close
    return { open, high, low, close }
  }

  candleColor(hCandle) {
    if (hCandle.open > hCandle.close) {
      return 'green'
    } else {
      return 'red'
    }
  }

  action(candle) {
    let action = null
    let price = candle.close
    this.candleBuffer.push(candle)
    if (h.isIntervalBoundary(this.interval, candle.time)) {
      // summarize candleBuffer
      let sCandle = this.summarizeCandleBuffer(this.candleBuffer)
      // calculate new heikin ashi candle
      let hCandle = this.heikinAshi.nextValue(sCandle)
      // determine action
      let color = this.candleColor(hCandle)
      console.warn(candle.time, color)
      if (color != this.previousCandleColor) {
        if (color === 'green') {
          this.lastAmount = 0.15 / price
          action = { method: 'buy', amount: this.lastAmount, price }
        } else {
          action = { method: 'sell', amount: this.lastAmount, price }
        }
        this.previousCandleColor = color
      }
      // clear candleBuffer
      this.candleBuffer = []
      return action
    } else {
      return null
    }
  }
}
