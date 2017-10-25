const
h       = require('./helpers'),
Promise = require('bluebird'),
Lazy    = require('lazy.js'),
sprintf = require('sprintf'),
outdent = require('outdent'),
talib   = require('talib')
ti      = require('technicalindicators')

const talibExecute = Promise.promisify(talib.execute)

const analysis = {

  /**
   * there are some coins that have too little volume to trade easily.  I might want to ignore
   * some coins in the future, and this will figure that out.
   *
   * @return {Analysis} Does this market have enough liquidity/volume for effective trading?
   */
  sufficientVolume({ marketSummary }) {
    const [result] = marketSummary.result

    if (result.MarketName.match(/^BTC/) && result.BaseVolume > 9) {
      return { hit: true, baseVolume: result.BaseVolume }
    }

    return { hit: false, baseVolume: result.BaseVolume }
  },

  /**
   * check if there is a positive spike in both volume and price.
   * In addition to spikes, allow constant upward movement to count too.
   * Not all pumps have price spikes.
   *
   * @param {Object} opts    Provide candles and means
   * @return {Analysis}      Does this market look like it's beginning a pump?
   */
  anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means }) {
    const [last]             = candles
    const candleHeight       = last.close - last.open
    const candleHeightChange = h.percentChange(means.meanCandleHeight, candleHeight)
    const baseVolumeChange   = h.percentChange(means.meanVolume.bv, last.baseVolume)
    const recentPrices       = candles.slice(1, 6).map((c) => c.close)

    const increasing         = recentPrices.reduce((m, a) => {
      if (m.prev > a) {
        m.count += 1;
      }
      m.prev = a

      return m
    }, { prev: recentPrices[0], count: 0 })

    const increasingPrices   = {
      hit: increasing.count >= recentPrices.length - 2,
      ratio: [
        increasing.count,
        recentPrices.length
      ]
    }

    if (candleHeight        > 0  &&
        (candleHeightChange > 70 || increasingPrices.hit) &&
        baseVolumeChange    > 88)
    {
      const message = outdent`
      ${currencyPair} ${h.sBTC(last.open)} -> ${h.sBTC(last.close)} _(_+*${sprintf('%0.2f', h.percentChange(last.open, last.close))}*%_)_, baseVolume ${sprintf('%0.2f', last.baseVolume)} _(_+*${sprintf('%0.2f', baseVolumeChange)}*%_)_
      ${h.urls[exchange].market(currencyPair)}
      `

      return {
        hit: true,
        candleHeight,
        candleHeightChange,
        baseVolumeChange,
        increasingPrices,
        message
      }
    }

    return {
      hit: false,
      candleHeight,
      candleHeightChange,
      baseVolumeChange,
      increasingPrices
    }
  },

  /**
   * see if volume velocity is within standard deviation of hardcoded "normal"
   *
   * @param {Array} deviations    Standard deviations (from influxdb)
   * @return {Analysis}           Did the volume change beyond standard deviation
   */
  previouslyLowVolume(deviations) {
    const
      last = deviations[deviations.length - 1],
      rest = deviations.slice(0, deviations.length - 1)
    const
      stddevs = Lazy(rest).filter((n) => n.stddev).map((n) => n.stddev).value(),
      mean    = Lazy(stddevs).sum() / stddevs.length

    let hit = false
    if (mean < 0.4) { hit = true }

    return { hit, last, mean, stddevs }
  },

  /**
   * see if price velocity was relatively low before the most recent candle
   *
   * @param {Object} opts    Provide candles
   * @return {Analysis}      Did the price rise for N consecutive candles?
   */
  previouslyLowPriceVelocity({ candles }) {
    const [first, ...rest] = candles
    const prices   = rest.map((c) => c.close),
          min      = Lazy(prices).min(),
          max      = Lazy(prices).max(),
          mean     = Lazy(prices).sum() / prices.length,
          spread   = max - min

    const percentChange = h.percentChange(mean, mean + spread)
    let hit = false
    if (percentChange < 15) {
      hit = true
    }

    return { hit, min, max, mean, spread, percentChange }
  },

  /**
   * flatten out database results into the format that talib wants.
   *
   * @param  {Array<Object>} results     an array of candle data.
   * @param  {String}        study       name of study (ie. 'MACD' or 'RSI')
   * @param  {Object}        conversion  a map to convert old key to new key
   * @return {Object}                    this object has open, close, high, low, and volume in arrays
   */
  prepareForTalib(results, study, conversion = { close: 'inReal' }) {
    const initial = Lazy(conversion).values().reduce((m, a) => {
      m[a] = []

      return m
    }, {})
    const keys = Lazy(conversion).keys().value()

    const defaults = talib.explain(study).optInputs.reduce((m, a) => { m[a.name] = a.defaultValue; return m }, {})
    defaults.name = study

    const params = Lazy(results).reduce((m, a) => {
      keys.forEach((k) => {
        m[conversion[k]].push(a[k])
      })

      return m
    }, initial)

    params.startIdx = 0
    params.endIdx   = results.length - 1

    return Lazy(defaults).merge(params).value()
  },

  /**
   * detect whether a MACD cross up happpened
   *
   * @param {Object}        opts           Options
   * @param {Array<Object>} opts.candles   An array of candles where close price is required
   * @param {Boolean}       opts.below     If true, check if a cross up happened below the center line
   * @param {Boolean}       opts.above     If true, check if a cross up happened above the center line
   * @returns {Analysis} Did a MACD cross up happen?
   */
  async macdCrossUp({ candles, below, above }) {
    let r = { hit: false }
    if (candles.length === 0) {
      return r
    }

    let opts  = analysis.prepareForTalib(candles, 'MACD')
    let ta    = await talibExecute(opts)
    let [macd, signal, hist] = [ta.result.outMACD, ta.result.outMACDSignal, ta.result.outMACDHist]
    let i = macd.length - 1

    if (below) {
      if (macd[i] < 0 && signal[i] < 0) {
        if (signal[i-1] > macd[i-1] && signal[i] < macd[i]) {
          r.hit = true
        }
      }
    }

    if (above) {
      if (macd[i] >= 0 && signal[i] >= 0) {
        if (signal[i-1] > macd[i-1] && signal[i] < macd[i]) {
          r.hit = true
        }
      }
    }

    return r
  },

  /*

   let x = {}
   let past = moment('2017-10-10T00:30:00-07').subtract(65, 'hours')
   db.bittrex.summarizePrice('BTC-ARK', '30min', past).then((r) => x.r = r)

   let opts = analysis.prepareForTalib(x.r, 'MACD')
   talib.execute(opts, (err, m) => x.m = m)

   x.m.begIndex
   x.m.result.outMACD.length
   x.r.length

   analysis.macdReport(x.r).then(cl)
   analysis.macdCrossUp({ candles: x.r, below: true, above: false }).then((ta) => x.ta = ta)

   */

  /**
   * macdReport - Return a list of significant MACD events within the given candles.
   *
   * @param {Array<Object>} candles
   * @returns {}
   */
  async macdReport(candles) {
    if (candles.length === 0) {
      return []
    }
    let opts   = analysis.prepareForTalib(candles, 'MACD')
    let ta     = await talibExecute(opts)
    let data   = Lazy(candles)
      .drop(ta.begIndex)
      .map((c) => helpers.influxTime(c.time))
      .zip(ta.result.outMACD, ta.result.outMACDSignal)
      .value()

    //  0     1     2
    // [time, macd, signal]

    // check for center line crosses
    let crossConstant = h.crossConstantFn(h.crossState(data[0][1], 0), 0)

    // check for macd crosses
    let crossPair = h.crossPairFn(h.crossState(data[0][1], data[0][2]))

    let r = data.reduce((m, [time, macd, signal]) => {
      let centerState = crossConstant([macd])
      let macdState = crossPair([[macd, signal]])
      if (centerState.match(/^cross/)) {
        m.push([time, 'center', centerState])
      }
      if (macdState.match(/^cross/)) {
        m.push([time, 'macd', macdState])
      }
      return m
    }, [])

    return r
  }

}

module.exports = analysis
