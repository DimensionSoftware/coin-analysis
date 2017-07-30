
const
  autobahn = require('autobahn'),
  moment   = require('moment'),
  Influx   = require('influx'),
  Koa      = require('koa'),
  Poloniex = require('poloniex-api-node')

const influxSchema = {
  host: 'localhost',
  database: 'coins',
  schema: [
    {
      measurement: 'poloniex_ticker',
      tags: [
        'currencyPair'
      ],
      fields: {
        last: Influx.FieldType.FLOAT,
        lowestAsk: Influx.FieldType.FLOAT,
        highestBid: Influx.FieldType.FLOAT,
        percentChange: Influx.FieldType.FLOAT,
        baseVolume: Influx.FieldType.FLOAT,
        quoteVolume: Influx.FieldType.FLOAT,
        isFrozen: Influx.FieldType.INTEGER
      }
    },
    {
      measurement: 'poloniex_trade',
      tags: [
        'currencyPair',
        'type'
      ],
      fields: {
        amount: Influx.FieldType.FLOAT,
        date: Influx.FieldType.INTEGER,
        rate: Influx.FieldType.FLOAT,
        total: Influx.FieldType.FLOAT,
        tradeID: Influx.FieldType.INTEGER,
        type: Influx.FieldType.STRING
      }
    },
    {
      measurement: 'poloniex_order',
      tags: [
        'currencyPair',
        'type',
        'op'
      ],
      fields: {
        rate: Influx.FieldType.FLOAT,
        amount: Influx.FieldType.FLoAT
      }
    }
  ]
}

// main
// ---------
const
  cx       = new autobahn.Connection({ url: "wss://api.poloniex.com", realm: "realm1" }),
  koa      = new Koa(),
  influx   = new Influx.InfluxDB(influxSchema),
  poloniex = new Poloniex()

influx.createDatabase('coins')

// cx.onopen = function(s) { s.subscribe('ticker', function(market, ev) { console.log(market) }) };
cx.onopen = function(s) {
  getAllMarkets().then((markets) => {
    markets.forEach((currencyPair) => {
      const recordOrders = recordOrdersFn(currencyPair)
      s.subscribe(currencyPair, recordOrders)
    })
  })
  s.subscribe('ticker', record)
}
cx.open()
console.log('Streaming...')

function getAllMarkets() {
  return poloniex.returnTicker().then((ticker) => Object.keys(ticker))
}

function recordOrdersFn(currencyPair) {
  return function (orders) {
    console.log(currencyPair, orders);
    orders.forEach((order) => {
      const { data } = order
      switch (order.type) {
      case 'newTrade':
        influx.writePoints([
          {
            measurement: 'poloniex_trade',
            tags: {
              currencyPair: currencyPair,
              type: data.type
            },
            fields: {
              amount: data.amount,
              date: moment(data.date).unix(),
              rate: data.rate,
              total: data.total,
              tradeID: data.tradeID
            }
          }
        ])
        break;
      case 'orderBookModify':
      case 'orderBookRemove':
        influx.writePoints([
          {
            measurement: 'poloniex_order',
            tags: {
              currencyPair: currencyPair,
              type: data.type,
              op: order.type
            },
            fields: {
              amount: data.amount,
              rate: data.rate
            }
          }
        ])
        break;
      default:
        break;
      }
    })
  }
}


function record(ticker, ev) {
  var f = {
    last:          parseFloat(ticker[1]),
    lowestAsk:     parseFloat(ticker[2]),
    highestBid:    parseFloat(ticker[3]),
    percentChange: parseFloat(ticker[4]),
    baseVolume:    parseFloat(ticker[5]),
    quoteVolume:   parseFloat(ticker[6]),
    isFrozen:      ticker[7]
  }
  console.log(ticker[0], f);
  influx.writePoints([
    {
      measurement: 'poloniex_ticker',
      tags: { currencyPair: ticker[0] },
      fields: f
    }
  ]).catch((err) => console.log(err));
}
