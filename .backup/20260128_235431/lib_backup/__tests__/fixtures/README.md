# SonicWall Configuration Test Fixtures

This directory contains sample SonicWall configuration files (.exp format) for testing the configuration parser and risk detection engine.

## Test Fixture Files

### 1. `secure-baseline-config.exp`
**Purpose:** Represents security best practices with minimal risks

**Characteristics:**
- Latest firmware version (7.0.1-5050)
- All security features enabled (IPS, GAV, DPI-SSL, ATP, Botnet, AppControl, ContentFilter)
- NTP properly configured
- MFA enabled
- Non-default admin usernames
- Non-default HTTPS admin port (8443)
- WAN management disabled
- All firewall rules have descriptions
- Strong VPN encryption (AES-256) with certificate authentication
- Guest network properly isolated

**Expected Risks:** None or minimal (LOW severity only)

**Use Cases:**
- Baseline comparison for risk scoring
- Validation that secure configurations don't trigger false positives
- Testing that parser correctly identifies secure settings

---

### 2. `risky-sonicwall-config.exp`
**Purpose:** Contains multiple high-severity security risks

**Characteristics:**
- Outdated firmware (6.5.0-1000)
- Multiple security features disabled (IPS, GAV, DPI-SSL, AppControl, ContentFilter, Botnet)
- No NTP configured
- Default admin usernames (admin, root, administrator)
- MFA not enabled
- WAN management enabled
- Default HTTPS admin port (443)
- SSH enabled
- DHCP server on WAN interface
- Dangerous firewall rules (WAN-to-LAN any, any-to-any)
- Guest network routing to LAN
- Weak VPN encryption (DES, 3DES)
- PSK-only VPN authentication
- Rules without descriptions

**Expected Risks:** 15+ risks across all severity levels (CRITICAL, HIGH, MEDIUM, LOW)

**Risk Types Covered:**
- OPEN_INBOUND (CRITICAL)
- ANY_ANY_RULE (HIGH)
- GUEST_NOT_ISOLATED (HIGH)
- DHCP_ON_WAN (CRITICAL)
- IPS_DISABLED (CRITICAL)
- GAV_DISABLED (CRITICAL)
- DPI_SSL_DISABLED (MEDIUM)
- BOTNET_FILTER_DISABLED (HIGH)
- APP_CONTROL_DISABLED (MEDIUM)
- CONTENT_FILTER_DISABLED (MEDIUM)
- WAN_MANAGEMENT_ENABLED (CRITICAL)
- ADMIN_NO_MFA (HIGH)
- DEFAULT_ADMIN_USERNAME (MEDIUM)
- DEFAULT_ADMIN_PORT (LOW)
- VPN_WEAK_ENCRYPTION (HIGH)
- VPN_PSK_ONLY (MEDIUM)
- RULE_NO_DESCRIPTION (LOW)
- OUTDATED_FIRMWARE (MEDIUM)
- NO_NTP (LOW)

**Use Cases:**
- Comprehensive risk detection testing
- Risk scoring algorithm validation
- Integration testing with risk storage

---

### 3. `sample-sonicwall-config.exp`
**Purpose:** Realistic production-like configuration with some risks

**Characteristics:**
- Current firmware version
- Most security features enabled
- NTP configured
- MFA enabled
- Non-default admin port
- Contains some commented-out risky rules (for testing)
- Mix of secure and potentially risky configurations
- One rule without description

**Expected Risks:** 1-3 LOW severity risks

**Use Cases:**
- Realistic scenario testing
- Parser validation with production-like data
- Testing commented-out rule handling

---

### 4. `network-misconfiguration-config.exp`
**Purpose:** Focuses specifically on network-related risks

**Characteristics:**
- DHCP server enabled on WAN interface (CRITICAL)
- WAN-to-LAN any rule (CRITICAL)
- Any-to-any rule (HIGH)
- Guest zone routing to LAN (HIGH)
- Multiple guest isolation issues

**Expected Risks:** 4-6 risks, mostly CRITICAL and HIGH severity

**Risk Types Covered:**
- DHCP_ON_WAN (CRITICAL)
- OPEN_INBOUND (CRITICAL)
- ANY_ANY_RULE (HIGH)
- GUEST_NOT_ISOLATED (HIGH)

**Use Cases:**
- Testing network misconfiguration detection
- Validating firewall rule analysis
- Testing zone-based security rules

