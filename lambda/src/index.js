const winston = require('winston');
const config = require('./config');
const { getState, updateState } = require('./stateManager');
const { fetchMarketData } = require('./dataFetcher');
const { buildPrompt } = require('./promptBuilder');
const { callGrok } = require('./aiCaller');
const { executeTrade } = require('./tradeExecutor');
const { updateNAV } = require('./navUpdater');
const { validateStack } = require('./utils');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Main Lambda handler for scheduled execution
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 */
exports.handler = async (event, context) => {
  logger.info('Scheduled Lambda triggered', { event, context });

  try {
    // Get current state
    const state = await getState();
    const { signals, positions, lastTrigger } = state;

    // Check if recent 30min trigger (last 1 hour)
    const now = Date.now() / 1000;
    const hasRecentTrigger = lastTrigger && (now - lastTrigger) < 3600; // 1 hour

    if (hasRecentTrigger) {
      logger.info('Performing full analysis due to recent 30min trigger');
      await performFullAnalysis(signals, positions);
    } else {
      logger.info('Performing light check (no AI)');
      await performLightCheck(signals);
    }

    logger.info('Scheduled execution completed successfully');
  } catch (error) {
    logger.error('Error in scheduled execution', { error: error.message, stack: error.stack });
    // Notify via SNS if configured
    // await notifyError(error);
  }
};

/**
 * Perform full analysis with AI
 * @param {Array} signals - Recent signals
 * @param {Array} positions - Current positions
 */
async function performFullAnalysis(signals, positions) {
  // Validate stack
  if (!validateStack(positions)) {
    throw new Error('Invalid position stack');
  }

  // Fetch market data
  const marketData = await fetchMarketData();

  // Build prompt
  const prompt = buildPrompt(signals, positions, marketData);

  // Call Grok
  const aiResponse = await callGrok(prompt);

  // Parse response
  const { action, confidence, leverage, reason } = JSON.parse(aiResponse);

  logger.info('AI Decision', { action, confidence, leverage, reason });

  // Execute trade if not hold
  if (action !== 'hold') {
    await executeTrade(action, confidence, leverage, positions);
  }

  // Update NAV
  await updateNAV();

  // Update state
  await updateState({ signals, positions, lastAnalysis: Date.now() / 1000 });
}

/**
 * Perform light check without AI
 * @param {Array} signals - Recent signals
 */
async function performLightCheck(signals) {
  // Just log signals or perform basic checks
  logger.info('Light check signals', { signals });
  // Optionally, check for confluence without AI
}