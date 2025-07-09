import { ethers } from 'ethers';

const ARB_WASM_CONTRACT = '0x0000000000000000000000000000000000000071';
const ARB_WASM_CACHE_CONTRACT = '0x0000000000000000000000000000000000000072';
const ABI_PROGRAM_TIME_LEFT = [
    {
        "type": "function",
        "name": "programTimeLeft",
        "inputs": [
            {
                "name": "program",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "_secs",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "stateMutability": "view"
    }
];
const ABI_CODEHASH_IS_CACHED = [
  {
    "type": "function",
    "name": "codehashIsCached",
    "inputs": [
      {
        "name": "codehash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  }
];
const PROVIDER_URL = 'https://sepolia-rollup.arbitrum.io/rpc';

export async function checkStylusProgramTimeLeft(contractAddress: string): Promise<void> {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const contract = new ethers.Contract(ARB_WASM_CONTRACT, ABI_PROGRAM_TIME_LEFT, provider);
    try {
        await contract.programTimeLeft(contractAddress);
    } catch (err: any) {
        const errMsg = err?.error?.message || err?.reason || err?.message || String(err);
        if (errMsg.includes('ProgramNotActivated')) {
            throw new Error('ProgramNotActivated: Either the contract has not been deployed yet with cargo stylus deploy --endpoint "<YOUR_ARBITRUM_RPC_ENDPOINT>" --private-key "<YOUR_PRIVATE_KEY>" command, or it is not activated. You may try making a minor change to your contract code, redeploy it, and then try this command again.');
        }
        else {
            throw new Error('ProgramNotActivated: Either the contract has not been deployed yet with cargo stylus deploy --endpoint "<YOUR_ARBITRUM_RPC_ENDPOINT>" --private-key "<YOUR_PRIVATE_KEY>" command, or it is not activated. You may try making a minor change to your contract code, redeploy it, and then try this command again.');
        }
    }
}

export async function getContractCodeHash(contractAddress: string): Promise<string> {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
        throw new Error('No contract at that address.');
    }
    // ethers v6: use ethers.keccak256
    return ethers.keccak256(code);
}

export async function checkCodehashIsCached(codehash: string): Promise<boolean> {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const contract = new ethers.Contract(ARB_WASM_CACHE_CONTRACT, ABI_CODEHASH_IS_CACHED, provider);
    try {
        return await contract.codehashIsCached(codehash);
    } catch (err: any) {
        throw new Error('Error calling codehashIsCached: ' + (err?.message || String(err)));
    }
} 