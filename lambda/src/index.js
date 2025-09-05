const winston = require('winston');
const config = require('./config');
const { getState, updateState, storePriceData, cleanupOldData } = require('./stateManager');
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
    // Check if analysis is already running (simple concurrency control)
    const isAnalysisRunning = await checkAnalysisLock();
    if (isAnalysisRunning) {
      logger.info('Analysis already running, skipping');
      return { statusCode: 200, body: 'Analysis already running' };
    }

    // Set analysis lock
    await setAnalysisLock();

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
    } finally {
      // Always release the analysis lock
      await releaseAnalysisLock();
    }
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

  // Group signals by ticker
  const signalsByTicker = {};
  signals.forEach(signal => {
    const ticker = signal.ticker || 'UNKNOWN';
    if (!signalsByTicker[ticker]) {
      signalsByTicker[ticker] = [];
    }
    signalsByTicker[ticker].push(signal);
  });

  // Process each ticker independently (not async to avoid rate limits)
  for (const [ticker, tickerSignals] of Object.entries(signalsByTicker)) {
    logger.info(`Processing signals for ${ticker}`, { signalCount: tickerSignals.length });

    try {
      await processTickerAnalysis(ticker, tickerSignals, positions);
    } catch (error) {
      logger.error(`Error processing ${ticker}`, { error: error.message });
      // Continue with other tickers even if one fails
    }
  }

  // Update state
  await updateState({ signals, positions, lastAnalysis: Date.now() / 1000 });
}

async function processTickerAnalysis(ticker, tickerSignals, positions) {
  // Fetch market data
  const marketData = await fetchMarketData();

  // Filter positions for this ticker
  const tickerPositions = positions.filter(p => p.ticker === ticker);

  // Build prompt for this ticker
  const prompt = await buildPrompt(tickerSignals, tickerPositions, marketData);

  // Call Grok
  const aiResponse = await callGrok(prompt);

  // Parse response
  const { action, confidence, leverage, reason } = JSON.parse(aiResponse);

  logger.info(`AI Decision for ${ticker}`, { action, confidence, leverage, reason });

  // Execute trade if not hold
  if (action !== 'hold') {
    await executeTrade(action, confidence, leverage, positions);
  }

  // Skip NAV update - handled by existing system every 2 hours
  logger.info('Skipping NAV update - handled by existing automated system');
}

/**
 * Perform light check without AI
 * @param {Array} signals - Recent signals
 */
async function performLightCheck(signals) {
  try {
    // Track current prices every 30 minutes
    const marketData = await fetchMarketData();
    const priceEntry = {
      timestamp: Date.now(),
      SOL: marketData.prices.SOL,
      BTC: marketData.prices.BTC
    };

    // Store price data (this will be used for AI analysis)
    await storePriceData(priceEntry);

    // Clean up old data (older than 7 days)
    await cleanupOldData();

    logger.info('Light check completed', {
      signalsCount: signals.length,
      pricesTracked: priceEntry
    });
  } catch (error) {
    logger.error('Error in light check', { error: error.message });
  }
}

/**
 * Check if analysis is currently running
 * @returns {boolean}
 */
async function checkAnalysisLock() {
  try {
    const state = await getState();
    const now = Date.now() / 1000;
    // If lock exists and is less than 5 minutes old, consider it running
    return state.analysisLock && (now - state.analysisLock) < 300;
  } catch (error) {
    logger.error('Error checking analysis lock', { error });
    return false;
  }
}

/**
 * Set analysis lock
 */
async function setAnalysisLock() {
  try {
    await updateState({ analysisLock: Date.now() / 1000 });
  } catch (error) {
    logger.error('Error setting analysis lock', { error });
  }
}

/**
 * Release analysis lock
 */
async function releaseAnalysisLock() {
  try {
    await updateState({ analysisLock: null });
  } catch (error) {
    logger.error('Error releasing analysis lock', { error });
  }
}