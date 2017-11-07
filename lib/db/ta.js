
const
  TIRSI  = require('technicalindicators').RSI,
  TIMACD = require('technicalindicators').MACD

// this may not be general enough, yet...
class TA {
  // init computation
  constructor() {
    this.calculator = null
    this.state = {
      values: [],
      result: null
    }
  }
  // add values to computation
  add(values) { return setState(this.state, 'values', values) }
  // get next computation value
  nextValue(value) { return setState(this.state, 'nextValue', value) }
}

module.exports = {
  MACD: class MACD extends TA {
    constructor(fastPeriod = 5, slowPeriod = 8, signalPeriod = 3, values = []) {
      super()
      this.calculator = new TIMACD({ fastPeriod, slowPeriod, signalPeriod, values })
      const result    = this.calculator.getResult()
      this.state = {
        fastPeriod,
        slowPeriod,
        signalPeriod,
        values,
        result
      }
    }

    /**
     * streaming macd
     *
     * @param {Array<Numbers>} values added to macd calculations   An array of closing prices
     * @returns {this.state} entire state
     */
    add(values) {
      // update values
      setState(this.state, 'values', this.state.values.concat(values))

      // update calculator/generator
      this.calculator = new TIMACD({
        slowPeriod   : this.state.slowPeriod,
        fastPeriod   : this.state.fastPeriod,
        signalPeriod : this.state.signalPeriod,
        values       : this.state.values
      })

      // update result
      return setState(
        this.state,
        'result',
        this.calculator.getResult())
    }

    nextValue(value) {
      const
        nextValue = this.calculator.nextValue(value)

      // update values
      setState(this.state, 'values', this.state.values.concat(value))

      // update result
      setState(this.state, 'result', this.state.result.concat(nextValue))

      return nextValue
    }
  },

  RSI: class RSI extends TA {
    constructor(period = 14, values = []) {
      super()
      this.calculator = new TIRSI({ period, values })
      const result    = this.calculator.getResult()
      this.state = {
        period,
        values,
        result
      }
    }

    /**
     * streaming rsi
     *
     * @param {Array<Numbers>} values added to rsi calculations   An array of _probably_ closing prices
     * @returns {this.state} entire state
     */
    add(values) {
      // update values
      setState(this.state, 'values', this.state.values.concat(values))

      // update calculator/generator
      this.calculator = new TIRSI({ period: this.state.period, values: this.state.values })

      // update result
      return setState(
        this.state,
        'result',
        this.calculator.getResult())
    }

    nextValue(value) {
      const
        nextValue = this.calculator.nextValue(value)

      // update values
      setState(this.state, 'values', this.state.values.concat(value))

      // update result
      setState(this.state, 'result', this.state.result.concat(nextValue))

      return nextValue
    }
  }
}


// ---------
function setState(state, key, value) {
  state[key] = value

  return state
}
