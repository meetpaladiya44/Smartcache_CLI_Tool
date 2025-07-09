import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { DatabaseConfig } from '../config/database';

export default class List extends Command {
  static description = 'List all cached Stylus contract addresses';

  static examples = [
    '$ smart-cache list',
    '$ smart-cache list --network arbitrum-sepolia',
    '$ smart-cache list --format table',
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
      options: ['table', 'json'],
      default: 'table',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(List);

    try {
      // Initialize database connection
      const db = new DatabaseConfig();
      const spinner = ora('Connecting to database...').start();
      await db.connect();
      spinner.succeed();

      try {
        this.log(chalk.blue('📋 Fetching cached contracts...'));

        const contracts = await db.getAllContracts();
        
        // Filter by network if specified
        const filteredContracts = flags.network 
          ? contracts.filter(contract => contract.network === flags.network)
          : contracts;

        if (filteredContracts.length === 0) {
          this.log(chalk.yellow('⚠️  No contracts found in cache.'));
          this.log(chalk.blue('💡 Use "smart-cache add <address>" to add contracts.'));
          return;
        }

        this.log(chalk.green(`✅ Found ${filteredContracts.length} cached contract(s)`));
        this.log('');

        if (flags.format === 'json') {
          this.log(JSON.stringify(filteredContracts, null, 2));
        } else {
          // Table format
          this.log(chalk.bold('📋 Cached Stylus Contracts:'));
          this.log('');

          filteredContracts.forEach((contract, index) => {
            this.log(chalk.cyan(`${index + 1}. ${contract.contractAddress}`));
            this.log(`   Network: ${chalk.yellow(contract.network)}`);
            this.log(`   Added: ${chalk.gray(contract.deployedAt.toLocaleDateString())}`);
            
            if (contract.metadata?.name) {
              this.log(`   Name: ${chalk.magenta(contract.metadata.name)}`);
            }
            
            if (contract.metadata?.version) {
              this.log(`   Version: ${chalk.magenta(contract.metadata.version)}`);
            }
            
            if (contract.txHash) {
              this.log(`   Tx Hash: ${chalk.gray(contract.txHash.substring(0, 20) + '...')}`);
            }
            
            this.log('');
          });

          this.log(chalk.blue(`Total: ${filteredContracts.length} contract(s)`));
        }

      } finally {
        await db.disconnect();
      }

    } catch (error: any) {
      if (error.message.includes('MONGODB_URI')) {
        this.log(chalk.red('Error: MongoDB connection not configured.'));
        this.log(chalk.blue('Please set the MONGODB_URI environment variable.'));
        this.log(chalk.blue('Create a .env file with: MONGODB_URI=your_mongodb_connection_string'));
      } else {
        this.log(chalk.red(`Error: ${error.message}`));
      }
      this.exit(1);
    }
  }
} 