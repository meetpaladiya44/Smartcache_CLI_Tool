import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import { DatabaseConfig, ContractRecord } from '../config/database';
import { normalizeAddress, validateNetwork, validateContractDeploymentOnNetwork } from '../utils/validation';
import { checkStylusProgramTimeLeft } from '../utils/stylusSystemContract';
import { checkDeployerWithAlchemy } from '../utils/alchemyDeployerCheck';

export default class Add extends Command {
  static description = 'Add a deployed Stylus contract address to the cache database';

  static examples = [
    '$ smart-cache add 0x1234567890abcdef1234567890abcdef12345678',
    '$ smart-cache add 0x1234... --network arbitrum-sepolia',
    '$ smart-cache add 0x1234... --tx-hash 0xabcd... --name "MyContract"',
    '$ smart-cache add 0x1234... --metadata \'{"name":"Counter","version":"1.0.0"}\'',
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    network: Flags.string({
      char: 'n',
      description: 'Network where the contract is deployed',
      default: 'arbitrum-sepolia',
      options: ['arbitrum-sepolia', 'arbitrum-one', 'arbitrum-nova', 'localhost'],
    }),
    'tx-hash': Flags.string({
      char: 't',
      description: 'Transaction hash of the deployment',
    }),
    name: Flags.string({
      description: 'Name of the contract (optional)',
    }),
    description: Flags.string({
      char: 'd',
      description: 'Description of the contract (optional)',
    }),
    version: Flags.string({
      char: 'v',
      description: 'Version of the contract (optional)',
    }),
    'deployed-by': Flags.string({
      description: 'Address of the deployer (required)',
    }),
    metadata: Flags.string({
      char: 'm',
      description: 'Additional metadata as JSON string (optional)',
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode to input additional details',
      default: false,
    }),
  };

  static args = {
    address: Args.string({
      description: 'Contract address to cache',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Add);

    // Robust manual check for required deployer address
    if (!flags['deployed-by'] || typeof flags['deployed-by'] !== 'string' || !flags['deployed-by'].trim()) {
      this.error(
        'The --deployed-by flag is required and must be a valid deployer wallet address.\n' +
        'Usage: smart-cache add <CONTRACT_ADDRESS> --deployed-by <DEPLOYER_WALLET_ADDRESS>'
      );
    }    

    try {
      // Validate and normalize the contract address
      const contractAddress = normalizeAddress(args.address);
      
      // Validate network
      if (!validateNetwork(flags.network)) {
        this.error(`Error: Invalid network: ${flags.network}`);
      }
      // Validate contract deployment and deployer address on selected network
      this.log(`Checking contract deployment on network: ${flags.network}...`);
      try {
        await validateContractDeploymentOnNetwork(contractAddress, flags.network, flags['deployed-by']);
      } catch (err: any) {
        this.error(err.message);
      }
      this.log(`Valid contract address: ${contractAddress}`);

      // Call programTimeLeft on Stylus system contract for arbitrum-sepolia
      if (flags.network === 'arbitrum-sepolia') {
        try {
          await checkStylusProgramTimeLeft(contractAddress);
        } catch (err: any) {
          this.error(err.message);
        }
      }
      // Check deployer address matches actual contract deployer using Alchemy
      const alchemyApiKey = process.env.ALCHEMY_API_KEY || '';
      if (!alchemyApiKey) {
        this.error('Alchemy API key is required. Please set ALCHEMY_API_KEY in your environment.');
      }
      try {
        await checkDeployerWithAlchemy(contractAddress, flags['deployed-by'], flags.network, alchemyApiKey);
      } catch (err: any) {
        this.error(err.message);
      }

      // Initialize database connection
      const db = new DatabaseConfig();
      await db.connect();

      try {
        let contractData: Omit<ContractRecord, '_id'> = {
          contractAddress,
          network: flags.network,
          deployedAt: new Date(),
        };

        // Add optional fields from flags
        if (flags['tx-hash']) contractData.txHash = flags['tx-hash'];
        contractData.deployedBy = flags['deployed-by'];

        // Handle metadata
        let metadata: any = {};
        if (flags.name) metadata.name = flags.name;
        if (flags.description) metadata.description = flags.description;
        if (flags.version) metadata.version = flags.version;

        // Parse additional metadata from JSON if provided
        if (flags.metadata) {
          try {
            const additionalMetadata = JSON.parse(flags.metadata);
            metadata = { ...metadata, ...additionalMetadata };
          } catch (error) {
            this.warn(`Warning: Invalid JSON in metadata, ignoring: ${flags.metadata}`);
          }
        }

        if (Object.keys(metadata).length > 0) {
          contractData.metadata = metadata;
        }

        // Interactive mode for additional information
        if (flags.interactive) {
          const responses = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Contract name (optional):',
              when: !flags.name,
            },
            {
              type: 'input',
              name: 'description',
              message: 'Contract description (optional):',
              when: !flags.description,
            },
            {
              type: 'input',
              name: 'version',
              message: 'Contract version (optional):',
              when: !flags.version,
            },
            {
              type: 'input',
              name: 'txHash',
              message: 'Deployment transaction hash (optional):',
              when: !flags['tx-hash'],
            },
            {
              type: 'input',
              name: 'deployedBy',
              message: 'Deployer address (required):',
              when: !flags['deployed-by'],
              validate: (input: string) => input ? true : 'Deployer address is required.'
            },
          ]);

          // Update contract data with interactive responses
          if (responses.name || responses.description || responses.version) {
            contractData.metadata = {
              ...contractData.metadata,
              ...(responses.name && { name: responses.name }),
              ...(responses.description && { description: responses.description }),
              ...(responses.version && { version: responses.version }),
            };
          }

          if (responses.txHash) contractData.txHash = responses.txHash;
          if (responses.deployedBy) contractData.deployedBy = responses.deployedBy;
        }

        this.log(`Saving contract to cache database...`);

        // Save to database
        const recordId = await db.addContract(contractData);

        this.log(`Contract successfully added to cache.`);
        this.log('');
        this.log('Contract Details:');
        this.log(`   Address: ${contractAddress}`);
        this.log(`   Network: ${flags.network}`);
        this.log(`   Deployed By: ${contractData.deployedBy}`);
        this.log(`   Record ID: ${recordId}`);
        
        if (contractData.txHash) {
          this.log(`   Tx Hash: ${contractData.txHash}`);
        }
        
        if (contractData.metadata?.name) {
          this.log(`   Name: ${contractData.metadata.name}`);
        }
        
        if (contractData.metadata?.version) {
          this.log(`   Version: ${contractData.metadata.version}`);
        }

        this.log('');
        this.log('The Stylus contract is now cached and accessible globally.');

      } finally {
        await db.disconnect();
      }

    } catch (error: any) {
      if (error.message.includes('already exists')) {
        this.log('Warning: Contract already exists in cache.');
        this.log('Use "smart-cache list" to view cached contracts.');
      } else if (error.message.includes('MONGODB_URI')) {
        this.error('Error: MongoDB connection not configured.\nPlease set the MONGODB_URI environment variable.\nCreate a .env file with: MONGODB_URI=your_mongodb_connection_string');
      } else {
        this.error(error.message);
      }
    }
  }
} 