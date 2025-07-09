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
    'arbitrum-goerli', // Legacy testnet
    'localhost'
  ];
  return validNetworks.includes(network.toLowerCase());
}

export function detectNetwork(endpoint?: string): string {
  if (!endpoint) {
    return 'arbitrum-sepolia'; // Default network
  }
  if (endpoint.includes('sepolia')) {
    return 'arbitrum-sepolia';
  } else if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
    return 'localhost';
  } else if (endpoint.includes('arbitrum.io')) {
    return 'arbitrum-one';
  } else if (endpoint.includes('nova')) {
    return 'arbitrum-nova';
  }
  return 'arbitrum-sepolia';
}

// Dynamic RPC URLs for supported networks
const NETWORK_RPC: Record<string, string> = {
  'arbitrum-sepolia': 'https://sepolia-rollup.arbitrum.io/rpc',
  'arbitrum-one': 'https://arb1.arbitrum.io/rpc',
  'arbitrum-nova': 'https://nova.arbitrum.io/rpc',
  'localhost': 'http://localhost:8545',
  'arbitrum-goerli': 'https://goerli-rollup.arbitrum.io/rpc',
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