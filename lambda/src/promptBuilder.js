const config = require('./config');
const { formatDate } = require('./utils');

/**
 * Build Grok prompt with signals, positions, market data
 * @param {Array} signals - Recent signals
 * @param {Array} positions - Current positions
 * @param {Object} marketData - {prices, positions, news}
 * @returns {string} Prompt string
 */
function buildPrompt(signals, positions, marketData) {
  const { prices, news } = marketData;

  // Format signals
  const signalsText = signals.map(s =>
    `${s.timeframe}: ${s.signal} at ${formatDate(s.timestamp)}`
  ).join(', ');

  // Format positions
  const positionsText = positions.map(p =>
    `{timestamp: ${formatDate(p.timestamp)}, amount: ${p.amount}, pair: ${p.pair}, entryPrice: ${p.entryPrice}}`
  ).join(', ');

  // Assume USDC balance is fetched or calculated
  const usdcBalance = 5000; // Placeholder, should be fetched

  const prompt = `
Analyze these TradingView signals: [${signalsText}].
Current positions: [${positionsText}].
USDC balance: ${usdcBalance}.
Current prices: SOL: ${prices.SOL}, BTC: ${prices.BTC}.
Recent news: ${news}.
Decide action for SOL/USDC or BTC/USDC only, long-only, 30% USDC buy, LIFO sell.
Output JSON: {action: 'buy_sol'/'buy_btc'/'sell_sol'/'sell_btc'/'hold', confidence: 1-10, leverage: ${config.LEVERAGE.LOW}-${config.LEVERAGE.HIGH}, reason: string}.
  `.trim();

  return prompt;
}

module.exports = {
  buildPrompt
};