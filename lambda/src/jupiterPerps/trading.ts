import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import {
  JUPITER_PERPETUALS_PROGRAM_ID,
  JLP_POOL_ACCOUNT_PUBKEY,
  getCustodyForPair,
  getCollateralCustody,
  RPC_CONNECTION
} from "./constants";
import {
  createWalletFromPrivateKey,
  usdcToBaseUnits
} from "./utils";
import { TradeRequest } from "./types";

// Use any for now to avoid complex IDL typing issues
let jupiterProgram: any = null;

/**
 * Initialize Jupiter Program with wallet
 */
export function initializeProgram(privateKey: string): any {
  // Simplified initialization - in production, use proper Anchor Program
  const wallet = createWalletFromPrivateKey(privateKey);
  jupiterProgram = { wallet, initialized: true };
  return jupiterProgram;
}

/**
 * Open a new position
 */
export async function openPosition(
  tradeRequest: TradeRequest,
  walletPrivateKey: string
): Promise<string> {
  if (!jupiterProgram) {
    jupiterProgram = initializeProgram(walletPrivateKey);
  }

  const { pair, amount, leverage, side } = tradeRequest;
  const wallet = createWalletFromPrivateKey(walletPrivateKey);
  const owner = wallet.publicKey;

  // Get custody addresses
  const custody = getCustodyForPair(pair);
  const collateralCustody = getCollateralCustody();

  // Generate position PDA (simplified - in real implementation, use proper PDA generation)
  const positionPubkey = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), owner.toBuffer(), Buffer.from(pair)],
    JUPITER_PERPETUALS_PROGRAM_ID
  )[0];

  // Generate position request PDA
  const counter = new BN(Date.now()); // Simplified counter
  const positionRequest = PublicKey.findProgramAddressSync(
    [Buffer.from("position_request"), positionPubkey.toBuffer(), counter.toArrayLike(Buffer)],
    JUPITER_PERPETUALS_PROGRAM_ID
  )[0];

  // Position request ATA
  const positionRequestAta = getAssociatedTokenAddressSync(
    collateralCustody, // USDC
    positionRequest,
    true
  );

  // Funding account (owner's USDC ATA)
  const fundingAccount = getAssociatedTokenAddressSync(
    collateralCustody, // USDC
    owner
  );

  // Calculate position parameters
  const collateralTokenDelta = new BN(usdcToBaseUnits(amount));
  const sizeUsdDelta = new BN(usdcToBaseUnits(amount * leverage));
  const priceSlippage = new BN(usdcToBaseUnits(100)); // 100 USDC slippage

  // Build instruction
  const increaseIx = await jupiterProgram.methods
    .createIncreasePositionMarketRequest(
      counter,
      collateralTokenDelta,
      null, // jupiterMinimumOut
      priceSlippage,
      { [side.toLowerCase()]: {} } as any, // Position side enum
      sizeUsdDelta
    )
    .accounts({
      owner,
      fundingAccount,
      custody,
      collateralCustody,
      position: positionPubkey,
      positionRequest,
      positionRequestAta,
      perpetuals: PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        JUPITER_PERPETUALS_PROGRAM_ID
      )[0],
      pool: JLP_POOL_ACCOUNT_PUBKEY,
      inputMint: collateralCustody,
      referral: null
    })
    .instruction();

  // Set compute budget
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000
  });

  // Create transaction
  const transaction = new Transaction()
    .add(computeBudgetIx)
    .add(increaseIx);

  // Sign and send
  const signature = await sendAndConfirmTransaction(
    RPC_CONNECTION,
    transaction,
    [wallet.payer]
  );

  return signature;
}

/**
 * Close an existing position
 */
export async function closePosition(
  positionPubkey: PublicKey,
  walletPrivateKey: string
): Promise<string> {
  if (!jupiterProgram) {
    jupiterProgram = initializeProgram(walletPrivateKey);
  }

  const wallet = createWalletFromPrivateKey(walletPrivateKey);
  const owner = wallet.publicKey;

  // Fetch position data (simplified)
  const position = await jupiterProgram.account.position.fetch(positionPubkey);

  // Generate position request PDA
  const counter = new BN(Date.now());
  const positionRequest = PublicKey.findProgramAddressSync(
    [Buffer.from("position_request"), positionPubkey.toBuffer(), counter.toArrayLike(Buffer)],
    JUPITER_PERPETUALS_PROGRAM_ID
  )[0];

  // Receiving account (owner's USDC ATA)
  const receivingAccount = getAssociatedTokenAddressSync(
    position.collateralCustody,
    owner
  );

  // Build close instruction
  const decreaseIx = await jupiterProgram.methods
    .createDecreasePositionMarketRequest(
      counter,
      new BN(0), // collateralUsdDelta
      new BN(0), // sizeUsdDelta
      new BN(usdcToBaseUnits(100)), // priceSlippage
      null, // jupiterMinimumOut
      true // entirePosition
    )
    .accounts({
      owner,
      receivingAccount,
      position: positionPubkey,
      positionRequest,
      positionRequestAta: getAssociatedTokenAddressSync(
        position.collateralCustody,
        positionRequest,
        true
      ),
      perpetuals: PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        JUPITER_PERPETUALS_PROGRAM_ID
      )[0],
      pool: JLP_POOL_ACCOUNT_PUBKEY,
      custody: position.custody,
      collateralCustody: position.collateralCustody,
      desiredMint: position.collateralCustody,
      referral: null
    })
    .instruction();

  // Set compute budget
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000
  });

  // Create transaction
  const transaction = new Transaction()
    .add(computeBudgetIx)
    .add(decreaseIx);

  // Sign and send
  const signature = await sendAndConfirmTransaction(
    RPC_CONNECTION,
    transaction,
    [wallet.payer]
  );

  return signature;
}

/**
 * Get Jupiter Quote for token swaps (if needed)
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<any> {
  // This would integrate with Jupiter Quote API
  // For now, return a mock response
  return {
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps,
    minimumOutAmount: (amount * 0.995).toString() // 0.5% slippage
  };
}