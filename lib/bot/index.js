const {
  RtmClient,
  CLIENT_EVENTS,
  MemoryDataStore
} = require('@slack/client')

const { Map } = require('immutable')

const
  Promise  = require('bluebird'),
  Lazy     = require('lazy.js'),
  Influx   = require('influx'),
  moment   = require('moment'),
  winston  = require('winston'),
  h        = require('../helpers'),
  analysis = require('../analysis'),
  ex       = require('../ex'),
  db       = require('../db'),
  string   = Influx.escape.stringLit

// Remember: 12 5min candles to an hour
const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 24

/*
 A lot of this can probably be done in Kapacitor, but this is the
 easiest thing for me to implement right now.  Once I buy myself some time,
 I'll learn how to use kapacitor to do this.
 */

module.exports = class Bot {
  constructor(opts={}) {
    this.token  = opts.token
    if (opts.events) {
      this.events = opts.events
      this.events.on('data', (currencyPair) => {
        this.analyzeCurrencyPair(currencyPair)
      })
    }
    this.lastCandles = Map({})
  }

  /**
   * Connect to Slack
   *
   * @param  {String} token  authentication string
   * @return {Promise}       result of auth
   */
  async connect() {
    if (!this.token) {
      console.warn('The bot-token for Slack was not provided.')
      return 0
    }
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

  async analyzeCurrencyPair(currencyPair, opts={}) {
    let r = {}

    try {
      // load recent candles
      let options = Lazy({ limit: DEFAULT_LIMIT }).merge(opts).value()
      let candles = await db.bittrex.loadRecentCandles(currencyPair, options)
      if (candles.length === 0) return r // guard

      // if we've already analyzed this tick, don't post to slack again.
      // else, record the latest tick in this.lastCandles and analyze further.
      let [current]     = candles
      let currentCandle = Map(current)
      let lastSeen      = this.lastCandles.get(currencyPair)
      if (!opts.force) {
        if (lastSeen && lastSeen.equals(currentCandle)) {
          return { currencyPair, alreadySeen: true }
        }
        else {
          this.lastCandles = this.lastCandles.set(currencyPair, currentCandle)
        }
      }

      // load mean volume and mean positive candle height (or mean absolute candle height?)
      const
        exchange      = 'bittrex',
        means         = await db.bittrex.loadMeanValues(currencyPair, options),
        marketSummary = await ex.bittrex.rest.getMarketSummary(currencyPair),
        deviations    = await db.bittrex.loadStdDev(currencyPair, options)

      // compare last candle height to the mean
      // send buy signal
      // - if volume and price go up significantly together
      // - if price goes significantly up together
      r = {
        previouslyLowVolume:             analysis.previouslyLowVolume(deviations),
        sufficientVolume:                analysis.sufficientVolume({ marketSummary }),
        anomalousVolumeAndPriceIncrease: analysis.anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means })
      }

      // instead of sufficientVolume, devise a filter for pastVelocity where a
      // normalized velocity close to 0 is preferred. Slightly positive or
      // negative is OK, but a relatively flat velocity prior to the pump is a
      // very good sign. Volume itself is too dynamic to filter on. A low volume
      // market becomes a high volume market after a pump.
      if (r.anomalousVolumeAndPriceIncrease.hit
          && r.previouslyLowVolume.hit
          && r.sufficientVolume.hit) {
        let r2 = await this.send(exchange, r.anomalousVolumeAndPriceIncrease.message)
      }

      // 30min MACD cross up analysis
      // 1day  MACD would be nice to have
      const currentMinute = currentCandle.get('time').getMinutes()
      if (currentMinute === 30 || currentMinute === 0) {
        const
          past       = moment(currentCandle.time).subtract(2, 'days'),
          candles30m = await db.bittrex.summarizePrice(currencyPair, '30min', { from: past }),
          macd       = await analysis.macdCrossUp({ candles: candles30m, below: true, above: false })

        r.macd = macd
        if (macd.hit) {
          let message = `${currencyPair} 30min MACD cross up`
          let r3 = await this.send(exchange, message)
        }
      }
    } catch (e) {
      console.error(currencyPair, e)
    }

    return r
  }

  async send(channel, message) {
    let rtm = this.rtm
    if (rtm) {
      let channelId = this.channels[channel].id
      return rtm.sendMessage(message, channelId)
    } else {
      console.log(channel, message)
      return message
    }
  }
};
