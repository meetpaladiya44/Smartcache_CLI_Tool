export interface PlaceBidApiResponse {
  success: boolean;
  minBidRequired?: string;
  gasSaved?: string;
  txHash?: string;
  gasUsed?: string;
}

export async function placeBid(contractAddress: string): Promise<PlaceBidApiResponse> {
  const apiUrl = 'https://smartcli.udonswap.org/place-bid';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contractAddress }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Bid placement failed');
  }
  return data as PlaceBidApiResponse;
} 