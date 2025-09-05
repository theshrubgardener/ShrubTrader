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
  // Try Jupiter API 3 times before falling back to CoinGecko
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logger.info(`Fetching prices from Jupiter API (attempt ${attempt})`);

      // Use Jupiter Price API v3 as specified
      const response = await axios.get('https://lite-api.jup.ag/price/v3/', {
        params: {
          ids: 'So11111111111111111111111111111112,EzZp7LRN2B6hQ8t3MmQG6wZMrn6X1rKT7b2Pd2WEL4y' // SOL, BTC
        },
        timeout: 5000
      });

      const solPrice = parseFloat(response.data.data['So11111111111111111111111111111112']?.price || '0');
      const btcPrice = parseFloat(response.data.data['EzZp7LRN2B6hQ8t3MmQG6wZMrn6X1rKT7b2Pd2WEL4y']?.price || '0');

      if (solPrice > 0 && btcPrice > 0) {
        return {
          SOL: solPrice,
          BTC: btcPrice
        };
      }

      throw new Error('Invalid price data from Jupiter API');
    } catch (error) {
      logger.warn(`Jupiter API attempt ${attempt} failed`, { error: error.message });

      if (attempt === 3) {
        logger.error('All Jupiter API attempts failed, falling back to CoinGecko');
        // Fallback to CoinGecko
        try {
          const response = await axios.get(`${config.COINGECKO_API_URL}/simple/price`, {
            params: {
              ids: 'solana,bitcoin',
              vs_currencies: 'usd'
            },
            timeout: 5000
          });
          return {
            SOL: response.data.solana.usd,
            BTC: response.data.bitcoin.usd
          };
        } catch (fallbackError) {
          logger.error('CoinGecko fallback also failed', { error: fallbackError.message });
          throw fallbackError;
        }
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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