# Trading Bot

This is a serverless trading bot for Solana using TradingView signals, Grok AI, and Jupiter Perp API.

## Architecture

- **Scheduled Lambda**: Runs every 30 minutes for analysis and trading.
- **Webhook Handler**: Receives signals from TradingView.
- **AI Integration**: Uses Grok for decision-making with news.
- **Perp Trading**: Executes trades on Jupiter Perp for SOL/USDC and BTC/USDC.
- **State Management**: Stores signals and positions in DynamoDB.
- **NAV Updates**: Updates Solana program NAV post-trade.

## Setup

1. **Clone and Install**:
   ```bash
   cd trading-bot/lambda
   npm install
   ```

2. **Configure Environment**:
   Set the following environment variables or in AWS Secrets Manager:
   - `GROK_API_KEY`
   - `JUPITER_API_KEY`
   - `WALLET_PRIVATE_KEY`
   - `SOLANA_RPC_URL`
   - `AWS_REGION`

3. **TradingView Setup**:
   - Set webhook URL to your API Gateway endpoint.
   - Payload format: `{timeframe, signal, details}`

4. **Deploy**:
   ```bash
   serverless deploy
   ```

5. **Test**:
   - Run tests: `npm test`
   - Invoke Lambda locally: `serverless invoke local -f scheduledHandler`

## Files

- `src/`: Source code
- `tests/`: Unit tests
- `serverless.yml`: Deployment config
- `docs/`: Documentation

## Security

- Use least-privilege IAM roles.
- Store secrets in AWS Secrets Manager.
- Validate webhook signatures.

## Monitoring

- CloudWatch logs for all activities.
- SNS for alerts on errors.