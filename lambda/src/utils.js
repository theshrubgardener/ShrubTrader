const _ = require('lodash');

/**
 * Calculate LIFO sell: Sell oldest positions first (FIFO for sells as per MD)
 * @param {number} amountToSell - Amount to sell
 * @param {Array} stack - Array of positions [{timestamp, amount, pair, entryPrice}]
 * @returns {Object} {positionsToSell: Array, remainingStack: Array}
 */
function calculateLIFO(amountToSell, stack) {
  const positionsToSell = [];
  let remainingAmount = amountToSell;
  const remainingStack = _.cloneDeep(stack);

  // Sort stack by timestamp ascending (oldest first)
  remainingStack.sort((a, b) => a.timestamp - b.timestamp);

  while (remainingAmount > 0 && remainingStack.length > 0) {
    const position = remainingStack.shift();
    if (position.amount <= remainingAmount) {
      positionsToSell.push(position);
      remainingAmount -= position.amount;
    } else {
      // Partial sell
      positionsToSell.push({
        ...position,
        amount: remainingAmount
      });
      position.amount -= remainingAmount;
      remainingStack.unshift(position); // Put back the partial
      remainingAmount = 0;
    }
  }

  return { positionsToSell, remainingStack };
}

/**
 * Validate the position stack
 * @param {Array} stack - Array of positions
 * @returns {boolean} True if valid
 */
function validateStack(stack) {
  if (!Array.isArray(stack)) return false;
  for (const pos of stack) {
    if (!pos.timestamp || !pos.amount || pos.amount <= 0 || !pos.pair || !pos.entryPrice || pos.entryPrice <= 0) {
      return false;
    }
  }
  return true;
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Calculate confidence-based leverage
 * @param {number} confidence - 1-10
 * @param {Object} leverageConfig - From config
 * @returns {number} Leverage
 */
function getLeverage(confidence, leverageConfig) {
  if (confidence > 7) return leverageConfig.HIGH;
  if (confidence >= 4) return leverageConfig.MED;
  return leverageConfig.LOW;
}

module.exports = {
  calculateLIFO,
  validateStack,
  formatDate,
  getLeverage
};