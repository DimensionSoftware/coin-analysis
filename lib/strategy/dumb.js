const
  Strategy = require('./base'),
  fsm      = require('../fsm'),
  ti       = require('technicalindicators')

/**
 * This is our first experimental trading strategy.
 */
module.exports = class Dumb extends Strategy {
  /**
   * Syncrhrounous initialization should go here.
   *
   * @param {} opts
   */
  constructor(opts) {
    super(opts)
  }

  /**
   * Any async initialization that needs to happen before running the stategy should go here.
   *
   * @param {Object} opts
   */
  async init(opts) {
  }

  /**
   * Given a price and timestamp, decide what to do next.
   *
   * @param   {Number} price
   * @param   {Moment} timestamp
   * @returns {Object}
   */
  action(price, timestamp) {
    return null
  }
}
