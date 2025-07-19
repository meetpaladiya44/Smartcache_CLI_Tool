// Interface definitions for contract records
// Database operations are now handled by backend API, but we still need types

export interface ContractRecord {
  _id?: string;
  contractAddress: string;
  network: string;
  deployedAt: Date;
  evictionThresholdDate: Date;
  deployedBy?: string;
  minBidRequired?: string;
  gasSaved?: string;
  byCLI?: boolean;
  txHash?: string;
  gasUsed?: string;
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    [key: string]: any;
  };
} 