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
   - `GROK_API_KEY` (required)
   - `JUPITER_API_KEY` (optional - free tier available)
   - `WALLET_PRIVATE_KEY` (required - Solana wallet private key)
   - `SOLANA_RPC_URL` (optional, defaults to mainnet-beta)
   - `AWS_REGION` (set to us-east-2)

3. **TradingView Setup**:
   - **Webhook URL**: `https://yqttqc1l4k.execute-api.us-east-2.amazonaws.com/dev/webhook`
   - Payload format:
     ```json
     {
       "timeframe": "{{strategy.timeframe}}",
       "signal": "{{strategy.signal}}",
       "details": {
         "indicator": "confluence",
         "value": "{{strategy.value}}"
       }
     }
     ```

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

## Jupiter Perp Integration Plan

### Phase 1: Core Setup (Current)
- ✅ Basic placeholder functions in `tradeExecutor.js`
- ✅ Optional API key configuration
- ✅ Documentation and repository references

### Phase 2: Anchor IDL Integration (Next Priority)
**Repository Reference**: `https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing`

**Required Dependencies to Add**:
```json
{
  "@coral-xyz/anchor": "^0.29.0",
  "@solana/spl-token": "^0.4.9",
  "decimal.js": "^10.6.0"
}
```

**Key Components to Implement**:
1. **IDL Integration**: Import Jupiter Perps IDL and types
2. **Program Setup**: Initialize Anchor Program with proper provider
3. **Constants**: Add custody addresses, program IDs, pool addresses
4. **Position Management**: Open/close positions using request-fulfillment model
5. **Data Fetching**: Get positions, PnL, fees using Anchor accounts

### Phase 3: Trading Functions
- **Open Position**: `constructMarketOpenPositionTrade()`
- **Close Position**: `constructMarketClosePositionTrade()`
- **Position Queries**: `getOpenPositionsForWallet()`
- **PnL Calculation**: `getPositionPnl()`
- **Fee Estimation**: `getPriceImpactFee()`, `getOpenCloseBaseFee()`

### Phase 4: Advanced Features
- **JLP Integration**: Jupiter Liquidity Pool interactions
- **Liquidation Monitoring**: `getLiquidationPrice()`
- **Funding Rate Tracking**: `getBorrowFeeAndFundingRate()`
- **Event Streaming**: Real-time position updates

### Implementation Steps:
1. Add Anchor dependencies to `package.json`
2. Create `jupiterPerps/` directory with IDL and constants
3. Implement core trading functions
4. Update `tradeExecutor.js` to use real Jupiter integration
5. Add comprehensive error handling and logging
6. Test with devnet before mainnet deployment

## Security

- Use least-privilege IAM roles.
- Store secrets in AWS Secrets Manager.
- Validate webhook signatures.

## Monitoring

- CloudWatch logs for all activities.
- SNS for alerts on errors.