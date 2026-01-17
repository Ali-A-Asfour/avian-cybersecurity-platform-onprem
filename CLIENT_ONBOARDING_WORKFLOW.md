# Client Onboarding Workflow - Firewall & Defender Integration

## 🎯 **The Onboarding Challenge**

When you take on a new client, you need to:
1. **Connect their SonicWall firewalls** (different IPs, credentials)
2. **Connect their Microsoft 365 tenant** (different Azure credentials)
3. **Set up monitoring** for their specific environment
4. **Configure alerts** for their security team

## 🎯 **Multi-Location Example: ACME Corporation**

### **Scenario**: ACME Corp has 4 locations with SonicWall firewalls

#### **Location 1: New York Headquarters**
```
Device Name: NYC-HQ-Firewall
Management IP: 192.168.1.1
Location: New York Headquarters  
Network Type: Headquarters
API Credentials: admin / [encrypted]
```

#### **Location 2: Dallas Branch Office**
```
Device Name: Dallas-Branch-FW
Management IP: 10.0.1.1
Location: Dallas Branch Office
Network Type: Branch Office
API Credentials: admin / [encrypted]
```

#### **Location 3: AWS Data Center**
```
Device Name: AWS-DataCenter-FW
Management IP: 172.16.1.1
Location: AWS US-East Data Center
Network Type: Data Center
API Credentials: admin / [encrypted]
```

#### **Location 4: Los Angeles Remote Site**
```
Device Name: LA-Remote-FW
Management IP: 192.168.100.1
Location: Los Angeles Remote Office
Network Type: Branch Office
API Credentials: admin / [encrypted]
```

### **Onboarding Process**:
1. **Step 1**: Enter ACME Corporation basic info
2. **Step 2**: Add all 4 SonicWall devices (test each connection)
3. **Step 3**: Configure Microsoft Defender (covers all locations)
4. **Step 4**: Verify setup shows all 4 devices ready

### **Result**: 
- ✅ 4 SonicWall devices monitored independently
- ✅ Location-specific alerts (NYC alerts, Dallas alerts, etc.)
- ✅ Consolidated dashboard showing all locations
- ✅ Security analysts can manage all sites from one interface

### **Step 1: Client Setup (Tenant Admin)**
```
New Client: "ACME Corporation"
├── Create tenant in AVIAN
├── Set up client-specific credentials
├── Configure monitoring preferences
└── Assign security analysts
```

### **Step 2: SonicWall Integration**
```
For each SonicWall device across all locations:
├── Get SonicWall firewall IP address (management interface IP)
├── Get API credentials (username/password)
├── Specify location/site information
├── Test connection to each device
├── Start monitoring for each device
└── Configure location-specific alert thresholds
```

**Multi-Location Examples:**
- **Headquarters**: 192.168.1.1 (NYC-HQ-Firewall) - Main office SonicWall
- **Branch Office**: 10.0.1.1 (Dallas-Branch-FW) - Branch office SonicWall
- **Data Center**: 172.16.1.1 (AWS-DataCenter-FW) - Data center SonicWall
- **Remote Site**: 192.168.100.1 (LA-Remote-FW) - Remote office SonicWall

**💡 IP Address Guide:**
- Use the same IP you type in your browser to access SonicWall management
- Usually the LAN interface IP (192.168.1.1, 10.0.1.1, etc.)
- Or a dedicated management interface IP if configured

### **Step 3: Microsoft Defender Integration**
```
Client's Microsoft 365 tenant:
├── Create Azure App Registration
├── Grant required permissions
├── Get client ID, secret, tenant ID
├── Test connection
└── Start device sync
```

## 🖥️ **UI Workflow Implementation**

