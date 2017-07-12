
const
  autobahn = require('autobahn'),
  moment   = require('moment'),
  Influx   = require('influx'),
  Koa      = require('koa')

// main
// ---------
const
  cx  = new autobahn.Connection({ url: "wss://api.poloniex.com", realm: "realm1" }),
  koa = new Koa()

const influxSchema = {
  host: 'localhost',
  database: 'coins',
  schema: [
    {
      measurement: 'poloniex_ticker',
      fields: {
        'currencyPair': Influx.FieldType.STRING,
        'last': Influx.FieldType.FLOAT,
        'lowestAsk': Influx.FieldType.FLOAT,
        'highestBid': Influx.FieldType.FLOAT,
        'percentChange': Influx.FieldType.FLOAT,
        'baseVolume': Influx.FieldType.FLOAT,
        'quoteVolume': Influx.FieldType.FLOAT,
        'isFrozen': Influx.FieldType.INTEGER
      },
      tags: [
        'exchange'
      ]
    }
  ]
}

const influx = new Influx.InfluxDB(influxSchema)

influx.createDatabase('coins')

// cx.onopen = function(s) { s.subscribe('ticker', function(market, ev) { console.log(market) }) };
cx.onopen = function(s) { s.subscribe('ticker', record) }
cx.open()
console.log('Streaming...')

function record(ticker, ev) {
  var f = {
    currencyPair:  ticker[0],
    last:          parseFloat(ticker[1]),
    lowestAsk:     parseFloat(ticker[2]),
    highestBid:    parseFloat(ticker[3]),
    percentChange: parseFloat(ticker[4]),
    baseVolume:    parseFloat(ticker[5]),
    quoteVolume:   parseFloat(ticker[6]),
    isFrozen:      ticker[7]
  }
  console.log(f);
  influx.writePoint([
    {
      measurement: 'poloniex_ticker',
      tags: { exchange: 'poloniex' },
      fields: {
        currencyPair:  ticker[0],
        last:          parseFloat(ticker[1]),
        lowestAsk:     parseFloat(ticker[2]),
        highestBid:    parseFloat(ticker[3]),
        percentChange: parseFloat(ticker[4]),
        baseVolume:    parseFloat(ticker[5]),
        quoteVolume:   parseFloat(ticker[6]),
        isFrozen:      ticker[7]
      }
    }
  ]).catch((err) => console.log(err));
}
