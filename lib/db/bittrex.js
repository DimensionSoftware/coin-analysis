const DB = require('./base')
const
  Influx   = require('influx'),
  Lazy     = require('lazy.js'),
  string   = Influx.escape.stringLit,
  outdent  = require('outdent'),
  moment   = require('moment'),
  h        = require('../helpers'),
  ex       = require('../ex')

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

  /**
  * Backfill as much missing data as we can for a given currencyPair.
  * Previously, I had assumed that I could download any candle from the past that I wanted.
  * This does not seem to be true.  The only other way to get candles is to download a big
  * batch of them via GetTicks.  For 5 minute candles, it seems to go back 20 days, so that
  * puts a hard limit on how much missing data I can fill in.
  *
  * @param  {Object}   opts
  * @param  {String}   opts.currencyPair
  * @param  {Function} opts.logger
  * @return {Object}   an object describing the updates performed by this method
  */
  async backfill(opts) {
    let influx       = this.influx
    let measurement  = this.measurement('market', '5min')
    let currencyPair = opts.currencyPair
    let logger       = opts.logger
    let end = {
      currencyPair,
      candles: 0,
      backfilled: 0
    }
    let res = await ex.bittrex.rest.getCandles({ marketname: currencyPair, tickInterval: 'fiveMin' })
    if (!res.success) {
      end.error = res.message
      return end
    }

    let candles = res.result

    for (let i = 0; i < candles.length; i++) {
      let c          = candles[i]
      let nextTime   = c.T
      let sqlCurrent = outdent`
        SELECT time, close
          FROM ${measurement}
        WHERE currencyPair = ${string(currencyPair)}
          AND time = ${string(h.influxTime(nextTime))}
      `
      let nextRow = await influx.query(sqlCurrent)
      if (nextRow.length == 0) {
        let row = {
          open:       c.O,
          close:      c.C,
          high:       c.H,
          low:        c.L,
          volume:     c.V,
          baseVolume: c.BV,
          time:       c.T
        }
        await this.insertPrice(currencyPair, row)
        end.backfilled++
        if (logger) {
          logger({ time: row.T, backfilled: true, currencyPair, row })
        }
      } else {
        if (logger) {
          logger({ time: nextTime, backfilled: false, currencyPair })
        }
      }
    }

    end.candles = candles.length
    return end
  }

}

module.exports = Bittrex
