/**
 * @fileOverview A more sophisticated and hopefully more profitable strategy
 * @name wave-rider.js
 * @author beppu
 * @license undefined
 */
const Strategy = require('./base'),
      fsm      = require('../fsm'),
      h        = require('../helpers'),
      db       = require('../db'),
      ti       = require('technicalindicators')

/*

 Things I'd like to try:

  - MACD 5m, 30m, and 1h
  - Can we accurately anticipate big MACD crosses (30m, and 1h) before they happen?
    + If we can clone the ti objects and feed them hypothetical future data,
      I think we can make educated guesses and act a little earlier.

 */
module.exports = class WaveRider extends Strategy {
  /**
   * Synchronous initialization should go here.
   *
   * @param {Object} opts
   */
  constructor(opts) {
    super(opts)
    this.mode = 'buy'
    this.opts = opts
    this.ti   = {
      macd1h:      undefined,
      macd30m:     undefined,
      rsi30m:      undefined,
      rsi5m:       undefined,
      anticipated: {
        macd1h:    undefined,
        macd30m:   undefined
      }
    }
  }

  /**
   * Any asynchronous initialization that needs to happen before running the stategy should go here.
   *
   * @param {Object} opts
   * @param {String} opts.exchange
   * @param {String} opts.currencyPair
   * @param {Moment} opts.startTime
   */
  async init({exchange, currencyPair, startTime}) {
    let d    = db[exchange]

    // How much past data do I really need to be sufficiently accurate?

    let past1h    = startTime.clone().subtract(40, 'days')
    let r1h       = await d.summarizePrices(currencyPair, '1h', past1h, startTime)
    let prices1h  = r1h.map((p)  => p.close)

    let past30m   = startTime.clone().subtract(20, 'days')
    let r30m      = await d.summarizePrices(currencyPair, '30m', past30m, startTime)
    let prices30m = r30m.map((p) => p.close)

    let past5m    = startTime.clone().subtract(10, 'days')
    let r5m       = await d.prices(currencyPair, past5m, startTime)
    let prices5m  = r5m.map((p)  => p.close)

    this.macd1h = new ti.MACD({
      fastPeriod:         12,
      slowPeriod:         26,
      signalPeriod:       9,
      SimpleMAOscillator: false,
      SimpleMASignal:     false,
      values:             prices1h
    })
    let macd1h              = this.macd1h.getResult()
    let macd1hLast          = macd1h[macd1h.length - 1]
    this.macd1hCenterCross  = h.crossConstantFn(h.crossState(macd1hLast.MACD, 0), 0)
    this.macd1hSignalCross  = h.crossPairFn(h.crossState(macd1hLast.MACD, macd1hLast.signal))

    this.macd30m = new ti.MACD({
      fastPeriod:         12,
      slowPeriod:         26,
      signalPeriod:       9,
      SimpleMAOscillator: false,
      SimpleMASignal:     false,
      values:             prices30m
    })
    let macd30m             = this.macd30m.getResult()
    let macd30mLast         = macd30m[macd30m.length - 1]
    this.macd30mCenterCross = h.crossConstantFn(h.crossState(macd30mLast.MACD, 0), 0)
    this.macd30mSignalCross = h.crossPairFn(h.crossState(macd30mLast.MACD, macd30mLast.signal))

    let rsi30mLimit = this.opts.rsi30mLimit || 77
    this.rsi30m  = new ti.RSI({
      period: 14,
      values: prices30m
    })
    let rsi30m              = this.rsi30m.getResult()
    let rsi30mLast          = rsi30m[rsi30m.length - 1]
    this.rsi30mTopCross     = h.crossConstantFn(h.crossState(rsi30mLast, rsi30mLimit), rsi30mLimit)

    let rsi5mLimit = this.opts.rsi5mLimit || 77
    this.rsi5mg  = new ti.RSI({
      period: 14,
      values: prices5m
    })
    let rsi5m              = this.rsi30m.getResult()
    let rsi5mLast          = rsi5m[rsi5m.length - 1]
    this.rsi5mTopCross     = h.crossConstantFn(h.crossState(rsi5mLast, rsi5mLimit), rsi5mLimit)
  }

  /**
   * Given a price and timestamp, decide what to do next.
   *
   * @param   {Candle} candle
   * @returns {Object}
   */
  action(candle) {
    let timestamp = candle.time
    let price     = candle.close

    // smallest intervals first
    this.ti.rsi5m               = this.rsi5m.nextValue(price)
    this.ti.anticipated.macd30m = this.anticipate(this.macd30m, price)
    this.ti.anticipated.macd1h  = this.anticipate(this.macd1h, price)

    if (timestamp.minute() === 0 || timestamp.minute() === 30) {
      this.ti.rsi30m = this.rsi30m.nextValue(price)
      this.ti.macd30m = this.macd30m.nextValue(price)
    }

    if (timestamp.minute() === 0) {
      this.ti.macd1h = this.macd1h.nextValue(price)
    }

    // TODO - Figure out how to buy and sell profitably.
    switch (this.mode) {
    case 'buy':
      this.mode = 'stage1'
      break;
    case 'stage1':
      this.mode = 'stage2'
      break;
    case 'stage2':
      this.mode = 'sell'
      break;
    case 'sell':
      this.mode = 'buy'
      break;
    }

    return null
  }

  /**
   * TODO - Anticipate what the next state might be given a price.
   *        I might have to get clever with the fsm implementation.
   *
   * @param   {FSMFunction} next
   * @param   {Number}      price
   * @returns {String}      the next potential state
   */
  anticipate(next, price) {
    return undefined
  }
}
