import { PublicKey, Keypair } from "@solana/web3.js";
import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { RPC_CONNECTION } from "./constants";

/**
 * Create Anchor wallet from private key
 */
export function createWalletFromPrivateKey(privateKey: string): Wallet {
  const secretKey = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  return new Wallet(keypair);
}

/**
 * Create Anchor provider
 */
export function createAnchorProvider(wallet: Wallet) {
  return new AnchorProvider(RPC_CONNECTION, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed"
  });
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

/**
 * Convert USDC amount to base units (6 decimals)
 */
export function usdcToBaseUnits(amount: number): number {
  return Math.floor(amount * 1_000_000);
}

/**
 * Convert base units to USDC amount
 */
export function baseUnitsToUsdc(amount: number): number {
  return amount / 1_000_000;
}

/**
 * Calculate leverage from confidence score
 */
export function calculateLeverage(confidence: number): number {
  if (confidence >= 8) return 4;
  if (confidence >= 6) return 3.3;
  if (confidence >= 4) return 2.5;
  return 2.5; // minimum leverage
}

/**
 * Calculate position size based on available USDC and leverage
 */
export function calculatePositionSize(
  availableUsdc: number,
  leverage: number,
  maxAllocationPercent: number = 0.3
): number {
  const maxPositionValue = availableUsdc * maxAllocationPercent;
  return maxPositionValue * leverage;
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate Solana public key
 */
export function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate unique request ID for position requests
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}