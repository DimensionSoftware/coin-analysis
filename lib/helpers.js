const sprintf = require('sprintf')
const moment  = require('moment')

/**
 * given two numbers, a and b, return the percent change from a to b.
 *
 * @param  {Number}  a    The first number
 * @param  {Number}  b    The second number
 * @return {Number}       The percentage change from a to b
 */
function percentChange(a, b) {
  let d      = 0
  let change = 0

  if (a < b) {
    d      = b - a
    change = d / a * 100
  }
  else {
    d      = a - b
    change = d / a * -100
  }

  return change
}

/**
 * given a number, return a multiplier that is a power of 10 that will make the number >= 1.
 * If the number is already >= 1, return 1
 *
 * @param  {Number} n     A number
 * @return {Number}       A multiple of 10 that can be multiplied by n to make it >= 1
 */
function zoomFactor(n) {
  let factor = 1
  let m = n * factor
  while (m < 1) {
    factor *= 10
    m = n * factor
  }

  return factor
}

/**
 * given a number, format it with 8 decimal places
 *
 * @param  {Number} n    a bitcoin value
 * @return {String}      a formatted bitcoin value
 */
function sBTC(n) {
  return sprintf('%0.8f', n)
}

/**
 * return a string representing a date in a format that InfluxDB can understand
 *
 * @param {String} t     a string in a format that moment.js can understand
 * @returns {String}     a date string in a format that InfluxDB can understand
 */
function influxTime(t) {
  return moment(t).utc().format()
}

/**
 * flatten out database results into the format that talib wants.
 *
 * @param  {Array<Object>} results     an array of candle data.
 * @param  {Object}        conversion  a map to convert old key to new key
 * @return {Object}                    this object has open, close, high, low, and volume in arrays
 */
function prepareForTalib(results, conversion = { close: 'inReal' }) {
  const initial = Lazy(conversion).values().reduce((m, a) => {
    m[a] = []

    return m
  }, {})
  const keys = Lazy(conversion).keys().value()

  const params = Lazy(results).reduce((m, a) => {
    keys.forEach((k) => {
      m[conversion[k]].push(a[k])
    })

    return m
  }, initial)

  params.startIdx = 0
  params.endIdx   = results.length - 1

  return params
}

const urls = {

  bittrex: {
    market(currencyPair) {
      return `https://bittrex.com/Market/Index?MarketName=${currencyPair}`
    }
  },

  poloniex: {
    market(currencyPair) {
      return `https://poloniex.com/exchange#${currencyPair.toLowerCase().replace(/-/, '_')}`
    }
  }

}

module.exports = {
  percentChange,
  zoomFactor,
  sBTC,
  influxTime,
  prepareForTalib,
  urls
}
