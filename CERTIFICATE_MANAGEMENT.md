# Certificate Management Best Practices

## 1. Generating Self-Signed Certificates

### For Development (OpenSSL)

```bash
# Generate private key and self-signed certificate
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"

# Or with explicit subject alternative names
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

### For Node.js

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

---

## 2. Protecting Private Keys

### File Permissions (Linux/Mac)

```bash
# Set restrictive permissions - only owner can read
chmod 600 key.pem

# Verify permissions
ls -la key.pem
```

### Environment Variables (Production)

```bash
# Store sensitive paths in environment variables
export SSL_KEY_PATH=/etc/ssl/private/server.key
export SSL_CERT_PATH=/etc/ssl/certs/server.crt
```

### Key Encryption

```bash
# Generate encrypted key (password-protected)
openssl genrsa -aes256 -out encrypted-key.pem 2048

# Convert to unencrypted for server (or use openssl with -passin)
openssl rsa -in encrypted-key.pem -out key.pem
```

---

## 3. Production Environment Certificate Configuration

### Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
}
```

### Using Certificate Authority (Let's Encrypt)

```bash
# Using certbot
sudo certbot --nginx -d example.com -d www.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Certificate Rotation

- Set calendar reminders for renewal (typically 30-90 days before expiry)
- Use automated renewal scripts
- Keep backup copies of certificates and keys in secure storage

---

## 4. Version Control Best Practices

### NEVER Commit Private Keys

The `.gitignore` file already includes `*.pem` to prevent accidental commits.

### Recommended Project Structure

```
project/
├── .gitignore           # Includes *.pem
├── certs/
│   ├── README.md        # Documents where to obtain certs
│   └── (certificates - not committed)
├── config/
│   └── ssl.js           # References environment variables
└── src/
```

### Configuration Example

```javascript
// config/ssl.js
const path = require('path');

module.exports = {
  key: process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/key.pem'),
  cert: process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/cert.pem')
};
```

### Environment-Specific Settings

```bash
# Development (self-signed)
NODE_ENV=development

# Production (real certificates)
NODE_ENV=production
SSL_KEY_PATH=/etc/ssl/private/prod-key.pem
SSL_CERT_PATH=/etc/ssl/certs/prod-cert.crt
```

---

## Summary

| Environment | Certificate Type | Storage | Committed to Git? |
|-------------|-----------------|---------|-------------------|
| Development | Self-signed | Local files | NO (`.pem` ignored) |
| Staging | Let's Encrypt | `/etc/ssl` | NO |
| Production | CA-issued | Hardware/HSM | NO |