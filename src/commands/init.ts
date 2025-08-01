// Create a new file: src/commands/init.ts

import { Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export default class Init extends Command {
  static description = 'Create a smartcache.toml configuration file with default settings';

  static examples = [
    '$ smart-cache init',
    '$ smart-cache init --force',
    '$ smart-cache init --interactive',
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing smartcache.toml file',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode to configure values',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const configPath = path.join(process.cwd(), 'smartcache.toml');

    // Check if config file already exists
    if (fs.existsSync(configPath) && !flags.force) {
      this.log(chalk.yellow('Warning: smartcache.toml already exists in current directory'));
      this.log(chalk.hex('#87CEEB')('Use --force to overwrite or --interactive to modify'));
      
      const { shouldOverwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldOverwrite',
          message: 'Do you want to overwrite the existing file?',
          default: false,
        },
      ]);

      if (!shouldOverwrite) {
        this.log(chalk.hex('#87CEEB')('Configuration file creation cancelled'));
        return;
      }
    }

    let configData = {
      network: 'arbitrum-sepolia',
      deployed_by: '',
      contract_address: '',
      name: '',
      description: '',
      version: '1.0.0',
      interactive: false,
    };

    // Interactive mode
    if (flags.interactive) {
      this.log(chalk.hex('#87CEEB')('Interactive configuration setup'));
      this.log(chalk.gray('Press Enter to use default values shown in brackets\n'));

      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'network',
          message: 'Select default network:',
          choices: [
            { name: 'Arbitrum Sepolia (Testnet)', value: 'arbitrum-sepolia' },
            { name: 'Arbitrum One (Mainnet)', value: 'arbitrum-one' },
            { name: 'Arbitrum Nova', value: 'arbitrum-nova' },
            { name: 'Localhost', value: 'localhost' },
          ],
          default: 'arbitrum-sepolia',
        },
        {
          type: 'input',
          name: 'deployed_by',
          message: 'Enter your default deployer wallet address:',
          validate: (input: string) => {
            if (!input.trim()) return 'Deployer address is required';
            if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
              return 'Please enter a valid Ethereum address (0x followed by 40 hex characters)';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'contract_address',
          message: 'Enter default contract address (optional):',
          validate: (input: string) => {
            if (!input.trim()) return true; // Optional field
            if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
              return 'Please enter a valid contract address (0x followed by 40 hex characters)';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'name',
          message: 'Default contract name (optional):',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Default contract description (optional):',
        },
        {
          type: 'input',
          name: 'version',
          message: 'Default contract version:',
          default: '1.0.0',
        },
        {
          type: 'confirm',
          name: 'interactive',
          message: 'Enable interactive mode by default?',
          default: false,
        },
      ]);

      configData = { ...configData, ...answers };
    }

    // Generate TOML content
    const tomlContent = this.generateTomlContent(configData, flags.interactive);

    try {
      // Write the file
      fs.writeFileSync(configPath, tomlContent, 'utf8');
      
      this.log(chalk.green('✅ Successfully created smartcache.toml'));
      this.log(chalk.hex('#87CEEB')(`Location: ${configPath}`));
      
      if (!flags.interactive) {
        this.log('');
        this.log(chalk.hex('#87CEEB')('Next steps:'));
        this.log(chalk.hex('#87CEEB')('   1. Edit smartcache.toml with your specific values'));
        this.log(chalk.hex('#87CEEB')('   2. Run: smart-cache add <CONTRACT_ADDRESS>'));
        this.log('');
        this.log(chalk.yellow('Warning: Remember to update the deployed_by address before using!'));
      } else {
        this.log('');
        this.log(chalk.hex('#87CEEB')('Configuration complete! You can now run:'));
        this.log(chalk.hex('#87CEEB')('   smart-cache add <CONTRACT_ADDRESS>'));
      }

    } catch (error: any) {
      this.log(chalk.red(`Error: Failed to create configuration file: ${error.message}`));
      process.exit(1);
    }
  }

  private generateTomlContent(data: any, isInteractive: boolean): string {
    const template = `# SmartCache Configuration File
# Generated on ${new Date().toISOString().split('T')[0]}

# Default network for contract operations
# Options: arbitrum-sepolia, arbitrum-one, arbitrum-nova, localhost
network = "${data.network}"

# Your wallet address that deployed the contracts, this is required for all operations
deployed_by = "${data.deployed_by || 'YOUR_WALLET_ADDRESS_HERE'}"

# Optional: Default contract address
# If specified, you can run 'smart-cache add' without providing an address
${data.contract_address ? `contract_address = "${data.contract_address}"` : 'contract_address = "YOUR_CONTRACT_ADDRESS_HERE"'}

# Optional: Default contract metadata
${data.name ? `name = "${data.name}"` : '# name = "MyContract"'}
${data.description ? `description = "${data.description}"` : '# description = "Contract description"'}
version = "${data.version}"

# CLI behavior settings
interactive = ${data.interactive}

# Optional: Custom metadata (add any additional fields you need)
# [metadata]
# author = "Your Name"
# license = "MIT"
# tags = ["defi", "nft"]
`;

    return template;
  }
}