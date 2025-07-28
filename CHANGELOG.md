# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2025-07-28

### Added
- **Configuration Management**: Added support for `smartcache.toml` configuration files
- **Init Command**: New `smart-cache init` command to create configuration files
- **TOML Integration**: Parse and validate TOML configuration files
- **Priority System**: CLI arguments override TOML config values
- **Interactive Setup**: Interactive mode for creating configuration files
- **Configuration Validation**: Validate TOML structure and values
- **Improved UX**: Better error messages and user guidance

### Changed
- **Add Command**: Now supports configuration file values as fallbacks
- **Error Handling**: Improved error messages with configuration-specific solutions
- **Documentation**: Updated README with configuration management features
- **Color Scheme**: Updated to use sky bluish color (`#87CEEB`) for better visibility

### Features
- Configuration file priority system (CLI > TOML)
- Automatic configuration file detection
- Interactive configuration setup
- Configuration validation with helpful error messages
- Support for default contract addresses in config
- Persistent settings across command executions

## [1.0.0] - 2025-01-09

### Added
- Initial release of Smart Cache CLI
- `add` command to cache Stylus contract addresses
- Support for Arbitrum networks (sepolia, mainnet, nova)
- Interactive mode for contract metadata
- Progress bars for long-running operations
- Colored output for better UX
- Global CLI installation support

### Features
- Contract address validation
- Network detection and validation
- Metadata storage (name, version, description)
- Bid management integration
- Retry logic for failed operations

## [Unreleased]

### Planned
- Contract verification status
- Bulk import functionality
- Enhanced filtering options
- Environment-specific configurations
- Configuration file templates
- Advanced metadata management 