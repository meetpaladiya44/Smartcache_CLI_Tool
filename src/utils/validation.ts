import { isAddress, ethers } from 'ethers';

export function normalizeAddress(address: string): string {
  if (!address) {
    throw new Error('Address cannot be empty');
  }
  // Remove whitespace
  address = address.trim();
  // Validate the address
  if (!isAddress(address)) {
    throw new Error(`Invalid contract address: ${address}`);
  }
  // Convert to checksum address
  return address.toLowerCase();
}

export function validateNetwork(network: string): boolean {
  const validNetworks = [
    'arbitrum-sepolia',
    'arbitrum-one', 
    'arbitrum-nova',
    'localhost'
  ];
  return validNetworks.includes(network.toLowerCase());
}

// Dynamic RPC URLs for supported networks
const NETWORK_RPC: Record<string, string> = {
  'arbitrum-sepolia': 'https://sepolia-rollup.arbitrum.io/rpc',
  'arbitrum-one': 'https://arb1.arbitrum.io/rpc',
  'arbitrum-nova': 'https://nova.arbitrum.io/rpc',
  'localhost': 'http://localhost:8545',
};

export async function validateContractDeploymentOnNetwork(contractAddress: string, network: string, deployerAddress?: string) {
  // Validate contract address format
  if (!isAddress(contractAddress)) {
    throw new Error('Invalid contract address');
  }
  // Validate deployer address format
  if (deployerAddress && !isAddress(deployerAddress)) {
    throw new Error('Invalid deployer address');
  }
  // Get the correct RPC URL for the network
  const rpcUrl = NETWORK_RPC[network];
  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  // Check that code exists at the address
  const code = await provider.getCode(contractAddress);
  if (!code || code === '0x') {
    throw new Error('No contract code found at this address. It may not be deployed yet.');
  }
  return true;
} 