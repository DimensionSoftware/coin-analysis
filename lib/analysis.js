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
   *
   * @param {Object} opts    Provide candles and means
   * @return {Analysis}      Does this market look like it's beginning a pump?
   */
  anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means }) {
    const [last]             = candles
    const candleHeight       = last.close - last.open
    const candleHeightChange = h.percentChange(means.meanCandleHeight, candleHeight)
    const baseVolumeChange   = h.percentChange(means.meanVolume.bv, last.baseVolume)

    if (candleHeight       > 0   &&
        candleHeightChange > 70  &&
        baseVolumeChange   > 88)
    {
      const message = outdent `
      ${currencyPair} ${h.sBTC(last.open)} -> ${h.sBTC(last.close)} (+${sprintf('%0.2f', candleHeightChange)}%), baseVolume ${sprintf('%0.2f', last.baseVolume)} (+${sprintf('%0.2f', baseVolumeChange)}%)
      ${h.urls[exchange].market(currencyPair)}
      `

      return {
        hit: true,
        candleHeight,
        candleHeightChange,
        baseVolumeChange,
        message
      }
    }

    return {
      hit: false,
      candleHeight,
      candleHeightChange,
      baseVolumeChange
    }
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
