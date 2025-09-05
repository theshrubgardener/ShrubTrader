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
  logger.info('🎣 WEBHOOK: Signal received', {
    bodyLength: event.body?.length,
    source: 'TradingView'
  });

  try {
    // Parse payload
    logger.info('📝 WEBHOOK: Parsing payload');
    const payload = JSON.parse(event.body);
    const { timeframe, signal, ticker, details } = payload;
    logger.info('✅ WEBHOOK: Payload parsed', {
      timeframe,
      signal,
      ticker,
      hasDetails: !!details
    });

    // Validate payload
    logger.info('🔍 WEBHOOK: Validating payload');
    if (!timeframe || !signal || !['buy', 'sell', 'hold'].includes(signal)) {
      logger.error('❌ WEBHOOK: Invalid payload', { timeframe, signal });
      throw new Error('Invalid payload');
    }
    logger.info('✅ WEBHOOK: Payload validation passed');

    // Store signal in DynamoDB
    logger.info('💾 WEBHOOK: Storing signal in database');
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

    logger.info('✅ WEBHOOK: Signal stored successfully', {
      id: item.id.S,
      timeframe,
      signal,
      ticker
    });

    // If 30min signal, trigger analysis Lambda
    if (timeframe === '30min') {
      logger.info('🚀 WEBHOOK: Triggering analysis Lambda (30min signal)');
      await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.ANALYSIS_LAMBDA_NAME || 'trading-bot-analysis',
        InvocationType: 'Event', // Asynchronous
        Payload: JSON.stringify({ trigger: 'webhook', timestamp })
      }));
      logger.info('✅ WEBHOOK: Analysis Lambda triggered successfully');
    } else {
      logger.info('⏭️ WEBHOOK: No analysis trigger (not 30min timeframe)');
    }

    logger.info('🎉 WEBHOOK: Processing complete');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Signal received and processed' })
    };
  } catch (error) {
    logger.error('❌ WEBHOOK: Error processing signal', {
      error: error.message,
      stack: error.stack
    });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};