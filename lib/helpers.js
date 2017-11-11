const
Lazy    = require('lazy.js'),
sprintf = require('sprintf'),
moment  = require('moment'),
fsm     = require('./fsm')


/**
 * given interval is the time at a boundary
 * @param {Interval} interval - InfluxDB duration notation, eg. 1m, 5m, 1d
 * @param {Moment} time - A time
 */
function isIntervalBoundry(interval, time) {
  const [_, number, unit] = interval.match(/(\d+)(\w+)/)
  const n = parseInt(number)
  switch(unit) {
  case 'm':
    if (time.minute() % n === 0) return true
    break
  case 'h':
    if (time.hour() % n === 0 && time.minute() === 0)
      return true
    break
  case 'd':
    if (time.minute() === 0 && time.hour() === 0 && time.dayOfYear() % n === 0)
      return true
    break
  }
  return false
}

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
 * Increase a number by a percentage
 *
 * @param   {Number} a         The initial number
 * @param   {Number} percent   Increase by this percentage
 * @returns {Number}           The initial number a with the percentage added to it
 */
function percentAdd(a, percent) {
  return a + (a * percent * 0.01)
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
 * breakEven - return the price you need to sell at to profit taking fees into account.
 *
 * @param  {Number} price     price asset was purchased at
 * @param  {Number} fee       exchange's trading fee percentage
 * @return {Number} the price you need to sell at to break even.
 */
function breakEven(price, fee = 0.0025) {
  /*
    bought  140.78483843 at 0.00707803 cost 0.996479309953 + purchaseFee = 0.99897180 BTC
                                                             0.0024911982748800
    sold    140.78483843 at 0.00709997 cost 0.999568129308 - sellingFee  = 0.99707063 BTC
                                                             0.0024989203232700

     costToBeat = price * amount + (price * amount * fee)
     costToBeat = p2    * amount - (p2    * amount * fee)
     costToBeat = p2 * (amount - amount * fee)
                ⇆
             p2 = costToBeat / (amount - amount * fee)
   */
  const amount     = 1
  const costToBeat = (price * amount) + (price * amount * fee)
  const p2         = costToBeat / (amount - amount * fee)

  return p2
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

/* This is a state machine for detecting line crosses. */
const cross = {
  machine: {
    above: {
      lt: 'crossBelow',
      gte: 'above'
    },
    crossAbove: {
      lt: 'crossBelow',
      gte: 'above'
    },
    below: {
      lt: 'below',
      gte: 'crossAbove'
    },
    crossBelow: {
      lt: 'below',
      gte: 'crossAbove'
    }
  },

  transformPair: (pair) => {
    if (pair[0] >= pair[1]) {
      return 'gte'
    } else {
      return 'lt'
    }
  },

  transformConstantFn: (constant) => {
    return (input) => {
      if (input >= constant) {
        return 'gte'
      } else {
        return 'lt'
      }
    }
  }
}

/**
 * Create a function that detects line crosses
 *
 * @param   {String}   initialState
 * @returns {Function} a function that takes an array of arrays (which are number pairs) and returns a state
 */
function crossPairFn(initialState) {
  return fsm.init(cross.machine, initialState, cross.transformPair)
}

/**
 * Create a function that detects line crosses against a constant (horizontal) line
 *
 * @param   {String}   initialState
 * @param   {Number}   constant
 * @returns {Function} a function that takes an array of numbers and returns a state
 */
function crossConstantFn(initialState, constant) {
  return fsm.init(cross.machine, initialState, cross.transformConstantFn(constant))
}

/**
 * Return the initial state for cross detection functions.
 * The state will be either 'above' or 'below'.
 *
 * @param   {Number} a
 * @param   {Number} b
 * @returns {String} 'above' or 'below'
 */
function crossState(a, b) {
  if (a >= b) {
    return 'above'
  } else {
    return 'below'
  }
}

module.exports = {
  isIntervalBoundry,
  percentChange,
  percentAdd,
  zoomFactor,
  sBTC,
  influxTime,
  breakEven,
  urls,
  cross,
  crossPairFn,
  crossConstantFn,
  crossState
}
