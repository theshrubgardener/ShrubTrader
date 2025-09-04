# Complete Design Plan for Solana Trading Bot

This plan automates trading for your Shrub-fund Solana program, using TradingView signals, Grok AI (with news integration), and Jupiter Perp API. It supports your rules: 30% USDC buys, LIFO sells (with stacking), long-only on SOL/USDC and BTC/USDC perps at 2.5x-4x leverage (confidence-based, fallback 3.3x), no shorts, hold USDC on drops.

## Overall Architecture

Serverless AWS Lambda system, triggered by webhooks and schedules. Signals stored in DynamoDB for confluence; AI enhances decisions with news searches.

**Updated Flow (Mermaid Diagram):**

```mermaid
graph TD
    A[TradingView Webhook] -->|Push Signal| B[AWS API Gateway + Lambda (webhookHandler)]
    B -->|Store in DynamoDB| C[DynamoDB (Signals, Positions, State)]
    B -->|If 30min Signal: Trigger Analysis| D[Analysis Lambda]
    E[Scheduled Lambda (every 30 min)] -->|Light Check (no AI if recent 30min trigger)| C
    D -->|Fetch Data, Positions (Stacked LIFO)| C
    D -->|Fetch Prices/News| F[Jupiter API / CoinGecko]
    D -->|Build Prompt (Signals, Data, News, Rules)| G[Grok API]
    G -->|Parse {action, confidence, leverage, reason}| D
    D -->|Execute (Buy 30% USDC / LIFO Sell / Hold)| H[Jupiter Perp API]
    H -->|Update NAV| I[Solana Program]
    D -->|Update State (Stacked Positions)| C
    J[CloudWatch] -->|Monitor/Alert| K[Notify You]
```

## Languages and Technologies

- **Primary Language**: JavaScript (Node.js) for Lambda handlers – aligns with Jupiter API preference and ease of maintenance.
- **Key Libraries**:
  - HTTP/API Handling: axios (for Jupiter Perp API, Grok API, CoinGecko for prices).
  - Solana Integration: @solana/web3.js (for NAV updates to your program).
  - Data Manipulation: lodash (for deep merging/cloning of objects).
  - AWS Services: AWS SDK (@aws-sdk/client-dynamodb, @aws-sdk/client-sns for notifications).
  - Logging/Monitoring: winston for structured logging to AWS CloudWatch.
  - Testing: jest for unit/integration tests; sinon for mocking APIs.
- **APIs/Services**:
  - Jupiter Perp API (for perps trading on SOL/BTC pairs).
  - Grok API (decision-making with news search prompts).
  - TradingView Webhooks (signal capture).
  - CoinGecko/Alpha Vantage (supplemental price data if needed).
- **Storage**: AWS DynamoDB for signals (with TTL for history), stacked positions (array of {timestamp, amount, pair, entryPrice} for LIFO).
- **Blockchain**: Interact with your existing Solana program for NAV updates; use Jupiter for trades (no new contract needed).

## File Structure

Monorepo under `/Users/ZachMacStudio/Desktop/SHRB/trading-bot/` (new directory). Separate off-chain Lambda code from configs/docs.

```
trading-bot/
├── lambda/                  # Core bot logic (Node.js)
│   ├── src/                 # Source code
│   │   ├── index.js         # Main scheduled handler (orchestrates flow)
│   │   ├── webhookHandler.js# Handles TradingView webhook POSTs
│   │   ├── signalAnalyzer.js# Analyzes confluence from stored signals
│   │   ├── dataFetcher.js   # Fetches market data (Jupiter/CoinGecko)
│   │   ├── stateManager.js  # DynamoDB interactions (signals, trades)
│   │   ├── promptBuilder.js # Builds Grok prompts with signals/news
│   │   ├── aiCaller.js      # Calls Grok API, parses JSON response
│   │   ├── tradeExecutor.js # Executes buys/sells via Jupiter Perp API
│   │   ├── navUpdater.js    # Updates Solana NAV post-trade
│   │   ├── config.js        # Constants (API keys, pairs, leverage rules)
│   │   └── utils.js         # Helpers (LIFO sell logic, confidence calc)
│   ├── tests/               # Unit/integration tests
│   │   ├── signalAnalyzer.test.js
│   │   └── ... (per module)
│   ├── package.json         # Dependencies
│   └── serverless.yml       # Serverless Framework for deployment
├── docs/                    # Documentation
│   └── tradingBot.md        # This plan (generated upon approval)
├── .gitignore
└── README.md                # Setup/deployment guide
```

