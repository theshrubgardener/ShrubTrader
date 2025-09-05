const config = require('./config');
const { formatDate } = require('./utils');
const { getState } = require('./stateManager');

/**
 * Build Grok prompt with signals, positions, market data
 * @param {Array} signals - Recent signals
 * @param {Array} positions - Current positions
 * @param {Object} marketData - {prices, positions, news}
 * @returns {string} Prompt string
 */
async function buildPrompt(signals, positions, marketData) {
  const { prices, news } = marketData;

  // Get price history for context
  const state = await getState();
  const priceHistory = state.priceHistory || [];
  const recentPrices = priceHistory.slice(-10); // Last 10 price entries (5 hours)

  // Format signals (last 7 days for better context)
  const sevenDaysAgo = Date.now() / 1000 - (7 * 24 * 60 * 60);
  const recentSignals = signals.filter(s => s.timestamp > sevenDaysAgo);
  const signalsText = recentSignals.map(s =>
    `${s.timeframe}: ${s.signal} (${s.ticker || 'SOL/BTC'}) at ${formatDate(s.timestamp)}`
  ).join(', ');

  // Format positions
  const positionsText = positions.map(p =>
    `{timestamp: ${formatDate(p.timestamp)}, amount: ${p.amount}, pair: ${p.pair}, entryPrice: ${p.entryPrice}}`
  ).join(', ');

  // Assume USDC balance is fetched or calculated
  const usdcBalance = 5000; // Placeholder, should be fetched

  // Format price history
  const priceHistoryText = recentPrices.map(p =>
    `${formatDate(p.timestamp)}: SOL $${p.SOL.toFixed(2)}, BTC $${p.BTC.toFixed(2)}`
  ).join('; ');

  const prompt = `
Analyze these TradingView signals from the last 7 days: [${signalsText}].
Current positions: [${positionsText}].
USDC balance: ${usdcBalance}.
Current prices: SOL: ${prices.SOL}, BTC: ${prices.BTC}.

Recent price movements (last 5 hours): ${priceHistoryText}

Recent news analysis (focus on last 24 hours, exclude price predictions and opinions):
${news}

INSTRUCTIONS for analysis:
- Focus on factual events: protocol upgrades, partnerships, regulatory news, technical developments
- Ignore: price predictions, social media hype, individual opinions, short-term market sentiment
- Consider price trends: Use recent price movements to identify momentum and support/resistance levels
- Prioritize: DeFi ecosystem changes, Solana network updates, major adoption news
- Timeframe: Recent developments that could impact SOL/BTC prices in next 24-72 hours

Decide action for SOL/USDC or BTC/USDC only, long-only, 30% USDC buy, LIFO sell.
Output JSON: {action: 'buy_sol'/'buy_btc'/'sell_sol'/'sell_btc'/'hold', confidence: 1-10, leverage: ${config.LEVERAGE.LOW}-${config.LEVERAGE.HIGH}, reason: string}.
  `.trim();

  return prompt;
}

module.exports = {
  buildPrompt
};