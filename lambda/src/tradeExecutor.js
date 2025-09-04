const axios = require('axios');
const winston = require('winston');
const config = require('./config');
const { calculateLIFO, getLeverage, validateStack } = require('./utils');
const { updatePositions } = require('./stateManager');
const { openPosition, closePosition } = require('./jupiterPerps/trading');
const { getOpenPositions, getPositionPnl } = require('./jupiterPerps/queries');

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
  try {
    // Get wallet private key from environment
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY not configured');
    }

    // Use real Jupiter Perps integration
    const tradeRequest = {
      pair,
      amount,
      leverage,
      side: 'Long'
    };

    const signature = await openPosition(tradeRequest, privateKey);

    // Add to positions stack (simplified - in production, fetch from blockchain)
    const newPosition = {
      timestamp: Date.now(),
      amount,
      pair,
      entryPrice: 0, // Would be fetched from transaction result
      side: 'Long',
      publicKey: `pos_${Date.now()}` // Mock public key
    };
    positions.push(newPosition);
    await updatePositions(positions);

    logger.info('Position opened successfully', { signature, pair, amount, leverage });
  } catch (error) {
    logger.error('Error opening position', { error: error.message, pair, amount });
    throw error;
  }
}

/**
 * Execute sell trade using LIFO
 * @param {string} pair - Trading pair
 * @param {number} amount - Amount to sell
 * @param {Array} positions - Positions array
 */
async function executeSell(pair, amount, positions) {
  try {
    const { positionsToSell, remainingStack } = calculateLIFO(amount, positions.filter(p => p.pair === pair));

    if (positionsToSell.length === 0) {
      logger.warn('No positions to sell');
      return;
    }

    // Get wallet private key from environment
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY not configured');
    }

    // Close positions using Jupiter Perps
    for (const pos of positionsToSell) {
      // For now, use mock position public key
      // In production, this would be the actual position public key from blockchain
      const mockPositionPubkey = { toString: () => pos.publicKey || `pos_${pos.timestamp}` };
      await closePosition(mockPositionPubkey, privateKey);
    }

    await updatePositions(remainingStack);
    logger.info('Positions closed successfully', { pair, positionsClosed: positionsToSell.length });
  } catch (error) {
    logger.error('Error closing positions', { error: error.message, pair });
    throw error;
  }
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