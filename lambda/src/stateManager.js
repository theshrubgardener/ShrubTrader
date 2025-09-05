const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const winston = require('winston');
const config = require('./config');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/**
 * Get current state from DynamoDB
 * @returns {Object} {signals: Array, positions: Array, lastTrigger: number}
 */
async function getState() {
  try {
    const response = await dynamoClient.send(new GetItemCommand({
      TableName: config.DYNAMODB_TABLE,
      Key: marshall({ id: 'state' })
    }));

    if (response.Item) {
      const item = unmarshall(response.Item);
      return {
        signals: item.signals || [],
        positions: item.positions || [],
        lastTrigger: item.lastTrigger || 0,
        lastAnalysis: item.lastAnalysis || 0
      };
    } else {
      // Initialize state
      return {
        signals: [],
        positions: [],
        lastTrigger: 0,
        lastAnalysis: 0
      };
    }
  } catch (error) {
    logger.error('Error getting state', { error: error.message });
    throw error;
  }
}

/**
 * Update state in DynamoDB
 * @param {Object} updates - {signals, positions, lastTrigger, lastAnalysis}
 */
async function updateState(updates) {
  try {
    const currentState = await getState();
    const newState = { ...currentState, ...updates };

    await dynamoClient.send(new PutItemCommand({
      TableName: config.DYNAMODB_TABLE,
      Item: marshall({
        id: 'state',
        signals: newState.signals,
        positions: newState.positions,
        lastTrigger: newState.lastTrigger,
        lastAnalysis: newState.lastAnalysis,
        updatedAt: Date.now()
      })
    }));

    logger.info('State updated', { updates });
  } catch (error) {
    logger.error('Error updating state', { error: error.message });
    throw error;
  }
}

/**
 * Add signal to state
 * @param {Object} signal - {timeframe, signal, details, timestamp}
 */
async function addSignal(signal) {
  const state = await getState();
  state.signals.push(signal);
  // Keep only recent signals (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  state.signals = state.signals.filter(s => s.timestamp > oneDayAgo);
  await updateState({ signals: state.signals });
}

/**
 * Update positions
 * @param {Array} positions - New positions array
 */
async function updatePositions(positions) {
  await updateState({ positions });
}

/**
 * Store price data for tracking
 * @param {Object} priceEntry - {timestamp, SOL, BTC}
 */
async function storePriceData(priceEntry) {
  try {
    const state = await getState();
    if (!state.priceHistory) {
      state.priceHistory = [];
    }

    // Keep only last 7 days of price data (336 entries at 30min intervals)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    state.priceHistory = state.priceHistory.filter(p => p.timestamp > sevenDaysAgo);

    // Add new price entry
    state.priceHistory.push(priceEntry);

    await updateState({ priceHistory: state.priceHistory });
  } catch (error) {
    logger.error('Error storing price data', { error });
  }
}

/**
 * Clean up old data (signals and price history older than 7 days)
 */
async function cleanupOldData() {
  try {
    const state = await getState();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Clean up old signals
    if (state.signals) {
      const originalCount = state.signals.length;
      state.signals = state.signals.filter(s => s.timestamp > sevenDaysAgo);
      logger.info('Cleaned up old signals', {
        originalCount,
        remainingCount: state.signals.length
      });
    }

    // Clean up old price history (already done in storePriceData, but double-check)
    if (state.priceHistory) {
      const originalPriceCount = state.priceHistory.length;
      state.priceHistory = state.priceHistory.filter(p => p.timestamp > sevenDaysAgo);
      logger.info('Cleaned up old price history', {
        originalCount: originalPriceCount,
        remainingCount: state.priceHistory.length
      });
    }

    await updateState({
      signals: state.signals || [],
      priceHistory: state.priceHistory || []
    });
  } catch (error) {
    logger.error('Error cleaning up old data', { error });
  }
}

module.exports = {
  getState,
  updateState,
  addSignal,
  updatePositions,
  storePriceData,
  cleanupOldData
};