const h = require('./helpers')

const analysis = {

  /**
   * there are some coins that have too little volume to trade easily.  I might want to ignore
   * some coins in the future, and this will figure that out.
   *
   * @return {Analysis} Does this market have enough liquidity/volume for effective trading?
   */
  sufficientVolume() {
    return { hit: true, message: 'This market has sufficient voluem for trading.' }
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
        message: `${currencyPair} on ${exchange}: ${h.urls[exchange].market(currencyPair)} - ` +
          `candleHeight ${candleHeight} (${candleHeightChange}%) - ` +
          `baseVolume ${last.baseVolume} (${baseVolumeChange}%)`
      }
    }

    return { hit: false }
  }

}

module.exports = analysis
