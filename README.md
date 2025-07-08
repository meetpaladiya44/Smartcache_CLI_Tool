# Smart Cache CLI

A global CLI tool to cache deployed Arbitrum Stylus contract addresses to MongoDB Atlas, making them accessible from anywhere.

[![npm version](https://badge.fury.io/js/smart-cache-cli.svg)](https://badge.fury.io/js/smart-cache-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Global CLI**: Access your cached contracts from any directory on any system
- **MongoDB Atlas Integration**: Secure cloud database storage
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

## ⚙️ Configuration

### 1. Set up MongoDB Atlas

1. Create a [MongoDB Atlas](https://www.mongodb.com/atlas) account
2. Create a new cluster
3. Create a database user
4. Get your connection string

### 2. Configure Environment Variables

Create a `.env` file in your home directory or set environment variables:

```bash
# Required: MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Optional: Database name (defaults to 'smartcache')
DATABASE_NAME=smartcache

# Optional: Collection name (defaults to 'contracts')
COLLECTION_NAME=contracts
```

### Example .env file:
```env
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.example.mongodb.net/smartcache?retryWrites=true&w=majority
DATABASE_NAME=smartcache
COLLECTION_NAME=contracts
```

## 🔧 Usage

### Basic Commands

#### Add a Contract

```bash
# Basic usage
smart-cache add 0x1234567890abcdef1234567890abcdef12345678

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

#### List Cached Contracts

```bash
# List all contracts
smart-cache list

# Filter by network
smart-cache list --network arbitrum-sepolia

# JSON output
smart-cache list --format json
```

#### Get Help

```bash
# General help
smart-cache --help

# Command-specific help
smart-cache add --help
smart-cache list --help
```

## 📋 Command Reference

### `smart-cache add <address>`

Add a deployed Stylus contract address to the cache.

**Arguments:**
- `address` - The contract address to cache (required)

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
```

### `smart-cache list`

List all cached contract addresses.

**Flags:**
- `-n, --network` - Filter by network
- `-f, --format` - Output format (table/json, default: table)
- `-h, --help` - Show help

**Examples:**
```bash
smart-cache list
smart-cache list --network arbitrum-sepolia
smart-cache list --format json
```

## 🌐 Supported Networks

- `arbitrum-sepolia` (default)
- `arbitrum-one`
- `arbitrum-nova`
- `localhost`

## 🔄 Integration with Stylus Workflow

This tool is designed to work seamlessly with the Arbitrum Stylus development workflow:

### 1. Deploy your Stylus contract

```bash
cargo stylus deploy \
  --endpoint='https://sepolia-rollup.arbitrum.io/rpc' \
  --private-key="0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"
```

### 2. Cache the deployed contract

```bash
smart-cache add 0x33f54de59419570a9442e788f5dd5cf635b3c7ac \
  --network arbitrum-sepolia \
  --tx-hash 0xa55efc05c45efc63647dff5cc37ad328a47ba5555009d92ad4e297bf4864de36 \
  --name "Counter" \
  --version "1.0.0"
```

### 3. Access from anywhere

```bash
smart-cache list --network arbitrum-sepolia
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
./bin/dev list
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
│   │   └── list.ts      # List command implementation
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

- Never commit your `.env` file or MongoDB credentials
- Use environment variables for sensitive configuration
- Ensure your MongoDB Atlas cluster has proper network access controls
- Consider using MongoDB Atlas IP whitelisting for additional security

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

#### "MONGODB_URI environment variable is required"
Make sure you have set the `MONGODB_URI` environment variable in your `.env` file or system environment.

#### "Invalid contract address"
Ensure the contract address is a valid Ethereum address format (42 characters starting with 0x).

#### "Failed to connect to MongoDB"
Check your MongoDB Atlas connection string and ensure:
- The cluster is running
- Your IP is whitelisted
- Credentials are correct
- Network access is configured properly

#### "Command not found: smart-cache"
Make sure you installed the package globally:
```bash
npm install -g smart-cache-cli
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

---

**Happy caching! 🎉**

Built with ❤️ for the Arbitrum Stylus community. 