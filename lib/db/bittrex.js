const DB = require('./db')
const
  Influx   = require('influx'),
  Lazy     = require('lazy.js'),
  string   = Influx.escape.stringLit,
  moment   = require('moment'),
  h        = require('../helpers')

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

  async loadStdDev(currencyPair, opt) {
    const lastTime = opt.from ? moment(opt.from) : moment()
    const sql = `
      SELECT STDDEV("${opt['field'] || 'baseVolume'}")
      FROM bittrex_market_5min
      WHERE currencyPair=${string(currencyPair)}
      AND time >= ${string(h.influxTime(lastTime.clone().subtract(4, 'hours')))}
      AND time <= ${string(h.influxTime(lastTime))}
      GROUP BY TIME(10m)
    `
    return await this.influx.query(sql)
  }

  async loadRecentCandles(currencyPair, opt) {
    const sql = `
    SELECT *
    FROM bittrex_market_5min
    WHERE currencyPair = ${string(currencyPair)}
      AND time <= ${opt.from ? string(h.influxTime(opt.from)) : 'NOW()'}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `
    return await this.influx.query(sql)
  }

  async loadMeanValues(currencyPair, opt) {
    let meanVolumeSQL = `
    SELECT
      MEAN(baseVolume) AS bv,
      MEAN(volume)     AS v
    FROM bittrex_market_5min
    WHERE currencyPair = ${string(currencyPair)}
      AND time <= ${opt.from ? string(h.influxTime(opt.from)) : 'NOW()'}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `
    let meanVolume = this.influx.query(meanVolumeSQL)

    let candleHeightsSQL = `
    SELECT close - open AS diff
    FROM bittrex_market_5min
    WHERE currencyPair = ${string(currencyPair)}
      AND time <= ${opt.from ? string(h.influxTime(opt.from)) : 'NOW()'}
    ORDER BY time DESC
    LIMIT ${opt.limit}
    `
    let candleHeights = this.influx.query(candleHeightsSQL)

    let results = await Promise.all([meanVolume, candleHeights])

    return {
      meanVolume:       results[0][0],
      meanCandleHeight: Lazy(results[1]).map((height) => { return Math.abs(height.diff) }).sum() / results[1].length
    }
  }
}

module.exports = Bittrex
