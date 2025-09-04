import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import {
  getCustodyForPair,
  getCollateralCustody,
  RPC_CONNECTION
} from "./constants";
import { PositionSummary, FeeData, PoolData } from "./types";

// Simplified data fetching - in production, use proper Anchor account fetching
let mockPositions: any[] = [];
let mockPrices = { SOL: 100, BTC: 50000 };

/**
 * Get all open positions for a wallet
 */
export async function getOpenPositions(walletPublicKey: PublicKey): Promise<any[]> {
  // In production, this would fetch from Jupiter Perps program accounts
  // For now, return mock data
  return mockPositions.filter(pos => pos.owner === walletPublicKey.toString());
}

/**
 * Get position PnL
 */
export async function getPositionPnl(positionPubkey: PublicKey): Promise<number> {
  // Mock PnL calculation
  const position = mockPositions.find(pos => pos.publicKey === positionPubkey.toString());
  if (!position) return 0;

  const currentPrice = position.pair === 'SOL/USDC' ? mockPrices.SOL : mockPrices.BTC;
  const priceDiff = currentPrice - position.entryPrice;
  const pnl = position.side === 'Long' ?
    (priceDiff * position.size) :
    (-priceDiff * position.size);

  return pnl;
}

/**
 * Get liquidation price for a position
 */
export async function getLiquidationPrice(positionPubkey: PublicKey): Promise<number> {
  // Mock liquidation price calculation
  const position = mockPositions.find(pos => pos.publicKey === positionPubkey.toString());
  if (!position) return 0;

  // Simplified: liquidation at 80% of entry price for longs, 120% for shorts
  const currentPrice = position.pair === 'SOL/USDC' ? mockPrices.SOL : mockPrices.BTC;
  return position.side === 'Long' ?
    currentPrice * 0.8 :
    currentPrice * 1.2;
}

/**
 * Get custody data (price, etc.)
 */
export async function getCustodyData(custodyPubkey: PublicKey): Promise<any> {
  // Mock custody data
  const custodyAddress = custodyPubkey.toString();

  if (custodyAddress.includes('SOL')) {
    return {
      publicKey: custodyAddress,
      price: mockPrices.SOL,
      decimals: 9,
      isStable: false
    };
  } else if (custodyAddress.includes('BTC')) {
    return {
      publicKey: custodyAddress,
      price: mockPrices.BTC,
      decimals: 8,
      isStable: false
    };
  } else {
    // USDC
    return {
      publicKey: custodyAddress,
      price: 1,
      decimals: 6,
      isStable: true
    };
  }
}

/**
 * Get price impact and fees
 */
export async function getPriceImpactFee(
  size: number,
  side: string
): Promise<FeeData> {
  // Mock fee calculation
  const baseFee = size * 0.001; // 0.1% base fee
  const priceImpact = size * 0.0005; // 0.05% price impact

  return {
    priceImpactFee: priceImpact,
    openCloseFee: baseFee,
    borrowFee: baseFee * 0.1,
    fundingRate: 0.0001 // 0.01% per hour
  };
}

/**
 * Get open/close fees
 */
export async function getOpenCloseBaseFee(): Promise<number> {
  // Mock base fee
  return 0.001; // 0.1%
}

/**
 * Get pool AUM (Assets Under Management)
 */
export async function getPoolAum(): Promise<number> {
  // Mock AUM
  return 10000000; // $10M
}

/**
 * Get JLP virtual price
 */
export async function getJlpVirtualPrice(): Promise<number> {
  // Mock JLP price
  return 1.05; // $1.05 per JLP
}

/**
 * Get pool APY
 */
export async function getPoolApy(): Promise<number> {
  // Mock APY
  return 0.15; // 15%
}

/**
 * Update mock data (for testing)
 */
export function updateMockData(positions: any[], prices: any) {
  mockPositions = positions;
  mockPrices = prices;
}

/**
 * Get position summary
 */
export async function getPositionSummary(positionPubkey: PublicKey): Promise<PositionSummary | null> {
  const position = mockPositions.find(pos => pos.publicKey === positionPubkey.toString());
  if (!position) return null;

  const pnl = await getPositionPnl(positionPubkey);
  const liquidationPrice = await getLiquidationPrice(positionPubkey);
  const currentPrice = position.pair === 'SOL/USDC' ? mockPrices.SOL : mockPrices.BTC;

  return {
    pair: position.pair,
    side: position.side,
    size: position.size,
    entryPrice: position.entryPrice,
    currentPrice,
    pnl,
    pnlPercentage: (pnl / (position.entryPrice * position.size)) * 100,
    liquidationPrice
  };
}