/**
 * Return the given parameter
 *
 * @param   {Any} n
 * @returns {Any}
 */
function identity(n) { return n }

/**
 * Return the next state of the state machine after inputs have been applied
 *
 * @param   {StateMachine} fsm
 * @param   {String}       state
 * @param   {Array}        inputs
 * @param   {Function}     transform
 * @returns {State}
 */
function nextState(fsm, state, inputs, transform) {
  const fn = transform ? transform : identity

  return inputs.reduce((m, a) => {
    let i = fn(a)
    // console.warn(state, i)
    return fsm[state][fn(a)]
  }, state)
}

/**
 * Return a function that remembers a state machine's last state and gives you the subsequent states on repeated calls
 *
 * @param   {StateMachine} fsm
 * @param   {String}       state
 * @param   {Function}     transform
 * @returns {Function}
 */
function init(fsm, state, transform) {
  let currentState = state

  /**
   * Remembering the current state, move to the next state as dictated by the given inputs
   *
   * @param {Array} inputs
   * @returns {State}
   */
  return function next(inputs) {
    currentState = nextState(fsm, currentState, inputs, transform)
    return currentState
  }
}

module.exports = {
  identity,
  nextState,
  init
}
