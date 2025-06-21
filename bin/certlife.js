#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { checkCertificates } from '../lib/index.js';

const USAGE = `
Usage: certlife [options] <domain> [domain ...]

Check TLS/SSL certificate expiry dates for one or more domains.

Options:
  -h, --help           Show this help message
  -v, --version        Show version number
  -p, --port <number>  Port to connect to (default: 443)
  -t, --timeout <ms>   Connection timeout in milliseconds (default: 5000)
  -j, --json           Output results as JSON
  -d, --detailed       Show detailed certificate information
  -q, --quiet          Only show days (no domain names)
  -w, --warn <days>    Exit with code 1 if any cert expires within specified days
  --color              Force colored output
  --no-color           Disable colored output

Examples:
  certlife google.com
  certlife --detailed google.com github.com
  certlife --json --port 8443 example.com
  certlife --warn 30 google.com github.com
`;

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

let useColors = process.stdout.isTTY && !process.env.NO_COLOR;

function colorize (text, color) {
  return useColors ? `${colors[color]}${text}${colors.reset}` : text;
}

function formatDays (days) {
  if (days < 0) {
    return colorize(`${Math.abs(days)} days ago (EXPIRED)`, 'red');
  } else if (days === 0) {
    return colorize('expires today (CRITICAL)', 'red');
  } else if (days <= 7) {
    return colorize(`${days} days (CRITICAL)`, 'red');
  } else if (days <= 30) {
    return colorize(`${days} days (WARNING)`, 'yellow');
  } else {
    return colorize(`${days} days`, 'green');
  }
}

function formatDate (date) {
  if (!date) return 'N/A';
  return date.toISOString().split('T')[0];
}

async function main () {
  let options, positionals;

  try {
    ({ values: options, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        port: { type: 'string', short: 'p' },
        timeout: { type: 'string', short: 't' },
        json: { type: 'boolean', short: 'j' },
        detailed: { type: 'boolean', short: 'd' },
        quiet: { type: 'boolean', short: 'q' },
        warn: { type: 'string', short: 'w' },
        color: { type: 'boolean' },
        'no-color': { type: 'boolean' }
      },
      allowPositionals: true
    }));
  } catch (error) {
    console.error(colorize(`Error: ${error.message}`, 'red'));
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Handle color options
  if (options.color) useColors = true;
  if (options['no-color']) useColors = false;

  if (options.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (options.version) {
    // Read version from package.json
    try {
      const packageJson = await import('../package.json', { assert: { type: 'json' } });
      console.log(packageJson.default.version);
    } catch {
      console.log('1.0.0');
    }
    process.exit(0);
  }

  const domains = positionals;
  if (domains.length === 0) {
    console.error(colorize('Error: No domains specified', 'red'));
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Parse numeric options
  const port = options.port ? parseInt(options.port, 10) : 443;
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 5000;
  const warnThreshold = options.warn ? parseInt(options.warn, 10) : null;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(colorize('Error: Port must be a number between 1 and 65535', 'red'));
    process.exit(1);
  }

  if (isNaN(timeout) || timeout < 0) {
    console.error(colorize('Error: Timeout must be a non-negative number', 'red'));
    process.exit(1);
  }

  if (warnThreshold !== null && (isNaN(warnThreshold) || warnThreshold < 0)) {
    console.error(colorize('Error: Warning threshold must be a non-negative number', 'red'));
    process.exit(1);
  }

  try {
    const results = await checkCertificates(domains, {
      port,
      timeout,
      detailed: options.detailed || options.json
    });

    let hasWarnings = false;

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else if (options.quiet) {
      for (const result of results) {
        const days = typeof result === 'number' ? result : result.daysUntilExpiry;
        console.log(days);
      }
    } else if (options.detailed) {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const domain = domains[i];

        console.log(colorize(`${domain}:`, 'cyan'));
        if (result.error) {
          console.log(`  Status: ${colorize('ERROR', 'red')}`);
          console.log(`  Error: ${result.error}`);
        } else {
          console.log(`  Days until expiry: ${formatDays(result.daysUntilExpiry)}`);
          console.log(`  Expiry date: ${formatDate(result.expiryDate)}`);
          console.log(`  Valid: ${result.isValid ? colorize('Yes', 'green') : colorize('No', 'red')}`);
        }

        if (i < results.length - 1) console.log();
      }
    } else {
      // Simple format
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const domain = domains[i];
        const days = typeof result === 'number' ? result : result.daysUntilExpiry;

        console.log(`${colorize(domain + ':', 'cyan')} ${formatDays(days)}`);
      }
    }

    // Check warning threshold
    if (warnThreshold !== null) {
      for (const result of results) {
        const days = typeof result === 'number' ? result : result.daysUntilExpiry;
        if (days <= warnThreshold) {
          hasWarnings = true;
          break;
        }
      }
    }

    process.exit(hasWarnings ? 1 : 0);

  } catch (error) {
    console.error(colorize(`Error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

main(); 