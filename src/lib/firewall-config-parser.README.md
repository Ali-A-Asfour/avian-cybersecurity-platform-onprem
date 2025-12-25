# SonicWall Configuration Parser

## Overview

The `ConfigParser` class parses SonicWall firewall configuration files (.exp format) and extracts structured data for risk analysis and security posture assessment.

## Features

The parser extracts the following information from SonicWall configuration files:

### 1. Firewall Rules
- Rule name, source/destination zones and addresses
- Service/port, action (allow/deny)
- Enabled status, schedule, comments

### 2. NAT Policies
- Original and translated source/destination
- Interface assignment

### 3. Address Objects
- Object name, IP address/range
- Zone assignment

### 4. Service Objects
- Service name, protocol, port range

### 5. Security Feature Settings
- IPS, Gateway Anti-Virus, DPI-SSL
- ATP, Botnet Filter, Application Control
- Content Filtering, Geo-IP Filter

### 6. Admin Settings
- Admin usernames
- MFA status, WAN management status
- HTTPS admin port, SSH status

### 7. Interface Configurations
- Interface name, zone, IP address
- DHCP server status

### 8. VPN Configurations
- Policy name, encryption algorithm
- Authentication method

### 9. System Settings
- Firmware version, hostname, timezone
- NTP servers, DNS servers

## Usage

```typescript
import { ConfigParser } from '@/lib/firewall-config-parser';

// Create parser instance
const parser = new ConfigParser();

// Parse configuration file
const configText = fs.readFileSync('firewall-config.exp', 'utf-8');
const parsedConfig = parser.parseConfig(configText);

// Access parsed data
console.log('Firmware:', parsedConfig.systemSettings.firmwareVersion);
console.log('IPS Enabled:', parsedConfig.securitySettings.ipsEnabled);
console.log('Rules:', parsedConfig.rules.length);
```

## Configuration Format

The parser supports SonicWall .exp configuration format with the following patterns:

### Firewall Rules
```
access-rule name "RuleName" from ZONE1 to ZONE2 source ADDRESS destination ADDRESS service SERVICE action allow
```

### Security Features
```
ips enable
gateway-av enable
dpi-ssl disable
```

### Admin Settings
```
admin username "admin"
mfa enable
wan management enable
https admin port 8443
```

### Interfaces
```
interface X0 zone WAN ip 203.0.113.1
interface X1 zone LAN ip 192.168.1.1 dhcp server enable
```

### VPN Configuration
```
vpn policy "Site-to-Site" encryption aes256 auth certificate
```

## Risk Detection

The parsed configuration data is used by the `RiskEngine` to detect security risks such as:

- **CRITICAL**: WAN-to-LAN any rules, WAN management enabled, DHCP on WAN
- **HIGH**: Any-to-any rules, disabled IPS/GAV, weak VPN encryption
- **MEDIUM**: Disabled DPI-SSL, PSK-only VPN, default admin usernames
- **LOW**: Missing rule descriptions, default admin port, missing NTP

## Testing

The parser includes comprehensive unit tests and integration tests:

```bash
# Run all config parser tests
npm test -- firewall-config-parser

# Run unit tests only
npm test -- firewall-config-parser.test.ts

# Run integration tests only
npm test -- firewall-config-parser-integration.test.ts
```

### Test Fixtures

Sample configuration files are available in `src/lib/__tests__/fixtures/`:

- `sample-sonicwall-config.exp` - Secure configuration example
- `risky-sonicwall-config.exp` - Configuration with multiple security risks

## Implementation Notes

### Parsing Strategy

The parser uses a line-by-line approach with regex pattern matching:

1. Split configuration into lines
2. Iterate through lines looking for specific patterns
3. Extract values using regex capture groups
4. Build structured data objects

### Comment Handling

The parser automatically skips comment lines starting with `#` or `//` to avoid false positives in pattern matching.

### Case Insensitivity

All keyword matching is case-insensitive to handle variations in configuration format.

### Error Handling

The parser gracefully handles malformed configuration lines:
- Invalid lines are logged as warnings
- Parsing continues for remaining valid lines
- Partial data is returned even if some sections fail

### Extensibility

To add support for additional configuration elements:

1. Add new interface to `@/types/firewall.ts`
2. Create extraction method in `ConfigParser` class
3. Add method call in `parseConfig()` method
4. Add unit tests for new functionality

## Requirements Mapping

This implementation satisfies the following requirements from the design document:

- **Requirement 6.1-6.10**: Configuration extraction for all specified elements
- **Requirement 6.11**: Parsing depth sufficient for risk rule evaluation
- **Requirement 6.12**: No full configuration reconstruction
- **Requirement 6.13**: Extraction of fields required for ALL risk rules

## Related Components

- `RiskEngine` - Analyzes parsed configuration for security risks
- `ConfigService` - Service layer for configuration management
- `firewall-config-risks` table - Stores detected risks

## Future Enhancements

- Support for additional firewall vendors (Fortinet, Palo Alto)
- Binary configuration file parsing
- Configuration diff and change detection
- Automated configuration backup parsing
