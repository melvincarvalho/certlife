# CertLife

[![npm version](https://badge.fury.io/js/certlife.svg)](https://badge.fury.io/js/certlife)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A simple and powerful Node.js library and CLI tool to check TLS/SSL certificate expiry dates. Perfect for monitoring certificate health and automating certificate renewal alerts.

## Features

- 🕒 **Fast & Reliable**: Quickly check certificate expiry for multiple domains
- 📊 **Multiple Output Formats**: Support for JSON, detailed, and quiet modes
- 🎨 **Colored Output**: Beautiful, color-coded results in the terminal
- 🔧 **Flexible API**: Use as a library or CLI tool
- ⚠️ **Warning Thresholds**: Set alerts for certificates expiring soon
- 🔌 **Custom Ports**: Check certificates on non-standard ports
- ⏱️ **Configurable Timeouts**: Handle slow connections gracefully
- 📦 **Zero Dependencies**: Lightweight with no external dependencies

## Installation

### As a CLI tool (global installation)

```bash
npm install -g certlife
```

### As a library (local installation)

```bash
npm install certlife
```

## CLI Usage

### Basic Usage

```bash
# Check a single domain
certlife google.com

# Check multiple domains
certlife google.com github.com stackoverflow.com
```

### Options

```bash
Usage: certlife [options] <domain> [domain ...]

Options:
  -h, --help           Show help message
  -v, --version        Show version number
  -p, --port <number>  Port to connect to (default: 443)
  -t, --timeout <ms>   Connection timeout in milliseconds (default: 5000)
  -j, --json           Output results as JSON
  -d, --detailed       Show detailed certificate information
  -q, --quiet          Only show days (no domain names)
  -w, --warn <days>    Exit with code 1 if any cert expires within specified days
  --color              Force colored output
  --no-color           Disable colored output
```

### Examples

```bash
# Basic check
certlife google.com
# Output: google.com: 89 days

# Check with custom port
certlife --port 8443 example.com

# Get detailed information
certlife --detailed google.com github.com

# JSON output for scripting
certlife --json google.com github.com

# Monitor and alert (useful in scripts/CI)
certlife --warn 30 mysite.com
# Exits with code 1 if certificate expires within 30 days

# Quiet mode (just the numbers)
certlife --quiet google.com github.com
# Output:
# 89
# 67
```

## Library Usage

### ES Modules

```javascript
import {
  checkCertificate,
  checkCertificates,
  daysLeft,
  isExpired,
  expiresWithin
} from 'certlife'

// Simple check - returns days until expiry
const days = await checkCertificate('google.com')
console.log(`Days until expiry: ${days}`)

// Detailed check
const result = await checkCertificate('google.com', { detailed: true })
console.log(result)
// {
//   domain: 'google.com',
//   daysUntilExpiry: 89,
//   expiryDate: 2024-05-15T00:00:00.000Z,
//   isValid: true,
//   isExpired: false,
//   error: null
// }

// Check multiple domains
const results = await checkCertificates(['google.com', 'github.com'])
console.log(results) // [89, 67]

// Check if expired
const expired = await isExpired('google.com')
console.log(expired) // false

// Check if expires within threshold
const expiresSoon = await expiresWithin('google.com', 30)
console.log(expiresSoon) // false
```

### CommonJS

```javascript
const { checkCertificate, checkCertificates } = require('certlife')

// Same API as above
```

## API Reference

### `checkCertificate(domain, options)`

Check certificate expiry for a single domain.

**Parameters:**

- `domain` (string): The domain to check
- `options` (object, optional):
  - `port` (number): Port to connect to (default: 443)
  - `timeout` (number): Connection timeout in milliseconds (default: 5000)
  - `detailed` (boolean): Return detailed certificate information (default: false)

**Returns:**

- `Promise<number>` - Days until expiry (negative if expired) when `detailed: false`
- `Promise<CertificateInfo>` - Detailed certificate information when `detailed: true`

### `checkCertificates(domains, options)`

Check certificate expiry for multiple domains.

**Parameters:**

- `domains` (string[]): Array of domains to check
- `options` (object, optional): Same as `checkCertificate`

**Returns:** `Promise<Array<number|CertificateInfo>>`

### `daysLeft(domain, port)`

Simple alias for `checkCertificate` that returns only days.

**Parameters:**

- `domain` (string): The domain to check
- `port` (number, optional): Port to connect to (default: 443)

**Returns:** `Promise<number>` - Days until expiry

### `isExpired(domain, options)`

Check if a certificate is expired.

**Parameters:**

- `domain` (string): The domain to check
- `options` (object, optional): Same as `checkCertificate`

**Returns:** `Promise<boolean>` - True if certificate is expired

### `expiresWithin(domain, threshold, options)`

Check if a certificate expires within a specified number of days.

**Parameters:**

- `domain` (string): The domain to check
- `threshold` (number): Number of days threshold
- `options` (object, optional): Same as `checkCertificate`

**Returns:** `Promise<boolean>` - True if certificate expires within threshold

### Types

#### `CertificateInfo`

```javascript
{
  domain: string,           // The domain name
  daysUntilExpiry: number,  // Days until expiry (negative if expired)
  expiryDate: Date|null,    // Certificate expiry date
  isValid: boolean,         // Whether certificate is currently valid
  isExpired: boolean,       // Whether certificate has expired
  error: string|null        // Error message if check failed
}
```

## Use Cases

### Monitoring Scripts

```javascript
import { checkCertificates } from 'certlife'

const domains = ['mysite.com', 'api.mysite.com', 'admin.mysite.com']
const results = await checkCertificates(domains, { detailed: true })

for (const result of results) {
  if (result.daysUntilExpiry < 30) {
    console.warn(
      `⚠️  ${result.domain} expires in ${result.daysUntilExpiry} days!`
    )
    // Send alert email, Slack notification, etc.
  }
}
```

### CI/CD Integration

```bash
#!/bin/bash
# In your deployment script

certlife --warn 30 mysite.com
if [ $? -eq 1 ]; then
    echo "Certificate expires soon! Consider renewal."
    exit 1
fi
```

### Health Check Endpoints

```javascript
import express from 'express'
import { checkCertificate } from 'certlife'

const app = express()

app.get('/health/cert', async (req, res) => {
  try {
    const days = await checkCertificate('mysite.com')
    const status = days > 30 ? 'healthy' : days > 7 ? 'warning' : 'critical'

    res.json({
      status,
      daysUntilExpiry: days,
      healthy: days > 7
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

## Error Handling

The library handles various error conditions gracefully:

- **Connection failures**: Returns -1 (or error in detailed mode)
- **Timeouts**: Configurable timeout with fallback
- **Invalid certificates**: Still checks expiry date
- **No certificate**: Returns appropriate error information

```javascript
const result = await checkCertificate('invalid-domain.xyz', { detailed: true })
console.log(result)
// {
//   domain: 'invalid-domain.xyz',
//   daysUntilExpiry: -1,
//   expiryDate: null,
//   isValid: false,
//   isExpired: true,
//   error: 'Connection failed'
// }
```

## Requirements

- Node.js 14.0.0 or higher
- No external dependencies

## License

MIT © [Melvin Carvalho](https://github.com/melvincarvalho)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Changelog

### 0.0.2

- Initial release
- CLI tool with multiple output formats
- Comprehensive library API
- Zero dependencies
- Full TypeScript support via JSDoc
