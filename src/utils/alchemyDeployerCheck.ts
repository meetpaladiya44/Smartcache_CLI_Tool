import { Alchemy, Network } from "alchemy-sdk";

const NETWORK_MAP: Record<string, Network> = {
  'arbitrum-sepolia': Network.ARB_SEPOLIA,
  'arbitrum-one': Network.ARB_MAINNET,
  // Add more if needed
};

export async function checkDeployerWithAlchemy(contractAddress: string, deployerAddress: string, network: string, apiKey: string) {
  const alchemyNetwork = NETWORK_MAP[network];
  if (!alchemyNetwork) {
    throw new Error(`Alchemy deployer check not supported for network: ${network}`);
  }
  const config = {
    apiKey: apiKey,
    network: alchemyNetwork,
  };
  const alchemy = new Alchemy(config);
  const response = await alchemy.core.findContractDeployer(contractAddress);
  if (!response?.deployerAddress) {
    throw new Error('Could not determine contract deployer from Alchemy.');
  }
  if (response.deployerAddress.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(`Deployer address mismatch: The actual deployer is ${response.deployerAddress}, but you provided ${deployerAddress}.`);
  }
  // If matches, return true
  return true;
} 