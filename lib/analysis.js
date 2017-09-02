const
h       = require('./helpers'),
Lazy    = require('lazy.js'),
sprintf = require('sprintf')

const analysis = {

  /**
   * there are some coins that have too little volume to trade easily.  I might want to ignore
   * some coins in the future, and this will figure that out.
   *
   * @return {Analysis} Does this market have enough liquidity/volume for effective trading?
   */
  sufficientVolume({ marketSummary }) {
    const [result] = marketSummary.result

    if (result.MarketName.match(/^BTC/) && result.BaseVolume > 160) {
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
    const [last]             = candles
    const candleHeight       = last.close - last.open
    const candleHeightChange = h.percentChange(means.meanCandleHeight, candleHeight)
    const baseVolumeChange   = h.percentChange(means.meanVolume.bv, last.baseVolume)

    if (candleHeight       > 0   &&
        candleHeightChange > 200 &&
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
   * see if price has been increasing regardless of volume.
   *
   * @param {Object} opts    Provide candles
   * @return {Analysis}      Did the price rise for N consecutive candles?
   */
  consecutivePriceIncrease({ exchange, currencyPair, candles }) {
  }

}

module.exports = analysis