### **Client Onboarding Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│ 🏢 New Client Onboarding: ACME Corporation            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Step 1: Basic Information ✅                           │
│ ├── Company Name: ACME Corporation                     │
│ ├── Industry: Manufacturing                            │
│ ├── Contact: john.doe@acme.com                         │
│ └── Timezone: EST                                      │
│                                                         │
│ Step 2: SonicWall Devices 🔄 In Progress              │
│ ├── [+ Add SonicWall Device]                          │
│ ├── Device 1: 192.168.1.1 ✅ Connected               │
│ ├── Device 2: 10.0.1.1 ⚠️ Testing...                 │
│ └── Device 3: [Not Added]                             │
│                                                         │
│ Step 3: Microsoft Defender ❌ Pending                 │
│ ├── Azure App Registration: [Not Created]             │
│ ├── Permissions: [Not Granted]                        │
│ └── Device Sync: [Not Started]                        │
│                                                         │
│ Step 4: Verification ⏳ Waiting                       │
│ ├── Test Alerts: [Pending]                            │
│ ├── Test Actions: [Pending]                           │
│ └── Analyst Training: [Scheduled]                     │
│                                                         │
│ [Continue Setup] [Save Progress] [Get Help]            │
└─────────────────────────────────────────────────────────┘
```

### **SonicWall Device Registration Form**
```
┌─────────────────────────────────────────────────────────┐
│ Add SonicWall Device (Device 1 of Multiple)            │
├─────────────────────────────────────────────────────────┤
│ Device Information:                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Management IP: [192.168.1.1        ] *Required     │ │
│ │ Device Name:   [NYC-HQ-Firewall    ] *Required     │ │
│ │ Location:      [New York HQ        ] *Required     │ │
│ │ Network Type:  [Headquarters ▼     ] Optional      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ API Credentials:                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Username: [admin                   ] *Required      │ │
│ │ Password: [••••••••••••••••••••••••] *Required      │ │
│ │                                                     │ │
│ │ ⚠️ These credentials will be encrypted and stored   │ │
│ │    securely. AVIAN needs API access to monitor     │ │
│ │    your firewall health and security events.       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Test Connection] [Cancel] [Add Device]                 │
│                                                         │
│ Connection Status: ✅ Connected successfully!           │
│                                                         │
│ 📍 Multiple Locations Supported:                       │
│ • Add firewalls from all your office locations         │
│ • Each device monitored independently                   │
│ • Location-specific alerts and reporting               │
│                                                         │
│ [+ Add Another Device] [Continue to Microsoft Setup]   │
└─────────────────────────────────────────────────────────┘
```

### **Microsoft Defender Setup Wizard**
```
┌─────────────────────────────────────────────────────────┐
│ Microsoft Defender Integration Setup                    │
├─────────────────────────────────────────────────────────┤
│ Step 1: Azure App Registration                          │
│                                                         │
│ We need to create an app registration in your Azure    │
│ tenant to access Microsoft Defender data.              │
│                                                         │
│ Option A: Automated Setup (Recommended)                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Click "Open Azure Portal" below                 │ │
│ │ 2. Sign in with Global Admin account               │ │
│ │ 3. We'll create the app registration for you       │ │
│ │ 4. Copy the credentials back here                   │ │
│ │                                                     │ │
│ │ [Open Azure Portal] [I've completed this]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Option B: Manual Setup                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Follow our step-by-step guide:                      │ │
│ │ 1. Go to Azure Portal > App Registrations          │ │
│ │ 2. Create new registration: "AVIAN Security"       │ │
│ │ 3. Grant these permissions:                         │ │
│ │    • SecurityEvents.Read.All                       │ │
│ │    • Device.Read.All                               │ │
│ │    • DeviceManagementManagedDevices.Read.All       │ │
│ │    • SecurityActions.ReadWrite.All                 │ │
│ │ 4. Create client secret                             │ │
│ │ 5. Enter credentials below                          │ │
│ │                                                     │ │
│ │ [View Detailed Guide]                               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### **Credential Entry Form**
```
┌─────────────────────────────────────────────────────────┐
│ Microsoft Graph API Credentials                         │
├─────────────────────────────────────────────────────────┤
│ Azure App Registration Details:                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Tenant ID:     [12345678-1234-1234-1234-123456789] │ │
│ │ Client ID:     [87654321-4321-4321-4321-987654321] │ │
│ │ Client Secret: [••••••••••••••••••••••••••••••••••] │ │
│ │                                                     │ │
│ │ 🔒 All credentials are encrypted before storage     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Test Connection] [Save Credentials]                    │
│                                                         │
│ Connection Status: ✅ Connected successfully!           │
│ • Found 156 devices in Microsoft Defender              │
│ • Found 142 devices in Intune                          │
│ • Permissions verified                                  │
│                                                         │
│ [Start Device Sync] [Configure Alerts]                 │
└─────────────────────────────────────────────────────────┘
```

## 🔧 **Technical Implementation**

### **Onboarding API Endpoints**
```typescript
// Client onboarding endpoints
POST /api/onboarding/clients          // Create new client
GET  /api/onboarding/clients/:id      // Get onboarding status
PUT  /api/onboarding/clients/:id      // Update onboarding progress

// SonicWall integration
POST /api/onboarding/firewall/test    // Test SonicWall connection
POST /api/onboarding/firewall/add     // Add SonicWall device
GET  /api/onboarding/firewall/status  // Get setup status

// Microsoft Defender integration  
POST /api/onboarding/defender/test    // Test Graph API connection
POST /api/onboarding/defender/setup   // Save Graph API credentials
POST /api/onboarding/defender/sync    // Start initial device sync
```

### **Database Schema Updates**
```sql
-- Client onboarding tracking
CREATE TABLE client_onboarding (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    step_basic_info BOOLEAN DEFAULT FALSE,
    step_firewall BOOLEAN DEFAULT FALSE,
    step_defender BOOLEAN DEFAULT FALSE,
    step_verification BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Integration credentials (encrypted)
CREATE TABLE integration_credentials (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    integration_type VARCHAR(50), -- 'sonicwall', 'microsoft_graph'
    credentials_encrypted TEXT,   -- JSON encrypted with tenant key
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 **Step-by-Step Onboarding Process**

### **For MSP Admin (You):**

#### **1. Create New Client**
```
1. Go to "Add New Client" in admin panel
2. Enter basic info (name, industry, contact)
3. System creates new tenant
4. Generate onboarding link for client
```

#### **2. Send Onboarding Link to Client**
```
Email to client IT admin:
"Welcome to AVIAN Security! 
Complete your setup: https://avian.security/onboard/abc123
This will take 15-20 minutes."
```

### **For Client IT Admin:**

#### **3. SonicWall Setup**
```
1. Client clicks onboarding link
2. Enters SonicWall device IPs and credentials
3. System tests each connection
4. Starts monitoring automatically
```

#### **4. Microsoft Defender Setup**
```
1. Client creates Azure App Registration (guided)
2. Grants required permissions
3. Enters credentials in AVIAN
4. System syncs all devices
```

#### **5. Verification**
```
1. System runs test alerts
2. Verifies device actions work
3. Sends test notifications
4. Marks onboarding complete
```

### **For Security Analysts:**

#### **6. Ready to Monitor**
```
1. Client appears in tenant list
2. Dashboard shows their devices
3. Alerts start flowing
4. Can take actions on their devices
```

## 🚀 **Implementation Priority**

### **Phase 1: Basic Onboarding (2 weeks)**
1. **Client creation form** - Basic tenant setup
2. **SonicWall device registration** - IP, credentials, test connection
3. **Microsoft Graph credential entry** - Manual credential input
4. **Connection testing** - Verify both integrations work

### **Phase 2: Guided Setup (1 week)**
1. **Step-by-step wizard** - Multi-step onboarding flow
2. **Azure setup guide** - Detailed instructions for app registration
3. **Progress tracking** - Show completion status
4. **Error handling** - Clear error messages and retry options

### **Phase 3: Automation (Future)**
1. **Automated Azure setup** - Direct Azure API integration
2. **Bulk device import** - CSV upload for multiple devices
3. **Template configurations** - Pre-configured settings by industry
4. **Self-service portal** - Clients can add devices themselves

## 💡 **Key Benefits**

### **For You (MSP):**
- **Standardized Process** - Same onboarding for every client
- **Reduced Setup Time** - Guided process vs manual configuration
- **Error Prevention** - Connection testing before going live
- **Scalable** - Handle multiple client onboardings simultaneously

### **For Clients:**
- **Clear Instructions** - Step-by-step guidance
- **Self-Service** - They can complete most steps themselves
- **Immediate Value** - See monitoring start right away
- **Support Available** - Help when they need it

### **For Security Analysts:**
- **Ready-to-Use** - Clients appear fully configured
- **Consistent Data** - Same data structure for all clients
- **No Manual Setup** - No need to configure each client manually

This onboarding workflow ensures every new client gets properly integrated with both SonicWall and Microsoft Defender, with clear progress tracking and error handling throughout the process.
