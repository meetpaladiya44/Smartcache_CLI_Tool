import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import ProgressBar from 'progress';
import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import { ContractRecord } from '../config/database';
import { normalizeAddress, validateNetwork, validateContractDeploymentOnNetwork } from '../utils/validation';
import { checkStylusProgramTimeLeft, getProgramGasInit, getMinBid } from '../utils/stylusSystemContract';
import { placeBid, PlaceBidApiResponse } from '../utils/bidApiClient';
import { apiClient } from '../utils/apiClient';

// Define the structure of your TOML configuration
interface SmartCacheConfig {
  network?: string;
  deployed_by?: string;
  interactive?: boolean;
  name?: string;
  description?: string;
  version?: string;
  metadata?: any;
  contract_address?: string; // NEW: Allow contract address in TOML
}

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
      description: 'Contract address to cache (optional if specified in smartcache.toml)',
      required: false,
    }),
  };

  private validateTomlConfig(config: SmartCacheConfig): void {
    const validNetworks = ['arbitrum-sepolia', 'arbitrum-one', 'arbitrum-nova', 'localhost'];
    
    if (config.network && !validNetworks.includes(config.network)) {
      throw new Error(`validation: Invalid network "${config.network}". Valid options: ${validNetworks.join(', ')}`);
    }
    
    if (config.deployed_by && !/^0x[a-fA-F0-9]{40}$/.test(config.deployed_by)) {
      throw new Error(`validation: Invalid deployed_by address format "${config.deployed_by}"`);
    }
    
    if (config.contract_address && !/^0x[a-fA-F0-9]{40}$/.test(config.contract_address)) {
      throw new Error(`validation: Invalid contract_address format "${config.contract_address}"`);
    }
  }

  // private logConfigValues(config: SmartCacheConfig): void {
  //   const configItems: string[] = [];
    
  //   if (config.network) configItems.push(`network: ${config.network}`);
  //   if (config.deployed_by) configItems.push(`deployed_by: ${config.deployed_by.substring(0, 10)}...`);
  //   if (config.contract_address) configItems.push(`contract_address: ${config.contract_address.substring(0, 10)}...`);
    
  //   if (configItems.length > 0) { 
  //     this.log(chalk.hex('#87CEEB')(`   Loading: ${configItems.join(', ')}`));
  //   }
  // }
  
  // Method to load and parse TOML configuration
  private loadConfig(): SmartCacheConfig | null {
    const configPath = path.join(process.cwd(), 'smartcache.toml');
    
    try {
      if (!fs.existsSync(configPath)) {
        return null;
      }
  
      this.log(chalk.hex('#87CEEB')('📄 Found smartcache.toml configuration file'));
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = toml.parse(configContent) as SmartCacheConfig;
      
      // Log what we're reading from config (without validation yet)
      // this.logConfigValues(config);
      
      return config;
    } catch (error: any) {
      this.log(chalk.yellow('Warning: Could not parse smartcache.toml, using command line options'));
      return null;
    }
  }

  // Method to merge config file values with command line flags
  private mergeConfigWithFlags(config: SmartCacheConfig | null, flags: any): any {
    if (!config) return flags;
  
    const mergedFlags = { ...flags };
  
    // Only use config values if the corresponding flag is not provided
    if (!flags.network && config.network) {
      mergedFlags.network = config.network;
    }
  
    if (!flags['deployed-by'] && config.deployed_by) {
      mergedFlags['deployed-by'] = config.deployed_by;
    }
  
    if (flags.interactive === false && config.interactive !== undefined) {
      mergedFlags.interactive = config.interactive;
    }
  
    if (!flags.name && config.name) {
      mergedFlags.name = config.name;
    }
  
    if (!flags.description && config.description) {
      mergedFlags.description = config.description;
    }
  
    if (!flags.version && config.version) {
      mergedFlags.version = config.version;
    }
  
    if (!flags.metadata && config.metadata) {
      mergedFlags.metadata = JSON.stringify(config.metadata);
    }
  
    return mergedFlags;
  }

  private validateRequiredInputs(args: any, mergedFlags: any, config: SmartCacheConfig | null): string {
    // Contract address validation - CLI argument has highest priority
    let contractAddress = args.address;
    
    if (!contractAddress && config?.contract_address) {
      // Only validate TOML config when we actually need to use it
      try {
        this.validateTomlConfig(config);
        contractAddress = config.contract_address;
      } catch (error: any) {
        this.log(chalk.red(`Error in smartcache.toml: ${error.message}`));
        this.log(chalk.hex('#87CEEB')('Solutions:'));
        this.log(chalk.hex('#87CEEB')('  1. Provide as argument: smart-cache add <CONTRACT_ADDRESS>'));
        this.log(chalk.hex('#87CEEB')('  2. Fix the contract_address in smartcache.toml'));
        this.showConfigTip();
        process.exit(1);
      }
    }
    
    if (!contractAddress) {
      this.log(chalk.red('Error: Contract address is required'));
      this.log(chalk.hex('#87CEEB')('Solutions:'));
      this.log(chalk.hex('#87CEEB')('  1. Provide as argument: smart-cache add <CONTRACT_ADDRESS>'));
      this.log(chalk.hex('#87CEEB')('  2. Add to smartcache.toml: contract_address = "0x..."'));
      
      // Show helpful tip after the error
      this.showConfigTip();
      process.exit(1);
    }
  
    // Deployer address validation
    if (!mergedFlags['deployed-by']) {
      this.log(chalk.red('Error: Deployer address is required'));
      this.log(chalk.hex('#87CEEB')('Solutions:'));
      this.log(chalk.hex('#87CEEB')('  1. Use flag: --deployed-by <DEPLOYER_ADDRESS>'));
      this.log(chalk.hex('#87CEEB')('  2. Add to smartcache.toml: deployed_by = "0x..."'));
      
      // Show helpful tip after the error
      this.showConfigTip();
      process.exit(1);
    }
  
    return contractAddress;
  }

  private showConfigTip(): void {
    const configPath = path.join(process.cwd(), 'smartcache.toml');
    
    if (!fs.existsSync(configPath)) {
      this.log(''); // Empty line for better readability
      this.log(chalk.yellow('💡 Tip: No smartcache.toml found in current directory'));
      this.log(chalk.hex('#87CEEB')('   Run "smart-cache init" to create a configuration file'));
      this.log(chalk.hex('#87CEEB')('   This will make future commands easier to use'));
    }
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Add);

    // Load TOML configuration and merge with flags
    const config = this.loadConfig();
    const mergedFlags = this.mergeConfigWithFlags(config, flags);

    // Validate required inputs and get final contract address
    const finalContractAddress = this.validateRequiredInputs(args, mergedFlags, config);

  let contractAddress: string;
  let spinner: any;

    try {
      // Step: Validate and normalize the contract address
      try {
        contractAddress = normalizeAddress(finalContractAddress);
      } catch (err: any) {
        this.log(chalk.red(`Error: Invalid contract address: ${finalContractAddress}`));
        process.exit(1);
      }
      
      // Step: Validate network
      if (!validateNetwork(mergedFlags.network)) {
        this.log(chalk.red(`Error: Invalid network: ${mergedFlags.network}`));
        process.exit(1);
      }

      spinner = ora('Validating contract deployment...').start();
      
      try {
        await validateContractDeploymentOnNetwork(contractAddress, mergedFlags.network, mergedFlags['deployed-by']);
        spinner.succeed();
        this.log(chalk.hex('#87CEEB')(`Valid contract address: ${contractAddress}`));
      } catch (err: any) {
        spinner.fail();
        this.log(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }

      // // Step: Check user registration and balance status
      // spinner = ora('Checking user registration and balance...').start();
      // try {
      //   const userCheckResult = await apiClient.checkUser(mergedFlags['deployed-by'], mergedFlags.network);
        
      //   if (!userCheckResult.success) {
      //     spinner.fail();
      //     this.log(chalk.red(`Error: ${userCheckResult.error}`));
      //     this.log(chalk.hex('#87CEEB')('Solutions:'));
      //     this.log(chalk.hex('#87CEEB')('  1. Check your internet connection or try again in a few moments'));
      //     process.exit(1);
      //   }

      //   if (!userCheckResult.user) {
      //     spinner.fail();
      //     this.log(chalk.red('Error: You are not registered with SmartCache'));
      //     this.log(chalk.hex('#87CEEB')('Solutions:'));
      //     this.log(chalk.hex('#87CEEB')('  1. Visit SmartCache (https://stylus-cache-manager.vercel.app/) to register'));
      //     this.log(chalk.hex('#87CEEB')('  2. Connect with MetaMask using the same deployer address to register yourself on SmartCache platform'));
      //     this.log(chalk.hex('#87CEEB')('  3. Run this command again after successful registration and balance addition'));
      //     process.exit(1);
      //   }

      //   if (!userCheckResult.balance) {
      //     spinner.fail();
      //     this.log(chalk.red(`Error: Insufficient balance in SmartCache for ${mergedFlags.network} network`));
      //     this.log(chalk.hex('#87CEEB')('Solutions:'));
      //     this.log(chalk.hex('#87CEEB')('  1. Add required balance to your SmartCache (https://stylus-cache-manager.vercel.app/) account'));
      //     this.log(chalk.hex('#87CEEB')('  2. Run this command again after adding balance'));
      //     process.exit(1);
      //   }

      //   spinner.succeed();
      //   this.log(chalk.hex('#87CEEB')('✅ User registered and balance verified'));
      // } catch (err: any) {
      //   spinner.fail();
      //   this.log(chalk.red('Error: Could not connect to the SmartCache server for user verification'));
      //   this.log(chalk.hex('#87CEEB')('Solutions:'));
      //   this.log(chalk.hex('#87CEEB')('  1. Check your internet connection or try again in a few moments'));
      //   this.log(chalk.hex('#87CEEB')('  2. Contact support if the issue persists'));
      //   process.exit(1);
      // }

      // Step: Check Stylus program status for arbitrum-sepolia
      if (mergedFlags.network === 'arbitrum-sepolia') {
        spinner = ora('Checking Stylus program status...').start();
        try {
          await checkStylusProgramTimeLeft(contractAddress, mergedFlags.network);
          spinner.succeed();
        } catch (err: any) {
          spinner.fail();
          this.log(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
      }

      // Step: Verify deployer address with backend API (Alchemy verification)
      this.log(chalk.hex('#87CEEB')('Verifying deployer address'));
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

        const deployerResult = await apiClient.verifyDeployer(contractAddress, mergedFlags['deployed-by'], mergedFlags.network);
        
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

      // Step: Place bid with retry logic and progress bar
      let bidAlreadyPlaced = false;
      let bidApiResult: PlaceBidApiResponse | null = null;
      
      this.log('');
      this.log(chalk.hex('#87CEEB')('Placing bid on your behalf and adding contract to cache database. We will monitor for eviction events and place future bids, ensuring efficient gas savings and preventing contract eviction over time'));
      
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        this.log(chalk.hex('#87CEEB')(`🔄 Placing bid (attempt ${retryCount + 1}/${maxRetries + 1})...`));
        
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

          // Make the API call
          bidApiResult = await placeBid(contractAddress, mergedFlags.network);
          
          // Ensure progress bar shows meaningful progress before completing
          // Wait for at least 60% progress or 600ms, whichever comes first
          const startTime = Date.now();
          while (bidProgressCount < 60 && (Date.now() - startTime) < 600) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Complete the progress bar to 100%
          if (bidProgressInterval) clearInterval(bidProgressInterval);
          bidProgress.update(1);
          
          this.log(chalk.green('✅ Bid placement successful'));
          
          // Display ROI Analysis and Gas Savings data
          if (bidApiResult.roiAnalysis || bidApiResult.gasSaved || bidApiResult.gasSavingsPercentage) {
            this.log('');
            this.log(chalk.hex('#87CEEB')('Bid Analysis:'));
            
            if (bidApiResult.roiAnalysis) {
              this.log(chalk.hex('#87CEEB')(`   Bid Placement Reason: ${bidApiResult.roiAnalysis.reason}`));
              const roiValue = parseFloat(bidApiResult.roiAnalysis.marketBidEth) - parseFloat(bidApiResult.roiAnalysis.minBidEth);
              this.log(chalk.hex('#87CEEB')(`   ROI: ${roiValue} ETH/contract call`));
              this.log(chalk.hex('#87CEEB')(`   Minimum Bid: ${bidApiResult.roiAnalysis.minBidEth} ETH`));
              this.log(chalk.hex('#87CEEB')(`   Market Bid: ${bidApiResult.roiAnalysis.marketBidEth} ETH`));
            }
            
            if (bidApiResult.gasSaved || bidApiResult.gasSavingsPercentage) {
              if (bidApiResult.gasSaved) {
                this.log(chalk.hex('#87CEEB')(`   Gas Saved: ${bidApiResult.gasSaved} units`));
              }
              if (bidApiResult.gasSavingsPercentage) {
                this.log(chalk.hex('#87CEEB')(`   Savings Percentage: ${bidApiResult.gasSavingsPercentage}%`));
              }
              if (bidApiResult.gasUsed) {
                this.log(chalk.hex('#87CEEB')(`   Gas Used: ${bidApiResult.gasUsed} units`));
              }
            }
          }
          
          break;
        } catch (err: any) {
          // Complete the progress bar to 100% before showing any error messages
          if (bidProgressInterval) clearInterval(bidProgressInterval);
          bidProgress.update(1);
          
          // Check if it's the "execution reverted" error (bid already placed)
          if (err.message.includes('execution reverted')) {
            bidAlreadyPlaced = true;
            this.log('');
            this.log(chalk.yellow('Warning: You have already placed a bid'));
            this.log(chalk.hex('#87CEEB')('We\'re adding this contract to our monitoring list for eviction events and future bids, ensuring efficient gas savings and preventing contract eviction over time'));
            
            // Get gas analysis and minimum bid data
            try {
              const gasData = await getProgramGasInit(contractAddress, mergedFlags.network);
              const minBid = await getMinBid(contractAddress, mergedFlags.network);
              
              // Display Bid Analysis for warning case
              this.log('');
              this.log(chalk.hex('#87CEEB')('Bid Analysis:'));
              this.log(chalk.hex('#87CEEB')(`   Gas When Cached: ${gasData.gasWhenCached} units`));
              this.log(chalk.hex('#87CEEB')(`   Gas When Not Cached: ${gasData.gas} units`));
              this.log(chalk.hex('#87CEEB')(`   Gas Savings: ${gasData.gasSaved} units`));
              
              // Store the data for MongoDB
              bidApiResult = {
                success: false,
                minBidRequired: minBid,
                gasSaved: gasData.gasSaved
              };
            } catch (gasErr: any) {
              this.log(chalk.yellow(`Warning: Could not fetch gas analysis: ${gasErr.message}`));
            }
            
            break;
          }
          
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
      

      // Step: Prepare contract data for database storage
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.getTime());
      const evictionThresholdIST = new Date(nowIST.getTime() + (364 * 24 * 60 * 60 * 1000)); // Add 364 days

      let contractData: Omit<ContractRecord, '_id'> = {
        contractAddress,
        deployedBy: mergedFlags['deployed-by'],
        network: mergedFlags.network,
        minBidRequired: bidApiResult?.minBidRequired,
        gasSaved: bidApiResult?.gasSaved,
        gasUsed: bidApiResult?.gasUsed,
        txHash: bidApiResult?.txHash,
        deployedAt: nowIST,
        evictionThresholdDate: evictionThresholdIST,
        byCLI: true,
      };

      // Add optional fields from flags
      if (mergedFlags['tx-hash']) contractData.txHash = mergedFlags['tx-hash'];
      contractData.deployedBy = mergedFlags['deployed-by'];

      // Handle metadata
      let metadata: any = {};
      if (mergedFlags.name) metadata.name = mergedFlags.name;
      if (mergedFlags.description) metadata.description = mergedFlags.description;
      if (mergedFlags.version) metadata.version = mergedFlags.version;

      // Parse additional metadata from JSON if provided
      if (mergedFlags.metadata) {
        try {
          const additionalMetadata = JSON.parse(mergedFlags.metadata);
          metadata = { ...metadata, ...additionalMetadata };
        } catch (error) {
          this.log(chalk.yellow(`Warning: Invalid JSON in metadata, ignoring: ${mergedFlags.metadata}`));
        }
      }

      if (Object.keys(metadata).length > 0) {
        contractData.metadata = metadata;
      }

      // Add ROI analysis data to metadata if available
      if (bidApiResult?.roiAnalysis) {
        if (!contractData.metadata) {
          contractData.metadata = {};
        }
        contractData.metadata.roiAnalysis = bidApiResult.roiAnalysis;
      }

      // Interactive mode for additional information
      if (mergedFlags.interactive) {
        const responses = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Contract name (optional):',
            when: !mergedFlags.name,
          },
          {
            type: 'input',
            name: 'description',
            message: 'Contract description (optional):',
            when: !mergedFlags.description,
          },
          {
            type: 'input',
            name: 'version',
            message: 'Contract version (optional):',
            when: !mergedFlags.version,
          },
          {
            type: 'input',
            name: 'txHash',
            message: 'Deployment transaction hash (optional):',
            when: !mergedFlags['tx-hash'],
          },
          {
            type: 'input',
            name: 'deployedBy',
            message: 'Deployer address (required):',
            when: !mergedFlags['deployed-by'],
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
      this.log('');
      spinner = ora('Saving contract to cache...').start();
      try {
        const storeResult = await apiClient.storeContract(contractData);
        
        if (!storeResult.success) {
          spinner.fail();
          // Check if it's a "contract already exists" error
          if (storeResult.error && storeResult.error.includes('already exists')) {
            this.log(chalk.yellow('Warning: Contract already exists in cache'));
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
      this.log(chalk.hex('#87CEEB')('Contract Details:'));
      this.log(chalk.hex('#87CEEB')(`   Address: ${contractAddress}`));
      this.log(chalk.hex('#87CEEB')(`   Network: ${mergedFlags.network}`));
      this.log(chalk.hex('#87CEEB')(`   Deployed By: ${contractData.deployedBy}`));
      
      if (contractData.txHash) {
        this.log(chalk.hex('#87CEEB')(`   Tx Hash: ${contractData.txHash}`));
      }
      
      if (contractData.metadata?.name) {
        this.log(chalk.hex('#87CEEB')(`   Name: ${contractData.metadata.name}`));
      }
      
      if (contractData.metadata?.version) {
        this.log(chalk.hex('#87CEEB')(`   Version: ${contractData.metadata.version}`));
      }

      this.log('');
      this.log(chalk.green('✅ The Stylus contract is now cached and accessible globally'));

    } catch (error: any) {
      if (error.message.includes('already exists')) {
        this.log(chalk.yellow('Warning: Contract already exists in cache'));
      } else if (error.message.includes('Unable to connect to SmartCache backend')) {
        this.log(chalk.red('Error: Service is currently unavailable'));
      } else {
        this.log(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  }
}