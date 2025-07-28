import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../utils/apiClient';

export default class List extends Command {
  static description = 'Lists all cached contracts from the SmartCache system';

  static examples = [
    '$ smart-cache list',
    '$ smart-cache list --network arbitrum-sepolia',
    '$ smart-cache list --format json',
    '$ smart-cache list --network arbitrum-one --format json',
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    network: Flags.string({
      char: 'n',
      description: 'Filter by network',
      options: ['arbitrum-sepolia', 'arbitrum-one', 'arbitrum-nova', 'localhost'],
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format',
      default: 'table',
      options: ['table', 'json'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(List);
    let spinner: any;

    try {
      // Check backend connectivity
      spinner = ora('Connecting to SmartCache backend...').start();
      // const healthCheck = await apiClient.checkBackendHealth();
      // if (!healthCheck.connected) {
      //   spinner.fail();
      //   this.log(chalk.red('Error: Could not connect to the SmartCache server'));
      //   process.exit(1);
      // }
      spinner.succeed();

      // Fetch contracts from backend
      spinner = ora('Fetching cached contracts...').start();
      const result = await apiClient.listContracts(flags.network);
      
      // Debug: Log the result to see what we're getting
      if (process.env.DEBUG) {
        console.log('API Response:', JSON.stringify(result, null, 2));
      }
      
      if (!result.success) {
        spinner.fail();
        const errorMessage = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error || 'Unknown error';
        this.log(chalk.red(`Error: ${errorMessage}`));
        process.exit(1);
      }

      spinner.succeed();

      const contracts = result.contracts || [];

      if (contracts.length === 0) {
        this.log(chalk.yellow('No contracts found in cache'));
        if (flags.network) {
          this.log(chalk.hex('#87CEEB')(`Try without the --network filter or use a different network`));
        } else {
          this.log(chalk.hex('#87CEEB')('Add contracts using: smart-cache add <address> --deployed-by <deployer>'));
        }
        return;
      }

      // Display results
      if (flags.format === 'json') {
        console.log(JSON.stringify(contracts, null, 2));
        return;
      }

      // Table format
      this.log('');
      if (flags.network) {
        this.log(chalk.hex('#87CEEB')(`Cached Contracts (${flags.network}):`));
      } else {
        this.log(chalk.hex('#87CEEB')('Cached Contracts (All Networks):'));
      }
      this.log(chalk.hex('#87CEEB')('='.repeat(80)));

      contracts.forEach((contract, index) => {
        this.log(chalk.green(`${index + 1}. ${contract.contractAddress}`));
        this.log(chalk.hex('#87CEEB')(`   Network: ${contract.network}`));
        this.log(chalk.hex('#87CEEB')(`   Deployed By: ${contract.deployedBy}`));
        this.log(chalk.hex('#87CEEB')(`   Deployed At: ${new Date(contract.deployedAt).toLocaleString()}`));
        this.log(chalk.hex('#87CEEB')(`   Eviction Threshold: ${new Date(contract.evictionThresholdDate).toLocaleString()}`));
        
        if (contract.txHash) {
          this.log(chalk.hex('#87CEEB')(`   Tx Hash: ${contract.txHash}`));
        }
        
        if (contract.metadata) {
          const metadata = contract.metadata as any;
          if (metadata.name) {
            this.log(chalk.hex('#87CEEB')(`   Name: ${metadata.name}`));
          }
          if (metadata.version) {
            this.log(chalk.hex('#87CEEB')(`   Version: ${metadata.version}`));
          }
          if (metadata.description) {
            this.log(chalk.hex('#87CEEB')(`   Description: ${metadata.description}`));
          }
        }
        
        if (contract.minBidRequired) {
          this.log(chalk.hex('#87CEEB')(`   Min Bid Required: ${contract.minBidRequired} ETH`));
        }
        
        if (contract.gasSaved) {
          this.log(chalk.hex('#87CEEB')(`   Gas Saved: ${contract.gasSaved}`));
        }
        
        if (index < contracts.length - 1) {
          this.log('');
        }
      });

      this.log('');
      this.log(chalk.hex('#87CEEB')(`Total: ${contracts.length} contract${contracts.length === 1 ? '' : 's'}`));
      
    } catch (error: any) {
      if (spinner) spinner.fail();
      
      let errorMessage = 'An unexpected error occurred';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      this.log(chalk.red(`Error: ${errorMessage}`));
      
      if (error.code === 'ECONNREFUSED') {
        this.log(chalk.yellow('Please ensure the SmartCache backend service is running.'));
      }
      
      process.exit(1);
    }
  }
} 