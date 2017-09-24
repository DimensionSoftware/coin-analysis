const DB = require('./db')
const
  Influx = require('influx')

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
    },
    {
      measurement: 'bittrex_rsi_5min',
      tags: [
        'currencyPair'
      ],
      fields: { rsi: Influx.FieldType.FLOAT }
    },
    {
      measurement: 'bittrex_macd_30min',
      tags: [
        'currencyPair'
      ],
      fields: {
        macd:      Influx.FieldType.FLOAT,
        signal:    Influx.FieldType.FLOAT,
        histogram: Influx.FieldType.FLOAT
      }
    }
  ]
}

class Bittrex extends DB {
  constructor() {
    super({ schema: influxSchema, base: 'bittrex' })
  }
}

module.exports = Bittrex