---

### 5. `admin-security-risks-config.exp`
**Purpose:** Focuses on administrative security issues

**Characteristics:**
- WAN management enabled (CRITICAL)
- MFA not enabled (HIGH)
- Default admin usernames: admin, root, administrator (MEDIUM)
- Default HTTPS admin port 443 (LOW)
- SSH enabled on WAN interface (HIGH)

**Expected Risks:** 5 risks across CRITICAL, HIGH, MEDIUM, LOW severity

**Risk Types Covered:**
- WAN_MANAGEMENT_ENABLED (CRITICAL)
- ADMIN_NO_MFA (HIGH)
- DEFAULT_ADMIN_USERNAME (MEDIUM) - 3 instances
- DEFAULT_ADMIN_PORT (LOW)
- SSH_ON_WAN (HIGH)

**Use Cases:**
- Testing admin settings parser
- Validating administrative security checks
- Testing multiple instances of same risk type

---

### 6. `security-features-disabled-config.exp`
**Purpose:** Focuses on disabled security features

**Characteristics:**
- IPS disabled (CRITICAL)
- Gateway Anti-Virus disabled (CRITICAL)
- DPI-SSL disabled (MEDIUM)
- Botnet Filter disabled (HIGH)
- Application Control disabled (MEDIUM)
- Content Filtering disabled (MEDIUM)

**Expected Risks:** 6 risks (2 CRITICAL, 1 HIGH, 3 MEDIUM)

**Risk Types Covered:**
- IPS_DISABLED (CRITICAL)
- GAV_DISABLED (CRITICAL)
- DPI_SSL_DISABLED (MEDIUM)
- BOTNET_FILTER_DISABLED (HIGH)
- APP_CONTROL_DISABLED (MEDIUM)
- CONTENT_FILTER_DISABLED (MEDIUM)

**Use Cases:**
- Testing security feature status detection
- Validating feature enable/disable parsing
- Testing risk categorization by security feature

---

### 7. `vpn-weak-encryption-config.exp`
**Purpose:** Focuses on VPN security issues

**Characteristics:**
- DES encryption (HIGH risk)
- 3DES encryption (HIGH risk)
- PSK-only authentication with AES-256 (MEDIUM risk)
- PSK-only authentication with AES-128 (MEDIUM risk)
- Mix of secure and insecure VPN configurations

**Expected Risks:** 6 risks (4 HIGH, 2 MEDIUM)

**Risk Types Covered:**
- VPN_WEAK_ENCRYPTION (HIGH) - DES and 3DES
- VPN_PSK_ONLY (MEDIUM) - PSK authentication

**Use Cases:**
- Testing VPN configuration parsing
- Validating encryption algorithm detection
- Testing authentication method analysis

---

### 8. `best-practice-violations-config.exp`
**Purpose:** Focuses on best practice violations

**Characteristics:**
- Outdated firmware version (6.5.0-1000) - more than 6 months old (MEDIUM)
- No NTP configured (LOW)
- Multiple firewall rules without descriptions (LOW)

**Expected Risks:** 6-7 risks (1 MEDIUM, 5-6 LOW)

**Risk Types Covered:**
- OUTDATED_FIRMWARE (MEDIUM)
- NO_NTP (LOW)
- RULE_NO_DESCRIPTION (LOW) - multiple instances

**Use Cases:**
- Testing firmware version parsing and age calculation
- Validating NTP configuration detection
- Testing rule description validation

---

### 9. `all-risks-combined-config.exp`
**Purpose:** Comprehensive test with ALL possible risks in one file

**Characteristics:**
- Contains at least one instance of every risk type defined in requirements
- Covers all 30 risk detection rules
- Mix of all severity levels (CRITICAL, HIGH, MEDIUM, LOW)

**Expected Risks:** 20+ risks covering all risk types

**Risk Types Covered:** ALL 30 risk types from requirements 6.14-6.33

**Use Cases:**
- Comprehensive end-to-end testing
- Risk scoring algorithm validation with maximum risks
- Integration testing with complete risk coverage
- Performance testing with many risks

---

### 10. `malformed-config.exp`
**Purpose:** Tests parser error handling and resilience

**Characteristics:**
- Syntax errors and incomplete lines
- Missing required fields
- Invalid values
- Duplicate entries
- Random text and invalid formats
- Empty lines and unusual spacing

