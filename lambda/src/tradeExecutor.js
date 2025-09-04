const axios = require('axios');
const winston = require('winston');
const config = require('./config');
const { calculateLIFO, getLeverage, validateStack } = require('./utils');
const { updatePositions } = require('./stateManager');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Execute trade based on AI decision
 * @param {string} action - 'buy_sol', 'buy_btc', 'sell_sol', 'sell_btc'
 * @param {number} confidence - 1-10
 * @param {number} leverage - Leverage value
 * @param {Array} positions - Current positions
 */
async function executeTrade(action, confidence, leverage, positions) {
  try {
    logger.info('Executing trade', { action, confidence, leverage });

    if (!validateStack(positions)) {
      throw new Error('Invalid positions stack');
    }

    const usdcBalance = await getUSDCBalance(); // Placeholder
    const amountToTrade = usdcBalance * config.BUY_PERCENTAGE;

    if (action.startsWith('buy_')) {
      const pair = action === 'buy_sol' ? 'SOL/USDC' : 'BTC/USDC';
      await executeBuy(pair, amountToTrade, leverage, positions);
    } else if (action.startsWith('sell_')) {
      const pair = action === 'sell_sol' ? 'SOL/USDC' : 'BTC/USDC';
      await executeSell(pair, amountToTrade, positions);
    }

    logger.info('Trade executed successfully');
  } catch (error) {
    logger.error('Error executing trade', { error: error.message });
    throw error;
  }
}

/**
 * Execute buy trade
 * @param {string} pair - Trading pair
 * @param {number} amount - Amount in USDC
 * @param {number} leverage - Leverage
 * @param {Array} positions - Positions array
 */
async function executeBuy(pair, amount, leverage, positions) {
  // Placeholder: Call Jupiter Perp API to open long position
  const response = await axios.post(`${config.JUPITER_PERP_API_URL}/orders`, {
    pair,
    side: 'long',
    amount,
    leverage,
    type: 'market'
  }, {
    headers: {
      'Authorization': `Bearer ${config.JUPITER_API_KEY}`
    }
  });

  // Add to positions stack
  const newPosition = {
    timestamp: Date.now(),
    amount,
    pair,
    entryPrice: response.data.entryPrice // Assume API returns this
  };
  positions.push(newPosition);
  await updatePositions(positions);
}

/**
 * Execute sell trade using LIFO
 * @param {string} pair - Trading pair
 * @param {number} amount - Amount to sell
 * @param {Array} positions - Positions array
 */
async function executeSell(pair, amount, positions) {
  const { positionsToSell, remainingStack } = calculateLIFO(amount, positions.filter(p => p.pair === pair));

  if (positionsToSell.length === 0) {
    logger.warn('No positions to sell');
    return;
  }

  // Placeholder: Call Jupiter to close positions
  for (const pos of positionsToSell) {
    await axios.post(`${config.JUPITER_PERP_API_URL}/orders`, {
      pair,
      side: 'short', // To close long
      amount: pos.amount,
      type: 'market'
    }, {
      headers: {
        'Authorization': `Bearer ${config.JUPITER_API_KEY}`
      }
    });
  }

  await updatePositions(remainingStack);
}

/**
 * Get USDC balance (placeholder)
 * @returns {number} Balance
 */
async function getUSDCBalance() {
  // Placeholder: Fetch from Jupiter or wallet
  return 5000; // Example
}

module.exports = {
  executeTrade
};