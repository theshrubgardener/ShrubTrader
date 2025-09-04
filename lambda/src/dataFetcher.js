const axios = require('axios');
const winston = require('winston');
const config = require('./config');
const { getCustodyData } = require('./jupiterPerps/queries');
const { PublicKey } = require('@solana/web3.js');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Fetch market data: prices, positions, news
 * @returns {Object} {prices: Object, positions: Array, news: string}
 */
async function fetchMarketData() {
  try {
    const [prices, positions, news] = await Promise.all([
      fetchPrices(),
      fetchPositions(),
      fetchNews()
    ]);

    return { prices, positions, news };
  } catch (error) {
    logger.error('Error fetching market data', { error: error.message });
    throw error;
  }
}

/**
 * Fetch current prices for SOL and BTC
 * @returns {Object} {SOL: number, BTC: number}
 */
async function fetchPrices() {
  try {
    // Use Jupiter custody data for prices (more accurate for perps)
    const [solCustody, btcCustody] = await Promise.all([
      getCustodyData(new PublicKey('7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz')), // SOL
      getCustodyData(new PublicKey('5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm'))  // BTC
    ]);

    return {
      SOL: parseFloat(solCustody.price) / 1_000_000, // Convert from base units
      BTC: parseFloat(btcCustody.price) / 1_000_000
    };
  } catch (error) {
    logger.error('Error fetching prices from Jupiter', { error: error.message });
    // Fallback to CoinGecko if Jupiter fails
    try {
      const response = await axios.get(`${config.COINGECKO_API_URL}/simple/price`, {
        params: {
          ids: 'solana,bitcoin',
          vs_currencies: 'usd'
        }
      });
      return {
        SOL: response.data.solana.usd,
        BTC: response.data.bitcoin.usd
      };
    } catch (fallbackError) {
      logger.error('Fallback price fetch also failed', { error: fallbackError.message });
      throw fallbackError;
    }
  }
}

/**
 * Fetch current positions from Jupiter Perp
 * @returns {Array} Array of positions
 */
async function fetchPositions() {
  try {
    // Jupiter Perp API - no API key required for basic endpoints
    // Using free tier endpoints
    const response = await axios.get(`${config.JUPITER_PERP_API_URL}/positions`);

    return response.data.positions || [];
  } catch (error) {
    logger.error('Error fetching positions', { error: error.message });
    // Note: Jupiter Perp API may require Anchor IDL setup
    // Reference: https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing
    return [];
  }
}

/**
 * Fetch recent news for SOL and BTC
 * @returns {string} News summary
 */
async function fetchNews() {
  try {
    // Use Grok to search for news
    const prompt = "Search X.com for recent news impacting SOL and BTC prices in the last 24 hours. Summarize key points.";
    const response = await axios.post(config.GROK_API_URL, {
      model: 'grok-1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${config.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error('Error fetching news', { error: error.message });
    return 'No news available';
  }
}

module.exports = {
  fetchMarketData,
  fetchPrices,
  fetchPositions,
  fetchNews
};