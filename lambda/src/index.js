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
  logger.info('🔍 PHASE 1: Starting Full Analysis', {
    totalSignals: signals.length,
    totalPositions: positions.length
  });

  // Validate stack
  if (!validateStack(positions)) {
    logger.error('❌ PHASE 1: Invalid position stack detected');
    throw new Error('Invalid position stack');
  }
  logger.info('✅ PHASE 1: Position stack validation passed');

  // Group signals by ticker
  logger.info('📊 PHASE 2: Grouping signals by ticker');
  const signalsByTicker = {};
  signals.forEach(signal => {
    const ticker = signal.ticker || 'UNKNOWN';
    if (!signalsByTicker[ticker]) {
      signalsByTicker[ticker] = [];
    }
    signalsByTicker[ticker].push(signal);
  });

  logger.info('✅ PHASE 2: Signals grouped by ticker', {
    tickersFound: Object.keys(signalsByTicker),
    totalGroups: Object.keys(signalsByTicker).length
  });

  // Process each ticker independently (not async to avoid rate limits)
  for (const [ticker, tickerSignals] of Object.entries(signalsByTicker)) {
    logger.info(`🎯 PHASE 3: Processing signals for ${ticker}`, {
      signalCount: tickerSignals.length,
      ticker: ticker
    });

    try {
      await processTickerAnalysis(ticker, tickerSignals, positions);
      logger.info(`✅ PHASE 3: Completed processing for ${ticker}`);
    } catch (error) {
      logger.error(`❌ PHASE 3: Error processing ${ticker}`, {
        error: error.message,
        ticker: ticker
      });
      // Continue with other tickers even if one fails
    }
  }

  // Update state
  logger.info('💾 PHASE 4: Updating state in database');
  await updateState({ signals, positions, lastAnalysis: Date.now() / 1000 });
  logger.info('✅ PHASE 4: State updated successfully');
}

async function processTickerAnalysis(ticker, tickerSignals, positions) {
  logger.info(`🔄 PHASE 3A: Starting data consolidation for ${ticker}`);

  // Fetch market data
  logger.info(`📡 PHASE 3B: Fetching market data for ${ticker}`);
  const marketData = await fetchMarketData();
  logger.info(`✅ PHASE 3B: Market data fetched`, {
    prices: marketData.prices,
    newsLength: marketData.news?.length || 0
  });

  // Filter positions for this ticker
  logger.info(`📊 PHASE 3C: Filtering positions for ${ticker}`);
  const tickerPositions = positions.filter(p => p.ticker === ticker);
  logger.info(`✅ PHASE 3C: Positions filtered`, {
    totalPositions: positions.length,
    tickerPositions: tickerPositions.length,
    ticker: ticker
  });

  // Build prompt for this ticker
  logger.info(`🤖 PHASE 3D: Building AI prompt for ${ticker}`);
  const prompt = await buildPrompt(tickerSignals, tickerPositions, marketData);
  logger.info(`✅ PHASE 3D: AI prompt built`, {
    promptLength: prompt.length,
    signalsCount: tickerSignals.length,
    positionsCount: tickerPositions.length
  });

  // Call Grok
  logger.info(`🧠 PHASE 3E: Calling Grok AI for ${ticker}`);
  const aiResponse = await callGrok(prompt);
  logger.info(`✅ PHASE 3E: Grok AI response received`, {
    responseLength: aiResponse.length
  });

  // Parse response
  const { action, confidence, leverage, reason } = JSON.parse(aiResponse);
  logger.info(`🎯 PHASE 3F: AI Decision parsed for ${ticker}`, {
    action,
    confidence,
    leverage,
    reasonLength: reason.length
  });

  // Execute trade if not hold
  if (action !== 'hold') {
    logger.info(`⚡ PHASE 3G: Executing trade for ${ticker}`, { action, confidence, leverage });
    await executeTrade(action, confidence, leverage, positions);
    logger.info(`✅ PHASE 3G: Trade executed for ${ticker}`);
  } else {
    logger.info(`⏸️ PHASE 3G: No trade executed for ${ticker} (hold decision)`);
  }

  // Skip NAV update - handled by existing system every 2 hours
  logger.info(`💰 PHASE 3H: Skipping NAV update for ${ticker} - handled by existing system`);
}

/**
 * Perform light check without AI
 * @param {Array} signals - Recent signals
 */
async function performLightCheck(signals) {
  try {
    logger.info('💡 LIGHT CHECK: Starting 30-minute maintenance cycle');

    // Track current prices every 30 minutes
    logger.info('📈 LIGHT CHECK: Fetching current prices');
    const marketData = await fetchMarketData();
    const priceEntry = {
      timestamp: Date.now(),
      SOL: marketData.prices.SOL,
      BTC: marketData.prices.BTC
    };
    logger.info('✅ LIGHT CHECK: Prices fetched', {
      SOL: priceEntry.SOL,
      BTC: priceEntry.BTC
    });

    // Store price data (this will be used for AI analysis)
    logger.info('💾 LIGHT CHECK: Storing price data for AI analysis');
    await storePriceData(priceEntry);
    logger.info('✅ LIGHT CHECK: Price data stored');

    // Clean up old data (older than 7 days)
    logger.info('🧹 LIGHT CHECK: Cleaning up old data (>7 days)');
    await cleanupOldData();
    logger.info('✅ LIGHT CHECK: Data cleanup completed');

    logger.info('🎉 LIGHT CHECK: Maintenance cycle completed successfully', {
      signalsCount: signals.length,
      pricesTracked: priceEntry
    });
  } catch (error) {
    logger.error('❌ LIGHT CHECK: Error in maintenance cycle', {
      error: error.message,
      stack: error.stack
    });
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