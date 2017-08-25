const
  Influx  = require('influx'),
  bittrex = require('node.bittrex.api'),
  rp      = require('request-promise'),
  Promise = require('bluebird')

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
        open: Influx.FieldType.FLOAT,
        close: Influx.FieldType.FLOAT,
        high: Influx.FieldType.FLOAT,
        low: Influx.FieldType.FLOAT,
        volume: Influx.FieldType.FLOAT,
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
      marketName: market,
      tickInterval: interval
    },
    json: true
  })
}

const insertTick = async function(market, tick, influx) {
  if (!tick.success) return 0
  const { O, H, L, C, V, T, BV } = tick.result[0]
  influx.writePoints([
    {
      measurement: 'bittrex_market_5min',
      tags: { currencyPair: market },
      fields: {
        open: O,
        close: C,
        high: H,
        low: L,
        volume: V,
        baseVolume: BV,
        timestamp: T
      }
    }
  ])
}

const downloader = {
  go: null,

  delay: 250,

  timeStamps: {},

  start(state) {
    this.go = true
    let self = this
    return (async function(x) {
      const { influx } = state
      while (self.go) {
        state.markets.forEach(async (m) => {
          const tick = await getLatestTick(m.name, state.interval)
          if (self.timeStamps[m.name] !== tick.result[0].T) {
            const res = await insertTick(m.name, tick, influx)
            self.timeStamps[m.name] = tick.result[0].T
          }
          const wait = await Promise.delay(this.delay)
        })
      }
      return 0;
    })()
  },

  stop(state) {
    this.go = false
    return 0
  }
}

const rest = {

  getMarkets,

  getLatestTick,

  insertTick,

  downloader,

  async init() {
    const newState = {
      influx: new Influx.InfluxDB(influxSchema),
      markets: await getMarkets(),
      interval: 'fiveMin'
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
