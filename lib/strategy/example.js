const
  Strategy = require('./base'),
  fsm      = require('../fsm'),
  ti       = require('technicalindicators')

/**
 * This is our first experimental trading strategy.
 */
module.exports = class Example extends Strategy {
  /**
   * Synchronous initialization should go here.
   *
   * @param {} opts
   */
  constructor(opts) {
    super(opts)
  }

  /**
   * Any asynchronous initialization that needs to happen before running the stategy should go here.
   *
   * @param {Object} opts
   */
  async init(opts) {
    // TODO init RSI & MACD with initial values
  }

  /**
   * Given a price and timestamp, decide what to do next.
   *
   * @param   {Number} price
   * @param   {Moment} timestamp
   * @returns {Object}
   */
  action(price, timestamp) {
    // TODO use streaming RSI.nextValue & MACD.nextValue

    // Look for 1d MACD cross up from below center.
    // Switch to 30m MACD and look for MACD cross up from below center (if possible)
    // Switch to 5m MACD and look for MACD cross up from below center
    // BUY near bottom.
    // Ride up until 30m RSI hits limit.
    // SELL
    // Loop back to looking for 30m MACD cross up from below center.
    // If 1 day MACD crosses down from above center, exit market or switch to dead cat bounce rider.
    return null
  }
}
