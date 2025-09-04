const winston = require('winston');
const config = require('./config');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Analyze confluence from signals
 * @param {Array} signals - Array of signals [{timeframe, signal, timestamp}]
 * @returns {Object} {confluence: number, action: string, confidence: number}
 */
function analyzeConfluence(signals) {
  logger.info('Analyzing signals for confluence', { signals });

  // Group signals by timeframe (take latest for each)
  const latestSignals = {};
  signals.forEach(sig => {
    if (!latestSignals[sig.timeframe] || sig.timestamp > latestSignals[sig.timeframe].timestamp) {
      latestSignals[sig.timeframe] = sig;
    }
  });

  const timeframes = config.TIMEFRAMES;
  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;

  timeframes.forEach(tf => {
    const sig = latestSignals[tf];
    if (sig) {
      if (sig.signal === 'buy') buyCount++;
      else if (sig.signal === 'sell') sellCount++;
      else holdCount++;
    }
  });

  // Simple confluence logic
  let action = 'hold';
  let confidence = 5; // Default

  if (buyCount >= 2 && sellCount === 0) {
    action = 'buy';
    confidence = Math.min(10, buyCount * 2 + 5);
  } else if (sellCount >= 2 && buyCount === 0) {
    action = 'sell';
    confidence = Math.min(10, sellCount * 2 + 5);
  } else if (sellCount > buyCount) {
    action = 'sell';
    confidence = 6;
  } else if (buyCount > sellCount) {
    action = 'buy';
    confidence = 6;
  }

  // Higher timeframes override lower ones
  const highTfSignal = latestSignals['1d'] || latestSignals['4h'];
  if (highTfSignal && highTfSignal.signal === 'sell' && action === 'buy') {
    action = 'hold';
    confidence -= 2;
  }

  const confluence = buyCount + sellCount; // Number of agreeing signals

  logger.info('Confluence analysis result', { action, confidence, confluence });

  return { confluence, action, confidence };
}

module.exports = {
  analyzeConfluence
};