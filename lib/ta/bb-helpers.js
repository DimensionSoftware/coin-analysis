/**
 * @fileOverview  Helper functions for Bollinger Bands
 * @name          bb-helpers.js
 * @author        beppu
 * @license       undefined
 */
module.exports = {

  /**
   * Calculate Bollinger Bands %b for a candle
   * http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:bollinger_band_perce
   *
   * @param   {Object} bb        Bollinger Band values for one candle
   * @param   {Number} bb.upper
   * @param   {Number} bb.middle
   * @param   {Number} bb.lower
   * @param   {Number} price     Closing price of candle
   * @returns {Number}           %b
   */
  percentB: function({upper, middle, lower}, price) {
    return (price - lower) / (upper - lower)
  },

  /**
   * Calculate Bollinger Bands BandWidth for a candle.
   * (John Bollinger capitalizes the 'W' so I do too.)
   * http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:bollinger_band_width
   *
   * @param   {Object} bb        Bollinger Band values for one candle
   * @param   {Number} bb.upper
   * @param   {Number} bb.middle
   * @param   {Number} bb.lower
   * @returns {Number}           BandWidth
   */
  bandWidth: function({ upper, middle, lower }){
    return ((upper - lower) / middle) * 100
  }

}
