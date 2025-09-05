const winston = require('winston');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const config = require('./config');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

/**
 * Lambda handler for TradingView webhook
 * @param {Object} event - API Gateway event
 * @param {Object} context - Lambda context
 */
exports.handler = async (event, context) => {
  logger.info('Webhook received', { event });

  try {
    // Parse payload
    const payload = JSON.parse(event.body);
    const { timeframe, signal, ticker, details } = payload;

    // Validate payload
    if (!timeframe || !signal || !['buy', 'sell', 'hold'].includes(signal)) {
      throw new Error('Invalid payload');
    }

    // Store signal in DynamoDB
    const timestamp = Date.now();
    const item = {
      id: { S: `${ticker || 'UNKNOWN'}-${timeframe}-${timestamp}` },
      timeframe: { S: timeframe },
      signal: { S: signal },
      ticker: { S: ticker || 'UNKNOWN' },
      details: { S: JSON.stringify(details) },
      timestamp: { N: timestamp.toString() },
      ttl: { N: (timestamp / 1000 + config.SIGNAL_TTL).toString() }
    };

    await dynamoClient.send(new PutItemCommand({
      TableName: config.DYNAMODB_TABLE,
      Item: item
    }));

    logger.info('Signal stored', { timeframe, signal });

    // If 30min signal, trigger analysis Lambda
    if (timeframe === '30min') {
      await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.ANALYSIS_LAMBDA_NAME || 'trading-bot-analysis',
        InvocationType: 'Event', // Asynchronous
        Payload: JSON.stringify({ trigger: 'webhook', timestamp })
      }));
      logger.info('Analysis Lambda triggered');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Signal received' })
    };
  } catch (error) {
    logger.error('Error in webhook handler', { error: error.message });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};