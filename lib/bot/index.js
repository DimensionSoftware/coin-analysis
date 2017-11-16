const {
  RtmClient,
  CLIENT_EVENTS,
  RTM_EVENTS,
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
    this.alerts = [
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
    rtm.on(RTM_EVENTS.MESSAGE, async (message) => {
      console.log('Message', message)
      await this.handleMessage(message)
    })
    rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      console.log('Connected')
    })
    rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (start) => {
      this.channels = Lazy(start.channels).reduce((m, a) => {
        m[a.name] = a
        return m
      }, {})
    })
    return rtm.start();
  }

  async init() {
    const exchange = 'bittrex'
    return Promise.each(this.alerts, a => {
      a.init({ exchange })
    })
  }

  /**
   * React to a slack message.
   *
   * @param {SlackMessage} message
   */
  async handleMessage(message) {
    let [whole, command, rest] = message.text.match(/\s*(\w+)\s*(.*)/)
    switch (command) {
    case 'alert':
      let [currencyPair, indicator, interval, ...extra] = rest.split(/\s+/)
      let res = await this.addAlert(currencyPair, indicator, interval, extra)
      if (currencyPair && indicator && interval) {
        if (res.success) {
          this.rtm.sendMessage(`Added a ${interval} ${indicator} alert for ${currencyPair}.`, message.channel)
        } else {
          this.rtm.sendMessage(`Could not add a ${interval} ${indicator} alert for ${currencyPair}: ${res.error}`, message.channel)
        }
      } else {
        this.rtm.sendMessage(`Usage: alert <CURRENCY_PAIR> <INDICATOR> <INTERVAL>`, message.channel)
      }
      break
    default:
      if (whole.match(/^@/)) {
        this.rtm.sendMessage("Buy low, sell high.", message.channel)
      }
    }
  }

  /**
   * Add an alert
   *
   * @param {String}         currencyPair
   * @param {String}         indicator
   * @param {InfluxInterval} interval
   * @param {Array<String>}  extra
   */
  async addAlert(currencyPair, indicator, interval, extra) {
    const AlertClass = alert[indicator]
    if (!AlertClass) {
      return {
        success: false,
        error: `${indicator} is not supported.`
      }
    }
    const a = new AlertClass({ interval, currencyPair })
    const exchange = 'bittrex'
    try {
      await a.init({ exchange })
      this.alerts.push(a)
      console.log('# of alerts:', this.alerts.length)
    } catch(e) {
      console.warn(e.stack)
      return {
        success: false,
        error: e
      }
    }
    return { success: true }
  }

  async analyzeCurrencyPair(currencyPair, candle) {
    let r = {}

    try {
      const alerts = this.alerts.filter((a) => { return a && a.opts.currencyPair === currencyPair })
      alerts.forEach((a) => {
        if (a.shouldAlert(candle)) {
          this.send('#bittrex', `${currencyPair} ${a.type} ${a.opts.interval} !`)
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
