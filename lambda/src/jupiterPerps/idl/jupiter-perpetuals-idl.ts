// Jupiter Perpetuals IDL - Basic structure for Anchor integration
// This is a simplified version - in production, use the official IDL from Jupiter

export const IDL = {
  version: "0.1.0",
  name: "jupiter_perpetuals",
  address: "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu",
  metadata: {
    name: "jupiter_perpetuals",
    version: "0.1.0",
    spec: "0.1.0"
  },
  instructions: [
    {
      name: "createIncreasePositionMarketRequest",
      accounts: [
        { name: "owner", isMut: true, isSigner: true },
        { name: "fundingAccount", isMut: true, isSigner: false },
        { name: "custody", isMut: false, isSigner: false },
        { name: "collateralCustody", isMut: false, isSigner: false },
        { name: "position", isMut: true, isSigner: false },
        { name: "positionRequest", isMut: true, isSigner: false },
        { name: "positionRequestAta", isMut: true, isSigner: false },
        { name: "perpetuals", isMut: false, isSigner: false },
        { name: "pool", isMut: false, isSigner: false },
        { name: "inputMint", isMut: false, isSigner: false },
        { name: "referral", isMut: false, isSigner: false, isOptional: true }
      ],
      args: [
        { name: "counter", type: "u64" },
        { name: "collateralTokenDelta", type: "u64" },
        { name: "jupiterMinimumOut", type: { option: "u64" } },
        { name: "priceSlippage", type: "u64" },
        { name: "side", type: { defined: "PositionSide" } },
        { name: "sizeUsdDelta", type: "u64" }
      ]
    },
    {
      name: "createDecreasePositionMarketRequest",
      accounts: [
        { name: "owner", isMut: true, isSigner: true },
        { name: "receivingAccount", isMut: true, isSigner: false },
        { name: "position", isMut: true, isSigner: false },
        { name: "positionRequest", isMut: true, isSigner: false },
        { name: "positionRequestAta", isMut: true, isSigner: false },
        { name: "perpetuals", isMut: false, isSigner: false },
        { name: "pool", isMut: false, isSigner: false },
        { name: "custody", isMut: false, isSigner: false },
        { name: "collateralCustody", isMut: false, isSigner: false },
        { name: "desiredMint", isMut: false, isSigner: false },
        { name: "referral", isMut: false, isSigner: false, isOptional: true }
      ],
      args: [
        { name: "counter", type: "u64" },
        { name: "collateralUsdDelta", type: "u64" },
        { name: "sizeUsdDelta", type: "u64" },
        { name: "priceSlippage", type: "u64" },
        { name: "jupiterMinimumOut", type: { option: "u64" } },
        { name: "entirePosition", type: "bool" }
      ]
    }
  ],
  accounts: [
    {
      name: "Position",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "custody", type: "publicKey" },
          { name: "collateralCustody", type: "publicKey" },
          { name: "side", type: { defined: "PositionSide" } },
          { name: "sizeUsd", type: "u64" },
          { name: "collateralUsd", type: "u64" },
          { name: "entryPrice", type: "u64" },
          { name: "exitPrice", type: { option: "u64" } }
        ]
      }
    },
    {
      name: "Custody",
      type: {
        kind: "struct",
        fields: [
          { name: "publicKey", type: "publicKey" },
          { name: "mint", type: "publicKey" },
          { name: "decimals", type: "u32" },
          { name: "isStable", type: "bool" },
          { name: "price", type: "u64" }
        ]
      }
    }
  ],
  types: [
    {
      name: "PositionSide",
      type: {
        kind: "enum",
        variants: [
          { name: "Long" },
          { name: "Short" }
        ]
      }
    }
  ],
  events: [],
  errors: []
};

// Type exports for TypeScript
export type Perpetuals = typeof IDL;
export type Position = {
  owner: string;
  custody: string;
  collateralCustody: string;
  side: PositionSide;
  sizeUsd: string;
  collateralUsd: string;
  entryPrice: string;
  exitPrice: string | null;
};

export type CustodyAccount = {
  publicKey: string;
  mint: string;
  decimals: number;
  isStable: boolean;
  price: string;
};

export type PositionSide = "Long" | "Short";