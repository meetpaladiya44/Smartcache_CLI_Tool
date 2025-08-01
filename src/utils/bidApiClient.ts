export interface PlaceBidApiResponse {
  success: boolean;
  minBidRequired?: string;
  gasSaved?: string;
  txHash?: string;
  gasUsed?: string;
  blockNumber?: string;
  gasSavingsPercentage?: string;
  roiAnalysis?: {
    shouldBid: boolean;
    reason: string;
    roi: number;
    profit: string;
    minBidEth: string;
    marketBidEth: string;
  };
}

export async function placeBid(contractAddress: string, network: string = 'arbitrum-sepolia'): Promise<PlaceBidApiResponse> {
  const apiUrl = 'https://smartcli.udonswap.org/place-bid';
  // const apiUrl = 'http://localhost:4000/place-bid';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contractAddress, network }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Bid placement failed');
  }
  return data as PlaceBidApiResponse;
} 