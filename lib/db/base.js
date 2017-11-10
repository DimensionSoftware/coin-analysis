const
  Influx  = require('influx'),
  moment  = require('moment'),
  Promise = require('bluebird'),
  Lazy    = require('lazy.js'),
  outdent = require('outdent'),
  h       = require('../helpers'),
  string  = Influx.escape.stringLit

// TODO - Instead of having a translation, just use InfluxDB's naming standards so translation is unnecessary.
const INTERVALS = {
  '5min':  '5m',
  '30min': '30m',
  '1hour': '1h',
  '1day':  '1d'
}

class DB {

  constructor({schema, base}) {
    this.schema = schema
    this.base   = base
    this.influx = new Influx.InfluxDB(schema)
  }

  influxInterval(interval) {
    if (INTERVALS[interval]) {
      return INTERVALS[interval]
    } else {
      throw(new Error(`unknown interval ${interval}`))
    }
  }

  measurement(type, interval) {
    return `${this.base}_${type}_${interval}`
  }

  async insertPrice(market, values) {
    const measurement = this.measurement('market', '5min')
    const { open, close, high, low, volume, baseVolume, time } = values
    const timestamp = moment(time).toDate()

    return this.influx.writePoints([
      {
        measurement,
        tags: { currencyPair: market },
        fields: {
          open,
          close,
          high,
          low,
          volume,
          baseVolume
        },
        timestamp
      }
    ])
  }

  async summarizePrices(market, interval, from, to) {
    const
      measurement    = this.measurement('market', '5min')

    const sql = `
    SELECT first(open) AS open,
           last(close) AS close,
           min(low)    AS low,
           max(high)   AS high
      FROM ${measurement}
     WHERE currencyPair = ${string(market)}
       AND time >= ${string(h.influxTime(from))}
     GROUP BY time(${interval})
     ORDER BY time`

    return this.influx.query(sql)
  }

  /**
   * Return prices from the given date forward
   *
   * @param {String} market
   * @param {Moment} from
   * @param {Moment} to
   * @returns {Promise<Array>}
   */
  async prices(market, from, to) {
    const measurement = this.measurement('market', '5min')
    const sql = outdent`
    SELECT time, open, close, low, high
      FROM ${measurement}
     WHERE currencyPair = ${string(market)}
       AND time >= ${string(h.influxTime(from))}
       AND time <= ${string(h.influxTime(to))}
     ORDER BY time
    `
    return this.influx.query(sql)
  }

}


module.exports = DB
