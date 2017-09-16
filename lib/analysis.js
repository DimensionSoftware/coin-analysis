const
h       = require('./helpers'),
Lazy    = require('lazy.js'),
sprintf = require('sprintf'),
outdent = require('outdent')

const analysis = {

  /**
   * there are some coins that have too little volume to trade easily.  I might want to ignore
   * some coins in the future, and this will figure that out.
   *
   * @return {Analysis} Does this market have enough liquidity/volume for effective trading?
   */
  sufficientVolume({ marketSummary }) {
    const [result] = marketSummary.result

    if (result.MarketName.match(/^BTC/) && result.BaseVolume > 50) {
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
      ${currencyPair} ${h.sBTC(last.open)} -> ${h.sBTC(last.close)} (+${sprintf('%0.2f', h.percentChange(last.open, last.close))}%), baseVolume ${sprintf('%0.2f', last.baseVolume)} (+${sprintf('%0.2f', baseVolumeChange)}%)
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
      stddevs = Lazy(rest).filter((n) => n),
      mean    = Lazy(stddevs).sum() / stddevs.length

    let hit = false
    if (last.stddev > 0.9 && mean < 0.4) hit = true

    return { hit, last, mean }
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
  }

}

module.exports = analysis
