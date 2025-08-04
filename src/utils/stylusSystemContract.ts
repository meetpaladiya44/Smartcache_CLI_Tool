import { ethers } from 'ethers';

const ARB_WASM_CONTRACT = '0x0000000000000000000000000000000000000071';
const ARB_WASM_CACHE_CONTRACT = '0x0000000000000000000000000000000000000072';
const CACHE_MANAGER_CONTRACT_SEPOLIA = '0x0C9043D042aB52cFa8d0207459260040Cca54253';
const CACHE_MANAGER_CONTRACT_MAINNET = '0x51dEDBD2f190E0696AFbEE5E60bFdE96d86464ec';

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
const ABI_GET_MIN_BID_CACHE_MANAGER = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "program",
                "type": "address"
            }
        ],
        "name": "getMinBid",
        "outputs": [
            {
                "internalType": "uint192",
                "name": "min",
                "type": "uint192"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
const ABI_PROGRAM_GAS_INIT_CACHE_MANAGER = [
    {
      "type": "function",
      "name": "programInitGas",
      "inputs": [
        {
          "name": "program",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "gas",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "gasWhenCached",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    }
  ]
  

const PROVIDER_URL_SEPOLIA = 'https://sepolia-rollup.arbitrum.io/rpc';
const PROVIDER_URL_MAINNET = 'https://arb1.arbitrum.io/rpc';

export async function checkStylusProgramTimeLeft(contractAddress: string, network: string): Promise<void> {
    const providerUrl = network === 'arbitrum-one' ? PROVIDER_URL_MAINNET : PROVIDER_URL_SEPOLIA;
    const provider = new ethers.JsonRpcProvider(providerUrl);
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
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL_SEPOLIA);
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
        throw new Error('No contract at that address.');
    }
    // ethers v6: use ethers.keccak256
    return ethers.keccak256(code);
}

export async function checkCodehashIsCached(codehash: string): Promise<boolean> {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL_SEPOLIA);
    const contract = new ethers.Contract(ARB_WASM_CACHE_CONTRACT, ABI_CODEHASH_IS_CACHED, provider);
    try {
        return await contract.codehashIsCached(codehash);
    } catch (err: any) {
        throw new Error('Error calling codehashIsCached: ' + (err?.message || String(err)));
    }
}

export async function getProgramGasInit(contractAddress: string, network: string): Promise<{ gas: string; gasWhenCached: string; gasSaved: string }> {
    const providerUrl = network === 'arbitrum-one' ? PROVIDER_URL_MAINNET : PROVIDER_URL_SEPOLIA;
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(ARB_WASM_CONTRACT, ABI_PROGRAM_GAS_INIT_CACHE_MANAGER, provider);

    try {
        const result = await contract.programInitGas(contractAddress);
        const gas = result[0].toString();
        const gasWhenCached = result[1].toString();
        const gasSaved = (BigInt(gas) - BigInt(gasWhenCached)).toString();

        return { gas, gasWhenCached, gasSaved };
    } catch (err: any) {
        throw new Error('Error calling programInitGas: ' + (err?.message || String(err)));
    }
}

export async function getMinBid(contractAddress: string, network: string): Promise<string> {
    const providerUrl = network === 'arbitrum-one' ? PROVIDER_URL_MAINNET : PROVIDER_URL_SEPOLIA;
    const cacheManagerAddress = network === 'arbitrum-one' ? CACHE_MANAGER_CONTRACT_MAINNET : CACHE_MANAGER_CONTRACT_SEPOLIA;
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(cacheManagerAddress, ABI_GET_MIN_BID_CACHE_MANAGER, provider);

    try {
        const result = await contract.getMinBid(contractAddress);
        return ethers.formatEther(result);
    } catch (err: any) {
        throw new Error('Error calling getMinBid: ' + (err?.message || String(err)));
    }
} 