## Key Components and Function Purposes

### Off-Chain (Lambda - Node.js)

- **index.js**: Scheduled Lambda handler. Orchestrates the flow: Fetch data → Get state → Build prompt → Call Grok → Parse response → Execute on Jupiter → Update state. Purpose: Entry point; handles errors globally and logs outcomes.

- **webhookHandler.js**: Handles TradingView webhook POSTs. Validates payload, stores signal in DynamoDB, triggers analysis Lambda if 30min signal. Purpose: Real-time signal ingestion; ensures data integrity.

- **signalAnalyzer.js**: Analyzes confluence from stored signals (e.g., if 3+ timeframes agree on buy, high confidence). Purpose: Determines when to act based on your manual rules (e.g., ignore single signals if contradicted by higher timeframes).

- **dataFetcher.js**: Fetches current prices/positions via Jupiter API, news via Grok search. Purpose: Ensures data is fresh and formatted; handles API rate limits/retries.

- **stateManager.js**: Reads/writes trade state to DynamoDB (e.g., position stack: [{timestamp, amount, pair, entryPrice}]). Purpose: Manages persistence; includes versioning or locking to prevent race conditions.

- **promptBuilder.js**: Constructs Grok prompt with signals, data, news, rules. Example: "Analyze these signals [JSON]. Current positions [list]. Search X.com for SOL/BTC news. Decide: {action: 'buy_sol'/'buy_btc'/'sell_sol'/'sell_btc'/'hold', confidence: 1-10, leverage: 2.5-4, reason: string}. Enforce long-only, 30% USDC buy, LIFO sell." Purpose: Ensures prompt is consistent and includes all elements.

- **aiCaller.js**: Sends POST to Grok API with auth headers; parses JSON response. Purpose: Interfaces with AI; adds retries for API failures.

- **tradeExecutor.js**: Builds/executes Jupiter Perp trades (e.g., open long with params from AI). Purpose: Bridges to Jupiter; includes fee estimation and simulation for safety.

- **navUpdater.js**: Queries Jupiter for position values + USDC balance, calculates NAV, invokes update_optimized_nav in Solana program. Purpose: Keeps fund NAV accurate post-trade.

- **config.js**: Hardcoded constants (e.g., pairs: ['SOL/USDC', 'BTC/USDC'], leverage: {high: 4, med: 3.3, low: 2.5}, API URLs).

- **utils.js**: Helpers like calculateLIFO(amount, stack), validateStack(stack), formatDate(timestamp).

### On-Chain (Solana Program Integration)

- **Existing Shrub-fund Program**: Use update_optimized_nav to update NAV after trades. No new instructions needed; bot interacts via gardener authority.

## Integration Flows

1. **Signal Ingestion**:
   - TradingView webhook POSTs to API Gateway → webhookHandler.js → Store in DynamoDB with timestamp, timeframe (30min/1h/4h/1d), type (buy/sell), details (e.g., indicator: 'confluence', value: 1.05).
   - If 30min signal, asynchronously invoke analysis Lambda.

2. **Periodic Execution (Scheduled Lambda)**:
   - index.js runs every 30 min via EventBridge.
   - If no recent 30min trigger (last 1h), perform light check (fetch signals, no AI).
   - Else, full analysis: Fetch signals, positions, data, build prompt, call Grok, parse, execute, update NAV/state.

