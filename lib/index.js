import tls from 'node:tls';

const MS_PER_DAY = 86_400_000;

/**
 * Certificate information object
 * @typedef {Object} CertificateInfo
 * @property {string} domain - The domain name
 * @property {number} daysUntilExpiry - Days until certificate expires (negative if expired)
 * @property {Date|null} expiryDate - Certificate expiry date
 * @property {boolean} isValid - Whether the certificate is currently valid
 * @property {boolean} isExpired - Whether the certificate has expired
 * @property {string|null} error - Error message if certificate check failed
 */

/**
 * Options for certificate checking
 * @typedef {Object} CertLifeOptions
 * @property {number} [port=443] - Port to connect to
 * @property {number} [timeout=5000] - Connection timeout in milliseconds
 * @property {boolean} [detailed=false] - Return detailed certificate information
 */

/**
 * Check certificate expiry for a single domain
 * @param {string} domain - The domain to check
 * @param {CertLifeOptions} [options={}] - Options for the certificate check
 * @returns {Promise<number|CertificateInfo>} Days until expiry (negative if expired) or detailed info
 */
export async function checkCertificate (domain, options = {}) {
  const { port = 443, timeout = 5000, detailed = false } = options;

  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain must be a non-empty string');
  }

  return new Promise((resolve) => {
    const socket = tls.connect(port, domain, {
      servername: domain,
      timeout,
      rejectUnauthorized: false // We want to check even invalid certs
    });

    socket.once('secureConnect', () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || !cert.valid_to) {
          const result = detailed ? {
            domain,
            daysUntilExpiry: -1,
            expiryDate: null,
            isValid: false,
            isExpired: true,
            error: 'No certificate presented'
          } : -1;
          return resolve(result);
        }

        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
        const isExpired = daysUntilExpiry < 0;
        const isValid = !isExpired;

        if (detailed) {
          resolve({
            domain,
            daysUntilExpiry,
            expiryDate,
            isValid,
            isExpired,
            error: null
          });
        } else {
          resolve(daysUntilExpiry);
        }
      } catch (error) {
        const result = detailed ? {
          domain,
          daysUntilExpiry: -1,
          expiryDate: null,
          isValid: false,
          isExpired: true,
          error: error.message
        } : -1;
        resolve(result);
      }
    });

    const handleError = (error) => {
      socket.destroy();
      const result = detailed ? {
        domain,
        daysUntilExpiry: -1,
        expiryDate: null,
        isValid: false,
        isExpired: true,
        error: error?.message || 'Connection failed'
      } : -1;
      resolve(result);
    };

    socket.once('error', handleError);
    socket.once('timeout', () => handleError(new Error('Connection timeout')));
  });
}

/**
 * Check certificate expiry for multiple domains
 * @param {string[]} domains - Array of domains to check
 * @param {CertLifeOptions} [options={}] - Options for the certificate checks
 * @returns {Promise<Array<number|CertificateInfo>>} Array of results for each domain
 */
export async function checkCertificates (domains, options = {}) {
  if (!Array.isArray(domains)) {
    throw new Error('Domains must be an array');
  }

  if (domains.length === 0) {
    return [];
  }

  const promises = domains.map(domain => checkCertificate(domain, options));
  return Promise.all(promises);
}

/**
 * Get days until certificate expiry for a domain (simple alias)
 * @param {string} domain - The domain to check
 * @param {number} [port=443] - Port to connect to
 * @returns {Promise<number>} Days until expiry (negative if expired)
 */
export async function daysLeft (domain, port = 443) {
  return checkCertificate(domain, { port });
}

/**
 * Check if certificate is expired
 * @param {string} domain - The domain to check
 * @param {CertLifeOptions} [options={}] - Options for the certificate check
 * @returns {Promise<boolean>} True if certificate is expired
 */
export async function isExpired (domain, options = {}) {
  const days = await checkCertificate(domain, options);
  return typeof days === 'number' ? days < 0 : days.isExpired;
}

/**
 * Check if certificate expires within specified days
 * @param {string} domain - The domain to check
 * @param {number} threshold - Number of days threshold
 * @param {CertLifeOptions} [options={}] - Options for the certificate check
 * @returns {Promise<boolean>} True if certificate expires within threshold days
 */
export async function expiresWithin (domain, threshold, options = {}) {
  const days = await checkCertificate(domain, options);
  const daysUntilExpiry = typeof days === 'number' ? days : days.daysUntilExpiry;
  return daysUntilExpiry <= threshold;
}

// Default export for convenience
export default {
  checkCertificate,
  checkCertificates,
  daysLeft,
  isExpired,
  expiresWithin
}; 