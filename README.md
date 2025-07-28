# Smart Cache CLI

A global CLI tool to cache deployed Arbitrum Stylus contract addresses, making them accessible from anywhere across different systems and environments.

[![npm version](https://badge.fury.io/js/smart-cache-cli.svg)](https://badge.fury.io/js/smart-cache-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Global CLI**: Access your cached contracts from any directory on any system
- **Configuration Management**: Use `smartcache.toml` files for persistent settings
- **Cloud Storage Integration**: Secure cloud-based contract storage
- **Stylus Contract Support**: Designed specifically for Arbitrum Stylus contracts
- **Network Detection**: Automatic network detection from deployment endpoints
- **Rich Metadata**: Store contract names, versions, descriptions, and more
- **Interactive Mode**: Guided prompts for additional contract information
- **Beautiful Output**: Colorized and formatted command-line interface

## 📦 Installation

### Global Installation

```bash
npm install -g smart-cache-cli
```

### Local Development

```bash
git clone <repository-url>
cd smart-cache-cli
npm install
npm run build
npm link
```

## 🔧 Usage

### Initial Setup

#### Create Configuration File

```bash
# Create a basic configuration file
smart-cache init

# Create with interactive setup
smart-cache init --interactive

# Overwrite existing configuration
smart-cache init --force
```

The `init` command creates a `smartcache.toml` file in your current directory with default settings.

### Basic Commands

#### Add a Contract

```bash
# Basic usage with CLI arguments
smart-cache add 0x1234567890abcdef1234567890abcdef12345678

# Using configuration file (no arguments needed if configured)
smart-cache add

# With network specification
smart-cache add 0x1234567890abcdef1234567890abcdef12345678 --network arbitrum-sepolia

# With metadata
smart-cache add 0x1234567890abcdef1234567890abcdef12345678 \
  --name "MyCounter" \
  --description "A simple counter contract" \
  --version "1.0.0" \
  --tx-hash 0xabcd1234...

# Interactive mode
smart-cache add 0x1234567890abcdef1234567890abcdef12345678 --interactive
```

#### Get Help

```bash
# General help
smart-cache --help

# Command-specific help
smart-cache add --help
smart-cache init --help
```

## 📋 Command Reference

### `smart-cache init`

Create a `smartcache.toml` configuration file with default settings.

**Flags:**
- `-f, --force` - Overwrite existing smartcache.toml file
- `-i, --interactive` - Interactive mode to configure values
- `-h, --help` - Show help

**Examples:**
```bash
smart-cache init
smart-cache init --interactive
smart-cache init --force
```

### `smart-cache add <address>`

Add a deployed Stylus contract address to the cache.

**Arguments:**
- `address` - The contract address to cache (optional if specified in smartcache.toml)

**Flags:**
- `-n, --network` - Network where contract is deployed (default: arbitrum-sepolia)
- `-t, --tx-hash` - Transaction hash of the deployment
- `--name` - Name of the contract
- `-d, --description` - Description of the contract
- `-v, --version` - Version of the contract
- `--deployed-by` - Address of the deployer
- `-m, --metadata` - Additional metadata as JSON string
- `-i, --interactive` - Interactive mode for additional details
- `-h, --help` - Show help

**Examples:**
```bash
smart-cache add 0x1234567890abcdef1234567890abcdef12345678
smart-cache add 0x1234... --network arbitrum-sepolia --name "Counter"
smart-cache add 0x1234... --metadata '{"type":"ERC20","symbol":"TOK"}'
smart-cache add  # Uses configuration from smartcache.toml
```

## ⚙️ Configuration

### smartcache.toml

The CLI supports a configuration file that allows you to set default values and avoid repeating common parameters.

#### Basic Configuration

```toml
# SmartCache Configuration File
# Generated on 2025-07-28

# Default network for contract operations
# Options: arbitrum-sepolia, arbitrum-one, arbitrum-nova, localhost
network = "arbitrum-sepolia"

# Your wallet address that deployed the contracts, this is required for all operations
deployed_by = "0xd649CB59755EbC44610a8e5F15D3C93C3aEb08F1"

# Optional: Default contract address
# If specified, you can run 'smart-cache add' without providing an address
contract_address = "0xd32d28f326955b1b2fa9d01bea0dce77b1219a57"

# Optional: Default contract metadata
name = "MyContract"
description = "Contract description"
version = "1.0.0"

# CLI behavior settings
interactive = false

# Optional: Custom metadata (add any additional fields you need)
# [metadata]
# author = "Your Name"
# license = "MIT"
# tags = ["defi", "nft"]
```

#### Configuration Priority

The CLI follows this priority order for configuration values:

1. **Command line arguments** (highest priority)
2. **Command line flags**
3. **TOML configuration file** (lowest priority)

This means command line options will always override values from the configuration file.

#### Creating Configuration Files

Use the `init` command to create configuration files:

```bash
# Basic setup
smart-cache init

# Interactive setup with prompts
smart-cache init --interactive

# Overwrite existing file
smart-cache init --force
```

## 🌐 Supported Networks

- `arbitrum-sepolia` (default)
- `arbitrum-one`
- `arbitrum-nova`
- `localhost`

## 🔄 Integration with Stylus Workflow

This tool is designed to work seamlessly with the Arbitrum Stylus development workflow:

### 1. Initialize Configuration

```bash
# Create configuration file
smart-cache init --interactive

# Edit the generated smartcache.toml with your settings
```

### 2. Deploy your Stylus contract

```bash
cargo stylus deploy \
  --endpoint='https://sepolia-rollup.arbitrum.io/rpc' \
  --private-key="0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"
```

### 3. Cache the deployed contract

```bash
# Using configuration file
smart-cache add

# Or with explicit parameters
smart-cache add 0x33f54de59419570a9442e788f5dd5cf635b3c7ac \
  --network arbitrum-sepolia \
  --tx-hash 0xa55efc05c45efc63647dff5cc37ad328a47ba5555009d92ad4e297bf4864de36 \
  --name "Counter" \
  --version "1.0.0"
```

## 🛠️ Development

### Setup

```bash
git clone <repository-url>
cd smart-cache-cli
npm install
```

### Available Scripts

```bash
npm run build          # Build TypeScript
npm run dev            # Run in development mode
npm run test           # Run tests
npm run lint           # Run ESLint
npm run prepack        # Prepare for publishing
```

### Development Mode

```bash
./bin/dev add --help
./bin/dev init --interactive
```

## 📁 Project Structure

```
smart-cache-cli/
├── bin/
│   ├── run              # Production entry point
│   └── dev              # Development entry point
├── src/
│   ├── commands/
│   │   ├── add.ts       # Add command implementation
│   │   └── init.ts      # Init command implementation
│   ├── config/
│   │   └── database.ts  # MongoDB configuration
│   ├── utils/
│   │   └── validation.ts # Address validation utilities
│   └── index.ts         # Main entry point
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Security

- Never commit your private keys or sensitive information
- Use strong passwords for your accounts
- Keep your CLI and dependencies up to date
- The `smartcache.toml` file may contain sensitive addresses - keep it secure

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

#### "Invalid contract address"
Ensure the contract address is a valid Ethereum address format (42 characters starting with 0x).

#### "Command not found: smart-cache"
Make sure you installed the package globally:
```bash
npm install -g smart-cache-cli
```

#### "Error in smartcache.toml"
Check your configuration file for syntax errors. Use `smart-cache init` to create a new one.

#### "Contract address is required"
Either provide the address as a command line argument or add it to your `smartcache.toml` file:
```toml
contract_address = "0x1234567890abcdef1234567890abcdef12345678"
```

### Getting Help

- Create an issue on GitHub
- Check existing issues for solutions
- Use the `--help` flag for command-specific help

## 🎯 Roadmap

- [ ] Contract verification status
- [ ] ABI storage and retrieval
- [ ] Bulk contract import
- [ ] Contract grouping and tagging
- [ ] Integration with popular development tools
- [ ] Web interface for contract management
- [ ] Configuration file validation
- [ ] Environment-specific configurations

---

**Happy caching! 🎉**

Built with ❤️ for the Arbitrum Stylus community.
