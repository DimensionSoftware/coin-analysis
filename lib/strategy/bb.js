/**
 * @fileOverview A Bollinger Band-based trading strategy
 * @name bb.js
 * @author beppu
 * @license undefined
 */
const Strategy = require('./base'),
      fsm      = require('../fsm'),
      h        = require('../helpers'),
      db       = require('../db'),
      ti       = require('technicalindicators')

module.exports = class BB extends Strategy {

  constructor(opts) {
    super(opts)
    this.mode = 'buy'
    this.opts = opts
    this.ti = {
      bband4h:    undefined,
      bband1h:    undefined,
      bband5m:    undefined,

      percentb4h: undefined,
      percentb1h: undefined,
      percentb5m: undefined,

      width4h:    undefined,
      width1h:    undefined,
      width5m:    undefined
    }
  }

  async init({exchange, currencyPair, startTime}) {
    let d = db[exchange]
  }

  action(candle) {
    return null
  }

  /**
   * Recognize divergence in %b versus price
   *
   * @param {Array<Number>} percentbs
   * @param {Array<Number>} prices
   */
  isDivergent(percentbs, prices) {
  }

}
