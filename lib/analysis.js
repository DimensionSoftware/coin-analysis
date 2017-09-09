const
h       = require('./helpers'),
Lazy    = require('lazy.js'),
sprintf = require('sprintf'),
macd    = require('ta-lib.macd')

const analysis = {

  /**
   * there are some coins that have too little volume to trade easily.  I might want to ignore
   * some coins in the future, and this will figure that out.
   *
   * @return {Analysis} Does this market have enough liquidity/volume for effective trading?
   */
  sufficientVolume({ marketSummary }) {
    const [result] = marketSummary.result

    if (result.MarketName.match(/^BTC/) && result.BaseVolume > 100) {
      return { hit: true }
    }

    return { hit: false }
  },

  /**
   * check if there is a positive spike in both volume and price.
   *
   * @param {Object} opts    Provide candles and means
   * @return {Analysis}      Does this market look like it's beginning a pump?
   */
  anomalousVolumeAndPriceIncrease({ exchange, currencyPair, candles, means }) {
    const [last]             = [candles]
    const candleHeight       = last.close - last.open
    const candleHeightChange = h.percentChange(means.meanCandleHeight, candleHeight)
    const baseVolumeChange   = h.percentChange(means.meanVolume.bv, last.baseVolume)

    if (candleHeight       > 0   &&
        candleHeightChange > 150 &&
        baseVolumeChange   > 200)
    {
      return {
        hit: true,
        message: `${h.urls[exchange].market(currencyPair)} - ` +
          sprintf('%0.8f -> %0.8f (%0.2f%%) - ', last.open, last.close, h.percentChange(last.open, last.close)) +
          `baseVolume ${last.baseVolume} (${sprintf('%0.2f', baseVolumeChange)}%)`
      }
    }

    return { hit: false }
  },

  /**
   * see if price velocity was relatively low before the most recent candle
   *
   * @param {Object} opts    Provide candles
   * @return {Analysis}      Did the price rise for N consecutive candles?
   */
  previouslyLowPriceVelocity({ candles }) {
    const [first, ...rest] = candles
    const prices   = rest.map((c) => c.close)
    const min      = Lazy(prices).min()
    const max      = Lazy(prices).max()
    const mean     = Lazy(prices).sum() / prices.length
    const spread   = max - min

    const percentChange = h.percentChange(mean, mean + spread)
    let hit = false
    if (percentChange < 8) {
      hit = true
    }

    return { hit, min, max, mean, spread, percentChange }
  }

}

module.exports = analysis
