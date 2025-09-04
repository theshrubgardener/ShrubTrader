import { Connection, PublicKey } from "@solana/web3.js";

export const RPC_CONNECTION = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const JUPITER_PERPETUALS_PROGRAM_ID = new PublicKey(
  "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu"
);

export const JUPITER_PERPETUALS_EVENT_AUTHORITY_PUBKEY = new PublicKey(
  "37hJBDnntwqhGbK7L6M1bLyvccj4u55CCUiLPdYkiqBN"
);

export const JLP_POOL_ACCOUNT_PUBKEY = new PublicKey(
  "5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq"
);

export const JLP_MINT_PUBKEY = new PublicKey(
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4"
);

export const DOVES_PROGRAM_ID = new PublicKey(
  "DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e"
);

export enum CUSTODY_PUBKEY {
  SOL = "7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz",
  ETH = "AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1EjEn",
  BTC = "5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm",
  USDC = "G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa",
  USDT = "4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk",
}

export const CUSTODY_PUBKEYS = [
  new PublicKey(CUSTODY_PUBKEY.SOL),
  new PublicKey(CUSTODY_PUBKEY.BTC),
  new PublicKey(CUSTODY_PUBKEY.ETH),
  new PublicKey(CUSTODY_PUBKEY.USDC),
  new PublicKey(CUSTODY_PUBKEY.USDT),
];

export const USDC_DECIMALS = 6;
export const BPS_POWER = 10000n;
export const DBPS_POWER = 100000n;
export const RATE_POWER = 1000000000n;
export const DEBT_POWER = RATE_POWER;
export const BORROW_SIZE_PRECISION = 1000n;
export const JLP_DECIMALS = 6;

// Helper function to get custody public key for a pair
export function getCustodyForPair(pair: string): PublicKey {
  switch (pair) {
    case 'SOL/USDC':
      return new PublicKey(CUSTODY_PUBKEY.SOL);
    case 'BTC/USDC':
      return new PublicKey(CUSTODY_PUBKEY.BTC);
    case 'ETH/USDC':
      return new PublicKey(CUSTODY_PUBKEY.ETH);
    default:
      throw new Error(`Unsupported pair: ${pair}`);
  }
}

// Helper function to get collateral custody (always USDC for now)
export function getCollateralCustody(): PublicKey {
  return new PublicKey(CUSTODY_PUBKEY.USDC);
}