3. **Analysis/Decision**:
   - signalAnalyzer.js: Check confluence (e.g., buy if 30min buy + 1h buy + 4h hold, sell if 4h sell overrides).
   - promptBuilder.js: Include recent signals (last 24h), current stack, USDC balance, news query.
   - aiCaller.js: Call Grok, expect JSON: {action, confidence, leverage, reason}.

4. **Execution**:
   - tradeExecutor.js: For buy: Calculate 30% of USDC, open perp long at leverage (based on confidence: >7=4x, 4-7=3.3x, <4=2.5x), add to stack.
   - For sell: LIFO from stack (e.g., sell oldest position first), close perp.
   - For hold: Do nothing.
   - navUpdater.js: Update Solana NAV.

5. **State Update**:
   - stateManager.js: Update position stack, signal history (TTL 7 days).

## Deployment and Scheduling

- **Deployment**: Use Serverless Framework to deploy Lambda functions, API Gateway (for webhooks), DynamoDB tables, and EventBridge scheduler. Store secrets (API keys, wallet private key) in AWS Secrets Manager.
- **Scheduling**: AWS EventBridge cron (e.g., every 30 min: `*/30 * * * ? *`).
- **Setup Steps**:
  1. Clone repo: `git clone <repo>`.
  2. Install deps: `npm install`.
  3. Configure TradingView: Set webhook URL to API Gateway endpoint, payload format: {timeframe, signal, details}.
  4. Set env vars: GROK_API_KEY, JUPITER_API_KEY, SOLANA_RPC_URL, DYNAMODB_TABLE, etc.
  5. Deploy: `serverless deploy`.
  6. Test: Invoke Lambda with test event.

## Error Handling and Security

- **Errors**: Try-catch in all functions; on failure (e.g., API down), log to CloudWatch, skip trade, notify via SNS (email/SMS to you). Circuit breakers for repeated failures.
- **Security**: Least-privilege IAM roles; encrypt secrets; validate webhook signatures from TradingView; wallet key only in Secrets Manager (never code). Rate-limit API Gateway.
- **Risk Mitigations**: Enforce trading rules in code; add thresholds (e.g., pause if losses >10% in 24h); simulate trades in dev mode. Added checks for stack integrity (e.g., prevent selling non-existent positions).

## Testing Plan

- **Unit Tests**: Jest for individual functions (e.g., mock Grok response, test confluence logic).
- **Integration Tests**: Local Lambda invoke with mock APIs; end-to-end with Solana Devnet and test Jupiter perps.
- **Backtesting**: Feed historical signals/data to promptBuilder → aiCaller (mock Grok) → Simulate trades and NAV impacts. Include scenarios for stacked trades and 30min triggers.

## Example Grok Prompt

"Analyze these TradingView signals: [30min: buy confluence, 1h: buy ATR, 4h: sell cloud, 1d: hold RSI]. Current positions: [{timestamp: 123456, amount: 100, pair: 'SOL/USDC', entryPrice: 150}]. USDC balance: 5000. Search X.com for recent SOL/BTC news impacting prices. Decide action for SOL/USDC or BTC/USDC only, long-only, 30% USDC buy, LIFO sell. Output JSON: {action: 'buy_sol'/'sell_sol'/'hold', confidence: 1-10, leverage: 2.5-4, reason: string}."

## Monitoring and Alerting

- CloudWatch logs for all actions/errors.
- SNS notifications for failures or large trades.
- Dashboard: AWS CloudWatch metrics for trade frequency, NAV changes.

## Dependencies (package.json)

{
  "name": "trading-bot",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "@solana/web3.js": "^1.87.6",
    "lodash": "^4.17.21",
    "@aws-sdk/client-dynamodb": "^3.490.0",
    "@aws-sdk/client-sns": "^3.490.0",
    "winston": "^3.11.0",
    "jest": "^29.7.0",
    "sinon": "^17.0.1"
  }
}

This detailed plan ensures the team stays focused on implementation, covering all aspects from our discussion.