**Expected Behavior:**
- Parser should handle errors gracefully
- Should not crash or throw unhandled exceptions
- Should skip malformed lines and continue parsing
- Should extract valid data where possible
- May generate warnings or log errors

**Use Cases:**
- Testing parser robustness
- Validating error handling
- Testing resilience to corrupted or manually edited configs

---

### 11. `minimal-config.exp`
**Purpose:** Bare minimum configuration with only essential settings

**Characteristics:**
- Minimal required fields only
- No optional configurations
- Sparse data
- Basic security features only

**Expected Risks:** Several risks due to missing configurations

**Use Cases:**
- Testing parser handling of sparse data
- Validating default value assumptions
- Testing minimum viable configuration parsing

---

## Risk Detection Rules Coverage

The test fixtures collectively cover all 30 risk detection rules from Requirements 6.14-6.33:

### Network Misconfiguration (category: network_misconfiguration)
1. ✅ OPEN_INBOUND - WAN to LAN any rule (CRITICAL)
2. ✅ ANY_ANY_RULE - Any-to-any rule (HIGH)
3. ✅ GUEST_NOT_ISOLATED - Guest zone routing to LAN (HIGH)
4. ✅ DHCP_ON_WAN - DHCP server on WAN interface (CRITICAL)

### Exposure Risk (category: exposure_risk)
5. ✅ WAN_MANAGEMENT_ENABLED - WAN management enabled (CRITICAL)
6. ✅ SSH_ON_WAN - SSH on WAN interface (HIGH)

### Security Feature Disabled (category: security_feature_disabled)
7. ✅ IPS_DISABLED - IPS disabled (CRITICAL)
8. ✅ GAV_DISABLED - Gateway AV disabled (CRITICAL)
9. ✅ DPI_SSL_DISABLED - DPI-SSL disabled (MEDIUM)
10. ✅ BOTNET_FILTER_DISABLED - Botnet Filter disabled (HIGH)
11. ✅ APP_CONTROL_DISABLED - Application Control disabled (MEDIUM)
12. ✅ CONTENT_FILTER_DISABLED - Content Filtering disabled (MEDIUM)
13. ✅ VPN_WEAK_ENCRYPTION - Weak VPN encryption (HIGH)

### Best Practice Violation (category: best_practice_violation)
14. ✅ ADMIN_NO_MFA - MFA disabled (HIGH)
15. ✅ DEFAULT_ADMIN_USERNAME - Default admin username (MEDIUM)
16. ✅ DEFAULT_ADMIN_PORT - Default HTTPS admin port (LOW)
17. ✅ RULE_NO_DESCRIPTION - Rule missing description (LOW)
18. ✅ VPN_PSK_ONLY - VPN PSK-only authentication (MEDIUM)
19. ✅ OUTDATED_FIRMWARE - Outdated firmware (MEDIUM)
20. ✅ NO_NTP - NTP not configured (LOW)

## Usage in Tests

### Example: Loading a fixture in a test

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const configText = readFileSync(
  join(__dirname, 'fixtures', 'risky-sonicwall-config.exp'),
  'utf-8'
);

const parser = new ConfigParser();
const config = parser.parseConfig(configText);
const risks = riskEngine.analyzeConfig(config);

expect(risks.length).toBeGreaterThan(10);
```

### Example: Testing specific risk detection

```typescript
// Test WAN management detection
const configText = readFileSync(
  join(__dirname, 'fixtures', 'admin-security-risks-config.exp'),
  'utf-8'
);

const risks = riskEngine.analyzeConfig(parser.parseConfig(configText));
const wanManagementRisk = risks.find(r => r.riskType === 'WAN_MANAGEMENT_ENABLED');

expect(wanManagementRisk).toBeDefined();
expect(wanManagementRisk?.severity).toBe('critical');
```

## Maintenance

When adding new risk detection rules:
1. Update the appropriate fixture file(s) to include test cases
2. Add the new risk to `all-risks-combined-config.exp`
3. Update this README with the new risk coverage
4. Update test cases to validate the new risk detection

## File Format Notes

- Files use `.exp` extension (SonicWall export format)
- Lines starting with `#` are comments
- Configuration directives follow pattern: `keyword value1 value2 ...`
- Some directives use key-value pairs: `keyword key value`
- Whitespace is generally flexible
- Order of directives may vary in real configs
- Parser should be resilient to variations in formatting
