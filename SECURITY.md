# Security Guide - pixelcoda Search Platform

## 🔒 Security Features

### API Key Management
- **Hierarchical Scopes**: `read` < `write` < `admin`
- **Secure Generation**: Cryptographically secure random keys with `pc_` prefix
- **Database Storage**: Keys are hashed (SHA-256) before storage
- **Expiration Support**: Optional expiration dates for keys
- **Usage Tracking**: Last used timestamps and activity logs

### Authentication & Authorization
- **Header-based Auth**: `X-API-Key` or `Authorization: Bearer <key>`
- **Scope Validation**: Endpoints require appropriate permission levels
- **Project Isolation**: Keys can be scoped to specific projects

### Rate Limiting
- **Configurable Limits**: Default 100 requests per 15 minutes
- **Per-IP Tracking**: Uses `X-Forwarded-For` or `CF-Connecting-IP`
- **Sliding Window**: Clean expiration of old rate limit entries
- **Headers**: `X-RateLimit-*` headers inform clients of limits

### HMAC Webhook Verification
- **SHA-256 Signatures**: Webhooks signed with shared secret
- **Timing-Safe Comparison**: Prevents timing attacks
- **Configurable Secret**: Set via `TYPO3_HMAC_SECRET` environment variable

### Input Validation & Sanitization
- **Zod Schemas**: All API inputs validated with TypeScript schemas
- **XSS Prevention**: HTML tags stripped from user content
- **SQL Injection Protection**: Parameterized queries only
- **Path Traversal**: Directory traversal patterns blocked
- **Command Injection**: Shell metacharacters filtered

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (production only)
- `Permissions-Policy` for camera/microphone/geolocation

### CORS Configuration
- **Configurable Origins**: Set via `CORS_ORIGINS` environment variable
- **Preflight Support**: Proper OPTIONS request handling
- **Credential Control**: Secure cookie and header policies

## 🚨 Security Best Practices

### Production Deployment

#### 1. Environment Variables
```bash
# Generate secure secrets
API_READ_KEY=$(openssl rand -hex 32)
API_WRITE_KEY=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -hex 32)
MEILI_MASTER_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
TYPO3_HMAC_SECRET=$(openssl rand -hex 32)
```

#### 2. Database Security
```bash
# Use SSL connections
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Restrict database access
# - Use dedicated database user with minimal privileges
# - Enable connection limits
# - Use connection pooling
# - Regular backups with encryption
```

#### 3. Network Security
```bash
# Restrict CORS origins
CORS_ORIGINS="https://yourdomain.com,https://admin.yourdomain.com"

# Configure rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # per window

# Use HTTPS only
NODE_ENV=production
```

#### 4. API Key Rotation
```bash
# Regular key rotation (monthly recommended)
curl -X POST https://api.yourdomain.com/v1/admin/api-keys \
  -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Read Key v2",
    "scope": "read",
    "expires_in_days": 90
  }'
```

### TYPO3 Integration Security

#### 1. Webhook Configuration
```php
// typo3conf/ext/pixelcoda_search/ext_localconf.php
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] = [
    'api_url' => 'https://search-api.yourdomain.com',
    'api_key' => getenv('PIXELCODA_API_KEY'), // Never hardcode!
    'hmac_secret' => getenv('PIXELCODA_HMAC_SECRET'),
    'project_id' => 'production-site',
    'timeout' => 30
];
```

#### 2. Data Sanitization
The TYPO3 connector automatically:
- Removes sensitive fields (`password`, `session_data`, etc.)
- Strips HTML tags from content
- Limits content length
- Validates record structure

### Monitoring & Alerting

#### 1. Security Events to Monitor
- Failed authentication attempts
- Rate limit violations
- Suspicious input patterns
- HMAC verification failures
- Admin API access
- Unusual traffic patterns

#### 2. Log Analysis
```bash
# Monitor authentication failures
grep "Invalid API key" /var/log/pixelcoda-search/api.log

# Rate limit violations
grep "Rate limit exceeded" /var/log/pixelcoda-search/api.log

# HMAC failures
grep "Invalid signature" /var/log/pixelcoda-search/api.log
```

## 🔧 Security Configuration

### Environment Variables

| Variable | Description | Default | Security Level |
|----------|-------------|---------|----------------|
| `API_READ_KEY` | Read-only API access | - | **HIGH** |
| `API_WRITE_KEY` | Write API access | - | **CRITICAL** |
| `ADMIN_API_KEY` | Admin API access | - | **CRITICAL** |
| `TYPO3_HMAC_SECRET` | Webhook signature secret | - | **HIGH** |
| `CORS_ORIGINS` | Allowed CORS origins | `*` | **MEDIUM** |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | **MEDIUM** |
| `DATABASE_URL` | Database connection | - | **CRITICAL** |
| `MEILI_MASTER_KEY` | Meilisearch master key | - | **HIGH** |

### Security Headers Configuration

```typescript
// Customize security headers
const securityConfig = {
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  xssProtection: '1; mode=block',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  // Production only
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload'
};
```

## 🚨 Incident Response

### 1. Compromised API Key
```bash
# Immediately revoke the key
curl -X DELETE https://api.yourdomain.com/v1/admin/api-keys/$KEY_ID \
  -H "X-API-Key: $ADMIN_KEY"

# Generate new key
curl -X POST https://api.yourdomain.com/v1/admin/api-keys \
  -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Emergency Replacement", "scope": "read", "expires_in_days": 30}'

# Update all clients with new key
# Monitor logs for usage of old key
```

### 2. Suspicious Activity
```bash
# Check recent API activity
curl https://api.yourdomain.com/v1/admin/api-keys/$KEY_ID/usage \
  -H "X-API-Key: $ADMIN_KEY"

# Review rate limit violations
grep -A5 -B5 "Rate limit exceeded" /var/log/pixelcoda-search/api.log

# Check for injection attempts
grep -E "(union|select|script|javascript)" /var/log/pixelcoda-search/api.log
```

### 3. Database Compromise
```bash
# Rotate all database credentials
# Revoke all API keys
# Review audit logs
# Check for data exfiltration
# Update all connection strings
```

## 📋 Security Checklist

### Pre-Production
- [ ] All default credentials changed
- [ ] API keys generated securely
- [ ] HMAC secrets configured
- [ ] Database SSL enabled
- [ ] CORS origins restricted
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Input validation active
- [ ] Logging configured

### Production
- [ ] HTTPS enforced
- [ ] Database access restricted
- [ ] Monitoring alerts configured
- [ ] Backup encryption enabled
- [ ] Key rotation schedule established
- [ ] Security headers validated
- [ ] Vulnerability scanning active
- [ ] Incident response plan documented

### Ongoing
- [ ] Regular security updates
- [ ] API key rotation
- [ ] Log review
- [ ] Performance monitoring
- [ ] Penetration testing
- [ ] Dependency updates
- [ ] Security training
- [ ] Backup testing

## 📞 Security Contact

For security issues, please contact:
- **Email**: security@pixelcoda.com
- **PGP Key**: [Public key link]
- **Response Time**: 24 hours for critical issues

Please do not report security issues through public GitHub issues.
