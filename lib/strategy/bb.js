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
      ti       = require('technicalindicators'),
      bb       = require('../ta/bb-helpers.js')

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
      percentb5m: undefined
    }
    this.vals = {
      bband4h:    [],
      bband1h:    [],
      bband5m:    [],

      percentb4h: [],
      percentb1h: [],
      percentb5m: []
    }
  }

  async init({exchange, currencyPair, startTime}) {
    let d = db[exchange]
    let past4h = startTime.clone().subtract(20, 'days')
    let r4h = await d.summarizePrices(currencyPair, '4h', past4h, startTime)
    let initialPrices4h = r4h.map((p) => p.close)
    this.ti.bband4h = new ti.BollingerBands({
      period: 20,
      stdDev: 2,
      values: initialPrices4h
    })
    let past1h = startTime.clone().subtract(10, 'days')
    let r1h = await d.summarizePrices(currencyPair, '1h', past1h, startTime)
    let initialPrices1h = r1h.map((p) => p.close)
    this.ti.bband1h = new ti.BollingerBands({
      period: 20,
      stdDev: 2,
      values: initialPrices1h
    })
    let past5m = startTime.clone().subtract(5, 'days')
    let r5m = await d.summarizePrices(currencyPair, '5m', past5m, startTime)
    let initialPrices5m = r5m.map((p) => p.close)
    this.ti.bband5m = new ti.BollingerBands({
      period: 20,
      stdDev: 2,
      values: initialPrices5m
    })
  }

  action(candle) {
    return null
  }

  /**
   * Recognize divergence in %b versus price
   *
   * @param  {Array<Number>} percentbs
   * @param  {Array<Number>} prices
   * @return {Boolean}       true if %b diverges from price movement
   */
  isDivergent(percentbs, prices) {
  }

}
