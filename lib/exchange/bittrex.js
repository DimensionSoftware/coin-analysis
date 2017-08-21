const
  Influx  = require('influx'),
  bittrex = require('node.bittrex.api'),
  rp      = require('request-promise')

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
        baseVolume: Influx.FieldType.FLOAT
      }
    }
  ]
}

const rest = {
  init() {
    const newState = {
      markets: [],
      interval: '5min'
    }

    return newState
  },

  start(state) {
    // loop through list of markets
    // get latest candle for each
    // insert (but beware of not inserting duplicates)
    // periodically update list of markets
    // log markets that are dropped or added

    return state
  },

  stop(state) {

    return state
  }
}

module.exports = {
  influxSchema,
  rest
}
