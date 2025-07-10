import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import ProgressBar from 'progress';
import { ContractRecord } from '../config/database';
import { normalizeAddress, validateNetwork, validateContractDeploymentOnNetwork } from '../utils/validation';
import { checkStylusProgramTimeLeft, getContractCodeHash, checkCodehashIsCached } from '../utils/stylusSystemContract';
import { placeBid, PlaceBidApiResponse } from '../utils/bidApiClient';
import { apiClient } from '../utils/apiClient';

export default class Add extends Command {
  static description = 'Checks deployment of a contract on arbitrum-sepolia, places a bid if none exists, caches for future bids, and monitors eviction events';

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

    // Step: Validate required parameters
    if (!flags['deployed-by'] || typeof flags['deployed-by'] !== 'string' || !flags['deployed-by'].trim()) {
      this.log(chalk.red('Error: The --deployed-by flag is required and must be a valid deployer wallet address'));
      this.log(chalk.blue('Usage: smart-cache add <CONTRACT_ADDRESS> --deployed-by <DEPLOYER_WALLET_ADDRESS>'));
      process.exit(1);
    }

    let contractAddress: string;
    let spinner: any;

    try {
      // Step: Validate and normalize the contract address
      try {
        contractAddress = normalizeAddress(args.address);
      } catch (err: any) {
        this.log(chalk.red(`Error: Invalid contract address: ${args.address}`));
        process.exit(1);
      }
      
      // Step: Validate network
      if (!validateNetwork(flags.network)) {
        this.log(chalk.red(`Error: Invalid network: ${flags.network}`));
        process.exit(1);
      }

      spinner = ora('Validating contract deployment...').start();
      
      try {
        await validateContractDeploymentOnNetwork(contractAddress, flags.network, flags['deployed-by']);
        spinner.succeed();
        this.log(chalk.blue(`Valid contract address: ${contractAddress}`));
      } catch (err: any) {
        spinner.fail();
        this.log(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }

      // Step: Check Stylus program status for arbitrum-sepolia
      if (flags.network === 'arbitrum-sepolia') {
        spinner = ora('Checking Stylus program status...').start();
        try {
          await checkStylusProgramTimeLeft(contractAddress);
          spinner.succeed();
        } catch (err: any) {
          spinner.fail();
          this.log(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
      }

      // Step: Verify deployer address with backend API (Alchemy verification)
      this.log(chalk.blue('Verifying deployer address'));
      const deployerProgress = new ProgressBar('  Deployer verification [:bar] :percent :etas', {
        complete: '█',
        incomplete: '░',
        width: 30,
        total: 100
      });

      let progressInterval: NodeJS.Timeout | undefined;
      try {
        // Simulate progress for deployer check
        let progress = 0;
        progressInterval = setInterval(() => {
          if (progress < 90) {
            progress += 10;
            deployerProgress.tick(10);
          }
        }, 200);

        const deployerResult = await apiClient.verifyDeployer(contractAddress, flags['deployed-by'], flags.network);
        
        if (progressInterval) clearInterval(progressInterval);
        deployerProgress.update(1);
        
        if (!deployerResult.success) {
          this.log(chalk.red(`Error: ${deployerResult.error}`));
          process.exit(1);
        }
        
        this.log(chalk.green('✅ Deployer verification completed successfully'));
      } catch (err: any) {
        if (progressInterval) clearInterval(progressInterval);
        this.log(chalk.red('Error: Could not connect to the SmartCache server'));
        process.exit(1);
      }

      // Step: Get contract code hash and check if cached
      spinner = ora('Fetching contract code hash...').start();
      let codehash = '';
      try {
        codehash = await getContractCodeHash(contractAddress);
        spinner.succeed();
      } catch (err: any) {
        spinner.fail();
        this.log(chalk.red(`Error: Failed to fetch code hash: ${err.message}`));
        process.exit(1);
      }

      // Step: Check if bid already placed and place bid if necessary
      let bidAlreadyPlaced = false;
      let bidApiResult: PlaceBidApiResponse | null = null;
      
      spinner = ora('Checking if bid already placed...').start();
      try {
        const isCached = await checkCodehashIsCached(codehash);
        spinner.succeed();
        
        if (isCached) {
          bidAlreadyPlaced = true;
          this.log(chalk.yellow('Warning: You have already placed a bid'));
          this.log(chalk.blue('We\'re adding this contract to our monitoring list for eviction events and future bids, ensuring efficient gas savings and preventing contract eviction over time'));
        } else {
          this.log(chalk.blue('You have not placed a bid yet. Placing bid on your behalf and adding contract to cache database. We will monitor for eviction events and place future bids, ensuring efficient gas savings and preventing contract eviction over time'));
          
          // Step: Place bid with retry logic and progress bar
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount <= maxRetries) {
            this.log(chalk.blue(`🔄 Placing bid (attempt ${retryCount + 1}/${maxRetries + 1})...`));
            
            const bidProgress = new ProgressBar('  Bid placement [:bar] :percent :etas', {
              complete: '█',
              incomplete: '░',
              width: 30,
              total: 100
            });

            let bidProgressInterval: NodeJS.Timeout | undefined;
            try {
              // Simulate progress for bid placement
              let bidProgressCount = 0;
              bidProgressInterval = setInterval(() => {
                if (bidProgressCount < 85) {
                  bidProgressCount += 15;
                  bidProgress.tick(15);
                }
              }, 300);

              bidApiResult = await placeBid(contractAddress);
              
              if (bidProgressInterval) clearInterval(bidProgressInterval);
              bidProgress.update(1);
              this.log(chalk.green('✅ Bid placement successful'));
              break;
            } catch (err: any) {
              if (bidProgressInterval) clearInterval(bidProgressInterval);
              
              if (retryCount < maxRetries) {
                this.log(chalk.yellow(`Warning: Bid placement failed, retrying in 5 seconds... (${err.message})`));
                await new Promise(resolve => setTimeout(resolve, 5000));
                retryCount++;
              } else {
                this.log(chalk.red(`Error: Failed to place bid after ${maxRetries + 1} attempts: ${err.message}`));
                process.exit(1);
              }
            }
          }
        }
      } catch (err: any) {
        spinner.fail();
        this.log(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }

      // Step: Prepare contract data for database storage
      // Convert UTC to IST (UTC + 5:30 hours)
      const nowUTC = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const nowIST = new Date(nowUTC.getTime() + istOffset);
      const evictionThresholdIST = new Date(nowIST.getTime() + (364 * 24 * 60 * 60 * 1000)); // Add 364 days

      let contractData: Omit<ContractRecord, '_id'> = {
        contractAddress,
        deployedBy: flags['deployed-by'],
        network: flags.network,
        minBidRequired: bidApiResult?.minBidRequired,
        gasSaved: bidApiResult?.gasSaved,
        gasUsed: bidApiResult?.gasUsed,
        txHash: bidApiResult?.txHash,
        deployedAt: nowIST,
        evictionThresholdDate: evictionThresholdIST,
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
          this.log(chalk.yellow(`Warning: Invalid JSON in metadata, ignoring: ${flags.metadata}`));
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

      // Step: Save to database via backend API
      spinner = ora('Saving contract to cache...').start();
      try {
        const storeResult = await apiClient.storeContract(contractData);
        
        if (!storeResult.success) {
          spinner.fail();
          // Check if it's a "contract already exists" error
          if (storeResult.error && storeResult.error.includes('already exists')) {
            this.log(chalk.yellow('Warning: Contract already exists in cache'));
            this.log(chalk.blue('Use "smart-cache list" to view cached contracts'));
            process.exit(1);
          } else {
            this.log(chalk.red('Error: Service is currently unavailable'));
            process.exit(1);
          }
        }
        
        spinner.succeed();
      } catch (err: any) {
        spinner.fail();
        this.log(chalk.red('Error: Service is currently unavailable'));
        process.exit(1);
      }

      // Step: Display contract details summary
      this.log('');
      this.log(chalk.blue('Contract Details:'));
      this.log(chalk.blue(`   Address: ${contractAddress}`));
      this.log(chalk.blue(`   Network: ${flags.network}`));
      this.log(chalk.blue(`   Deployed By: ${contractData.deployedBy}`));
      
      if (contractData.txHash) {
        this.log(chalk.blue(`   Tx Hash: ${contractData.txHash}`));
      }
      
      if (contractData.metadata?.name) {
        this.log(chalk.blue(`   Name: ${contractData.metadata.name}`));
      }
      
      if (contractData.metadata?.version) {
        this.log(chalk.blue(`   Version: ${contractData.metadata.version}`));
      }

      this.log('');
      this.log(chalk.green('✅ The Stylus contract is now cached and accessible globally'));

    } catch (error: any) {
      if (error.message.includes('already exists')) {
        this.log(chalk.yellow('Warning: Contract already exists in cache'));
        this.log(chalk.blue('Use "smart-cache list" to view cached contracts'));
      } else if (error.message.includes('Unable to connect to SmartCache backend')) {
        this.log(chalk.red('Error: Service is currently unavailable'));
      } else {
        this.log(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  }
} 