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
    this.token  = opts.token
    if (opts.events) {
      this.events = opts.events
      this.events.on('data', (currencyPair) => {
        this.analyzeCurrencyPair(currencyPair)
      })
    }
  }

  /**
   * Connect to Slack
   *
   * @param  {String} token  authentication string
   * @return {Promise}       result of auth
   */
  async connect() {
    let rtm = new RtmClient(this.token)
    this.rtm = rtm
    rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (start) => {
      this.channels = Lazy(start.channels).reduce((m, a) => {
        m[a.name] = a
        return m
      }, {})
      rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
        console.log('Connected')
      })
    })
    return rtm.start();
  }

  async loadRecentCandles(currencyPair, opt={ limit: DEFAULT_LIMIT, from: null }) {
    const sql = `
    SELECT *
    FROM bittrex_market_5min
    WHERE currencyPair = ${Influx.escape.stringLit(currencyPair)}
      AND time <= ${opt.from ? Influx.escape.stringLit(h.influxTime(opt.from)) : 'NOW()'}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `
    return await this.influx.query(sql)
  }

  async loadMeanValues(currencyPair, opt={ limit: DEFAULT_LIMIT, from: null }) {
    let meanVolume = this.influx.query(`
    SELECT
      MEAN(baseVolume) AS bv,
      MEAN(volume)     AS v
    FROM bittrex_market_5min
    WHERE currencyPair = ${Influx.escape.stringLit(currencyPair)}
      AND time <= ${opt.from ? Influx.escape.stringLit(h.influxTime(opt.from)) : 'NOW()'}
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

  async analyzeCurrencyPair(currencyPair, opts={}) {
    let r = 0

    try {
      // load recent candles
      let options = Lazy({ limit: 60 }).merge(opts).value()
      let candles = await this.loadRecentCandles(currencyPair, options)

      // load mean volume and mean positive candle height (or mean absolute candle height?)
      let means = await this.loadMeanValues(currencyPair, options)

      let marketSummary = await bittrex.rest.getMarketSummary(currencyPair)

      let exchange = 'bittrex'

      // compare last candle height to the mean
      // send buy signal
      // - if volume and price go up significantly together
      // - if price goes significantly up together
      r = {
        previouslyLowPriceVelocity:      analysis.previouslyLowPriceVelocity({ candles }),
        anomalousVolumeAndPriceIncrease: analysis.anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means })
      }
      // instead of sufficientVolume, devise a filter for pastVelocity where a
      // normalized velocity close to 0 is preferred.  Slightly positive or negative is OK, but a relatively flat velocity
      // prior to the pump is a very good sign.  Volume itself is too dynamic to filter on.  A low volume market becomes
      // a high volume market after a pump.

      if (r.anomalousVolumeAndPriceIncrease.hit && r.previouslyLowPriceVelocity.hit) {
        let r2 = await this.send(exchange, r.anomalousVolumeAndPriceIncrease.message)
      }

    } catch (e) {
      console.error(currencyPair, e)
    }

    return r
  }

  async send(channel, message) {
    let rtm = this.rtm
    let channelId = this.channels[channel].id
    return rtm.sendMessage(message, channelId)
  }
};
