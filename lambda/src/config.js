const config = {
  // Trading pairs
  PAIRS: ['SOL/USDC', 'BTC/USDC'],

  // Leverage levels based on confidence
  LEVERAGE: {
    HIGH: 4,    // confidence > 7
    MED: 3.3,   // confidence 4-7
    LOW: 2.5    // confidence < 4
  },

  // API URLs
  JUPITER_PERP_API_URL: 'https://perp.jup.ag/api/v1',
  GROK_API_URL: 'https://api.grok.ai/v1/chat/completions', // Placeholder, adjust as needed
  COINGECKO_API_URL: 'https://api.coingecko.com/api/v3',
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',

  // AWS
  DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || 'TradingBotState',
  SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:TradingBotAlerts',

  // Trading rules
  BUY_PERCENTAGE: 0.3, // 30% of USDC for buys
  MAX_LOSS_THRESHOLD: 0.1, // Pause if losses >10% in 24h

  // Timeframes for signals
  TIMEFRAMES: ['30min', '1h', '4h', '1d'],

  // Signal TTL in DynamoDB (7 days in seconds)
  SIGNAL_TTL: 7 * 24 * 60 * 60,

  // API Keys (from environment)
  GROK_API_KEY: process.env.GROK_API_KEY,
  JUPITER_API_KEY: process.env.JUPITER_API_KEY || null, // Optional - free tier available

  // Wallet private key for Solana (from Secrets Manager)
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

module.exports = config;