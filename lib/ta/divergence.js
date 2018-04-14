module.exports = {

  /**
   * Find peaks in values
   *
   * @param {Array<Number>} ns
   * @return {Array<Number>}
   */
  findPeaks: function(ns) {
  },

  /**
   * Detect valleys in values
   *
   * @param {Array<Number>} ns
   * @return {Array<Number>}
   */
  findValleys: function(ns) {
  },

  detectRegular: function(prices, indicator) {
    let pricePeaks = this.findPeaks(prices),
        indicatorPeaks = this.findPeaks(indicator)

  },

  detectHidden: function(prices, indicator) {
  }

}
