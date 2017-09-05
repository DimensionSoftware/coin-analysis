const
  EventEmitter = require('events').EventEmitter,
  Influx       = require('influx'),
  bittrex      = require('node.bittrex.api'),
  rp           = require('request-promise'),
  moment       = require('moment'),
  Promise      = require('bluebird')

const influxSchema = {
  host: 'localhost',
  database: 'coins',
  schema: [
    // - Let bittrex do summarization for me.
    // - 5 minute candles give me higher accuracy but less speed than 1 minute candles
    {
      measurement: 'bittrex_market_5min',
      tags: [
        'currencyPair'
      ],
      fields: {
        open:       Influx.FieldType.FLOAT,
        close:      Influx.FieldType.FLOAT,
        high:       Influx.FieldType.FLOAT,
        low:        Influx.FieldType.FLOAT,
        volume:     Influx.FieldType.FLOAT,
        baseVolume: Influx.FieldType.FLOAT
      }
    }
  ]
}

/*
 Known Intervals:

 day
 hour
 oneMin
 fiveMin
 thirtyMin
 */

const BITTREX = {
  baseUrl: 'https://bittrex.com/api/v1.1',
  baseUrlv2: 'https://bittrex.com/Api/v2.0'
}


bittrex.options({
  inverse_callback_arguments: true
})

const getMarkets = Promise.promisify(bittrex.getmarkets)

const getLatestTick = async function(market, interval) {
  return rp({
    uri: BITTREX.baseUrlv2 + '/pub/market/GetLatestTick',
    qs: {
      marketName:   market,
      tickInterval: interval
    },
    json: true
  })
}

const getMarketSummary = async function(market) {
  return rp({
    uri: BITTREX.baseUrl + '/public/getmarketsummary',
    qs: {
      market: market
    },
    json: true
  })
}

const insertTick = async function(market, tick, influx) {
  if (!tick.success) return 0
  const { O, H, L, C, V, T, BV } = tick.result[0]
  const timestamp = moment(T).toDate()
  return influx.writePoints([
    {
      measurement: 'bittrex_market_5min',
      tags: { currencyPair: market },
      fields: {
        open:       O,
        close:      C,
        high:       H,
        low:        L,
        volume:     V,
        baseVolume: BV
      },
      timestamp
    }
  ])
}

const downloader = {
  go: null,

  delay: 250,

  start(state) {
    this.go = true
    let self = this
    setImmediate(async function(x) {
      const { influx, events } = state
      while (self.go) {
        for (let m of state.markets) {
          if (!self.go) {
            console.log('skipping ', m.MarketName)
            continue
          }
          try {
            const tick = await getLatestTick(m.MarketName, state.interval)
            const res  = await insertTick(m.MarketName, tick, influx)
            events.emit('data', m.MarketName, tick.result[0])
            const wait = await Promise.delay(self.delay)
          } catch(e) {
            console.warn(e);
          }
        }
      }
      return 0;
    })
    return 1
  },

  stop(state) {
    this.go = false
    return 0
  }
}

const rest = {

  getMarkets,

  getLatestTick,

  getMarketSummary,

  insertTick,

  downloader,

  async init() {
    const res = await getMarkets()
    const newState = {
      influx: new Influx.InfluxDB(influxSchema),
      interval: 'fiveMin',
      events: new EventEmitter()
    }
    if (res.success) {
      newState.markets = res.result
    } else {
      newState.markets = []
    }
    return newState
  },

  async start(state) {
    // loop through list of markets
    // get latest candle for each
    // insert (but beware of not inserting duplicates)
    // periodically update list of markets
    // log markets that are dropped or added

    downloader.start(state)

    const newState = {
      influx: state.influx,
      markets: state.markets,
      interval: state.interval,
      status: 'started'
    }

    return newState
  },

  async stop(state) {

    downloader.stop(state)

    const newState = {
      influx: state.influx,
      markets: state.markets,
      interval: state.interval,
      status: 'stopped'
    }

    return state
  }
}

module.exports = {
  influxSchema,
  rest
}
