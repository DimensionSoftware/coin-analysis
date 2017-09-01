const {
  RtmClient,
  CLIENT_EVENTS,
  MemoryDataStore
} = require('@slack/client')

const
  Promise  = require('bluebird'),
  Lazy     = require('lazy.js'),
  Influx   = require('influx'),
  moment   = require('moment'),
  h        = require('../helpers'),
  analysis = require('../analysis'),
  bittrex  = require('../exchange/bittrex')

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 20

/*
 A lot of this can probably be done in Kapacitor, but this is the
 easiest thing for me to implement right now.  Once I buy myself some time,
 I'll learn how to use kapacitor to do this.
 */

module.exports = class Bot {
  constructor(opts={}) {
    this.influx = new Influx.InfluxDB(bittrex.influxSchema)
    if (opts.events) {
      this.events = opts.events
      this.events.on('data', (currencyPair) => {
        this.analyzeCurrencyPair(currencyPair)
      })
    }
  }

  /**
   * Connect to Slack
   */
  async connect() {
    return 0
  }

  async loadRecentCandles(currencyPair, opt={ limit: DEFAULT_LIMIT }) {
    return await this.influx.query(`
    SELECT *
    FROM bittrex_market_5min
    WHERE currencyPair = ${Influx.escape.stringLit(currencyPair)}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `)
  }

  async loadMeanValues(currencyPair, opt={ limit: DEFAULT_LIMIT }) {
    let meanVolume = this.influx.query(`
    SELECT
      MEAN(baseVolume) AS bv,
      MEAN(volume)     AS v
    FROM bittrex_market_5min
    WHERE currencyPair = ${Influx.escape.stringLit(currencyPair)}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `)
    // InfluxDB doesn't have an ABS() function, so I'll do it in JS instead.
    let candleHeights = this.influx.query(`
    SELECT close - open AS diff
    FROM bittrex_market_5min
    WHERE currencyPair = ${Influx.escape.stringLit(currencyPair)}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `)
    let results = await Promise.all([meanVolume, candleHeights])

    return {
      meanVolume:       results[0][0],
      meanCandleHeight: Lazy(results[1]).map((height) => { return Math.abs(height.diff) }).sum() / results[1].length
    }
  }

  async analyzeCurrencyPair(currencyPair) {
    let r = 0

    try {
      // load recent candles
      let candles = await this.loadRecentCandles(currencyPair)

      // load mean volume and mean positive candle height (or mean absolute candle height?)
      let means = await this.loadMeanValues(currencyPair, { limit: 144 })

      let marketSummary = await bittrex.rest.getMarketSummary(currencyPair)

      let exchange = 'bittrex'

      // compare last candle height to the mean
      // send buy signal
      // - if volume and price go up significantly together
      // - if price goes significantly up together
      r = {
        sufficientVolume:                analysis.sufficientVolume({ marketSummary }),
        anomalousVolumeAndPriceIncrease: analysis.anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means })
      }

      if (r.anomalousVolumeAndPriceIncrease.hit && r.sufficientVolume.hit) {
        let r2 = await this.send(exchange, r.anomalousVolumeAndPriceIncrease.message)
      }

    } catch (e) {
      console.error(currencyPair, e)
    }

    return r
  }

  async send(channel, message) {
    console.warn('%s | %s | %s', moment().toLocaleString(), channel, message)
    return 1
  }
};
