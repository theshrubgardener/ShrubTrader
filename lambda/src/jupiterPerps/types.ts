// TypeScript type definitions for Jupiter Perps integration

export interface Position {
  owner: string;
  custody: string;
  collateralCustody: string;
  side: PositionSide;
  sizeUsd: string;
  collateralUsd: string;
  entryPrice: string;
  exitPrice: string | null;
}

export interface CustodyAccount {
  publicKey: string;
  mint: string;
  decimals: number;
  isStable: boolean;
  price: string;
}

export type PositionSide = "Long" | "Short";

export interface PositionRequest {
  counter: number;
  collateralTokenDelta: string;
  jupiterMinimumOut: string | null;
  priceSlippage: string;
  side: PositionSide;
  sizeUsdDelta: string;
}

export interface TradeRequest {
  pair: string;
  amount: number;
  leverage: number;
  side: PositionSide;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  minimumOutAmount?: string;
}

export interface MarketData {
  SOL: number;
  BTC: number;
  ETH?: number;
}

export interface PositionSummary {
  pair: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  liquidationPrice: number;
}

export interface FeeData {
  priceImpactFee: number;
  openCloseFee: number;
  borrowFee: number;
  fundingRate: number;
}

export interface PoolData {
  aum: number;
  jlpPrice: number;
  apy: number;
}