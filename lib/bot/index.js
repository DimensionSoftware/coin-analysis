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
  alert    = require('../alert'),
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
      this.events.on('data', (currencyPair, candle) => {
        this.analyzeCurrencyPair(currencyPair, candle)
      })
    }
    this.lastCandles = Map({})
    this.indicators = [
      new alert.RSI({currencyPair: 'BTC-ARK', interval: '1h', limit: 70}),
      new alert.RSI({currencyPair: 'BTC-ARK', interval: '30m', limit: 70}),
    ]
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

  async init() {
    const exchange = 'bittrex'
    return Promise.each(this.indicators, i => {
      i.init({ exchange })
    })
  }

  async analyzeCurrencyPair(currencyPair, candle) {
    try {
      Promise.each(this.indicators, i => {
        const cp = i.opts.currencyPair
        if (currencyPair === cp) {
          i.shouldAlert(candle).then(should => {
            if (should)
              this.send('#bittrex', `${cp} crossed ${i.opts.interval} at ${i.opts.limit}`)
          })
        }
      })
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
