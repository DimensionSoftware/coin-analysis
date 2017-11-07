const Strategy = require('./base'),
      fsm      = require('../fsm'),
      h        = require('../helpers'),
      db       = require('../db'),
      ti       = require('technicalindicators')

/*
  How do I do this?
  I get a price.
  I feed it into a simple line detection fsm.
  Looking for macd to be below center.
  Then I feed it into a different state machine that looks for macd signal cross up.

  What's complicated is there are two state machines I'm looking at simultaneously.
    macd center cross => below
    macd signal cross => cross up
  When those two conditions happen, then buy

  After buying, we go into sell mode.
  We wait for
    30m macd to cross down or
    30m rsi to reach a certain level
  Whichever comes first, sell.

  Part of me wanted to encapsulate all of this in one big state machine,
  but every new price can generate multiple outputs.

  Maybe I just use a combination of state machines and conditional statements.
 */

/**
 * This is our first experimental trading strategy.
 */
module.exports = class Example extends Strategy {
  /**
   * Synchronous initialization should go here.
   *
   * @param {Object} opts
   */
  constructor(opts) {
    super(opts)
    this.mode = 'buy'
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
    let past = startTime.clone().subtract(20, 'days')
    let r    = await d.summarizePrices(currencyPair, '30min', past, startTime)

    let initialPrices = r.map((p) => p.close)

    this.rsi30m  = new ti.RSI({
      period: 14,
      values: initialPrices
    })
    let rsi             = this.rsi30m.getResult()
    let rsiLast         = rsi[rsi.length - 1]
    this.rsi30mTopCross = h.crossConstantFn(h.crossState(rsiLast, 70), 70)

    this.macd30m = new ti.MACD({
      fastPeriod:         12,
      slowPeriod:         26,
      signalPeriod:       9,
      SimpleMAOscillator: false,
      SimpleMASignal:     false,
      values:             initialPrices
    })
    let macd                = this.macd30m.getResult()
    let macdLast            = macd[macd.length - 1]
    this.macd30mCenterCross = h.crossConstantFn(h.crossState(macdLast.MACD, 0), 0)
    this.macd30mSignalCross = h.crossPairFn(h.crossState(macdLast.MACD, macdLast.signal))
  }

  /**
   * Given a price and timestamp, decide what to do next.
   *
   * @param   {Number} price
   * @param   {Moment} timestamp
   * @returns {Object}
   */
  action(price, timestamp) {

    // 30m RSI and MACD are the only indicators I'm using to start with,
    // because I want to start easy.
    if (timestamp.minute() === 0 || timestamp.minute() === 30) {
      let macd               = this.macd30m.nextValue(price),
          rsi                = this.rsi30m.nextValue(price),
          rsi30mTopCross     = this.rsi30mTopCross([rsi]),
          macd30mCenterCross = this.macd30mCenterCross([macd.MACD]),
          macd30mSignalCross = this.macd30mSignalCross([[macd.MACD, macd.signal]])
      if (this.mode === 'buy') {
        if (macd30mCenterCross === 'below' && macd30mSignalCross === 'crossAbove') {
          this.mode = 'sell'
          this.lastAmount = 0.25 / price
          return { method: 'buy', amount: this.lastAmount, price }
        }
      } else if (this.mode == 'sell') {
        if (rsi30mTopCross === 'above' || rsi30mTopCross === 'crossAbove') {
          this.mode = 'buy'
          return { method: 'sell', amount: this.lastAmount, price }
        }
      }
    }
    return null


    // TODO use streaming RSI.nextValue & MACD.nextValue

    // Look for 1d MACD cross up from below center.
    // Switch to 30m MACD and look for MACD cross up from below center (if possible)
    // Switch to 5m MACD and look for MACD cross up from below center
    // BUY near bottom.
    // Ride up until 30m RSI hits limit.
    // SELL
    // Loop back to looking for 30m MACD cross up from below center.
    // If 1 day MACD crosses down from above center, exit market or switch to dead cat bounce rider.
  }
}
