# Avian Security Agent - Design Document

## Overview
The Avian Security Agent is a cross-platform system service written in Go that provides asset discovery, security monitoring, and remote management capabilities. The agent is designed to be lightweight, secure, and resilient, operating autonomously while maintaining regular communication with the Avian platform.

## Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Avian Platform                        │
│  (APIs: /api/agents/register, /heartbeat, /telemetry)  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS/TLS
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Avian Agent                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Main Service Controller                 │  │
│  └──┬────────┬────────┬────────┬────────┬──────────┘  │
│     │        │        │        │        │              │
│  ┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌──▼──┐ ┌───▼────┐        │
│  │Reg  │ │Heart│ │Asset │ │Tool │ │Telemetry│        │
│  │ister│ │beat │ │Scan  │ │Mgr  │ │Collector│        │
│  └─────┘ └─────┘ └──────┘ └─────┘ └─────────┘        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Support Services                          │  │
│  │  • Config Manager  • Logger  • HTTP Client       │  │
│  │  • Data Buffer     • Crypto  • Update Manager    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Language:** Go 1.21+ (single binary, cross-platform, excellent concurrency)
- **HTTP Client:** net/http with retry logic
- **Logging:** zerolog (structured, fast)
- **Configuration:** YAML with viper
- **Service Management:** kardianos/service (cross-platform)
- **System Info:** shirou/gopsutil (cross-platform system metrics)
- **Crypto:** Go standard library (crypto/tls, crypto/sha256)

## Components and Interfaces

### 1. Main Service Controller
**Responsibility:** Orchestrate all agent components and manage lifecycle

```go
type AgentService struct {
    config          *Config
    httpClient      *HTTPClient
    registrar       *Registrar
    heartbeat       *HeartbeatService
    assetScanner    *AssetScanner
    toolManager     *ToolManager
    telemetry       *TelemetryCollector
    configManager   *ConfigManager
    updateManager   *UpdateManager
    logger          *Logger
    shutdownChan    chan struct{}
}

func (s *AgentService) Start() error
func (s *AgentService) Stop() error
func (s *AgentService) Run() error
```

### 2. Registrar
**Responsibility:** Handle agent registration with platform

```go
type Registrar struct {
    client          *HTTPClient
    config          *Config
    logger          *Logger
}

func (r *Registrar) Register(deploymentKey string) (*RegistrationResponse, error)
func (r *Registrar) IsRegistered() bool
func (r *Registrar) GetAgentID() string
func (r *Registrar) SaveCredentials(agentID, token string) error
```

**Registration Flow:**
1. Read deployment key from config/command line
2. Collect system information (hostname, IP, OS, hardware)
3. POST to `/api/agents/register` with deployment key
4. Receive agent ID and authentication token
5. Store credentials encrypted on disk
6. Mark agent as registered

### 3. Heartbeat Service
**Responsibility:** Maintain regular communication with platform

```go
type HeartbeatService struct {
    client          *HTTPClient
    config          *Config
    logger          *Logger
    interval        time.Duration
    ticker          *time.Ticker
    failureCount    int
    maxRetries      int
}

func (h *HeartbeatService) Start() error
func (h *HeartbeatService) Stop() error
func (h *HeartbeatService) SendHeartbeat() error
func (h *HeartbeatService) GetHealthMetrics() *HealthMetrics
```

**Heartbeat Data:**
- Agent ID
- Timestamp
- Status (running, scanning, installing, error)
- Health metrics (CPU, memory, disk)
- Last scan time
- Installed tools status
- Queue sizes

**Retry Logic:**
- Initial retry: 5 seconds
- Exponential backoff: 5s, 10s, 20s, 40s, 80s
- Max interval: 5 minutes
- Reset on success

### 4. Asset Scanner
**Responsibility:** Discover and inventory system assets

```go
type AssetScanner struct {
    logger          *Logger
    scanInterval    time.Duration
    lastScan        time.Time
    lastInventory   *AssetInventory
}

func (a *AssetScanner) PerformFullScan() (*AssetInventory, error)
func (a *AssetScanner) PerformIncrementalScan() (*AssetDelta, error)
func (a *AssetScanner) ScanHardware() (*HardwareInfo, error)
func (a *AssetScanner) ScanSoftware() (*SoftwareInfo, error)
func (a *AssetScanner) ScanNetwork() (*NetworkInfo, error)
```

**Hardware Scanning:**
- CPU: Model, cores, threads, frequency, architecture
- Memory: Total, available, type
- Storage: Devices, capacity, free space, type
- Network: Interfaces, MAC addresses, IP addresses

**Software Scanning:**
- OS: Name, version, build, architecture
- Installed applications (platform-specific)
- Running services
- Open ports
- Environment variables (selected)

**Scan Schedule:**
- Full scan: On startup, then every 24 hours
- Incremental scan: Every hour
- On-demand: When platform requests

### 5. Tool Manager
**Responsibility:** Install and manage security tools

```go
type ToolManager struct {
    client          *HTTPClient
    logger          *Logger
    installDir      string
    installedTools  map[string]*InstalledTool
}

func (t *ToolManager) InstallTool(config *ToolConfig) error
func (t *ToolManager) UninstallTool(toolID string) error
func (t *ToolManager) GetToolStatus(toolID string) (*ToolStatus, error)
func (t *ToolManager) ListInstalledTools() []*InstalledTool
func (t *ToolManager) MonitorTools() error
```

**Installation Process:**
1. Receive installation command from platform
2. Download tool package with progress tracking
3. Verify SHA-256 checksum
4. Extract if compressed
5. Execute installation script/binary
6. Verify installation success
7. Report status to platform
8. Start monitoring tool

**Tool Monitoring:**
- Check if process is running
- Monitor resource usage
- Detect crashes and restart if configured
- Report status in heartbeat

### 6. Telemetry Collector
**Responsibility:** Collect and send system metrics and events

```go
type TelemetryCollector struct {
    client          *HTTPClient
    logger          *Logger
    buffer          *DataBuffer
    collectInterval time.Duration
}

func (t *TelemetryCollector) Start() error
func (t *TelemetryCollector) Stop() error
func (t *TelemetryCollector) CollectMetrics() (*SystemMetrics, error)
func (t *TelemetryCollector) SendTelemetry(data *TelemetryData) error
func (t *TelemetryCollector) BufferData(data *TelemetryData) error
```

**Metrics Collected:**
- CPU usage (per core and total)
- Memory usage (used, available, swap)
- Disk I/O (read/write bytes, operations)
- Network I/O (bytes sent/received, packets)
- Process count
- System load average

**Event Types:**
- Security events (from tools)
- System events (service start/stop, crashes)
- Configuration changes
- Installation events
- Error events

### 7. HTTP Client
**Responsibility:** Handle all HTTP communication with platform

```go
type HTTPClient struct {
    client          *http.Client
    baseURL         string
    agentID         string
    authToken       string
    logger          *Logger
    retryPolicy     *RetryPolicy
}

func (h *HTTPClient) Post(endpoint string, data interface{}) (*Response, error)
func (h *HTTPClient) Get(endpoint string) (*Response, error)
func (h *HTTPClient) Download(url string, dest string) error
func (h *HTTPClient) WithRetry(fn func() error) error
```

**Features:**
- TLS 1.2+ enforcement
- Certificate validation
- Request signing (HMAC-SHA256)
- Automatic retries with backoff
- Timeout handling (30s default)
- Connection pooling
- Compression support (gzip)

### 8. Config Manager
**Responsibility:** Manage agent configuration

```go
type ConfigManager struct {
    configPath      string
    config          *Config
    logger          *Logger
    mutex           sync.RWMutex
}

func (c *ConfigManager) Load() error
func (c *ConfigManager) Save() error
func (c *ConfigManager) Update(newConfig *Config) error
func (c *ConfigManager) Get(key string) interface{}
func (c *ConfigManager) Validate() error
```

**Configuration Structure:**
```yaml
agent:
  id: ""
  deployment_key: ""
  auth_token: ""
  
platform:
  url: "https://platform.avian.com"
  api_version: "v1"
  
intervals:
  heartbeat: 60s
  full_scan: 24h
  incremental_scan: 1h
  telemetry: 60s
  
resources:
  max_memory_mb: 200
  max_cpu_percent: 5
  max_buffer_mb: 100
  
logging:
  level: "info"
  file: "/var/log/avian-agent/agent.log"
  max_size_mb: 10
  max_backups: 3
```

### 9. Data Buffer
**Responsibility:** Buffer data during offline periods

```go
type DataBuffer struct {
    maxSize         int64
    currentSize     int64
    buffer          []BufferedItem
    mutex           sync.RWMutex
    persistPath     string
}

func (d *DataBuffer) Add(item *BufferedItem) error
func (d *DataBuffer) GetAll() []BufferedItem
func (d *DataBuffer) Clear() error
func (d *DataBuffer) Persist() error
func (d *DataBuffer) Load() error
```

**Buffer Strategy:**
- FIFO queue with size limit (100MB default)
- Persist to disk on shutdown
- Load on startup
- Discard oldest when full
- Compress large items

### 10. Update Manager
**Responsibility:** Handle agent self-updates

```go
type UpdateManager struct {
    client          *HTTPClient
    logger          *Logger
    currentVersion  string
    updateChannel   string
}

func (u *UpdateManager) CheckForUpdates() (*UpdateInfo, error)
func (u *UpdateManager) DownloadUpdate(version string) (string, error)
func (u *UpdateManager) VerifyUpdate(path string) error
func (u *UpdateManager) InstallUpdate(path string) error
func (u *UpdateManager) Rollback() error
```

**Update Process:**
1. Check platform for new version
2. Download update package
3. Verify signature (RSA or Ed25519)
4. Backup current binary
5. Replace binary
6. Restart service
7. Verify new version running
8. Report success or rollback

## Data Models

### Agent Registration
```go
type RegistrationRequest struct {
    TenantID        string          `json:"tenant_id"`
    DeploymentKey   string          `json:"deployment_key"`
    Hostname        string          `json:"hostname"`
    IPAddress       string          `json:"ip_address"`
    OSInfo          *OSInfo         `json:"os_info"`
    HardwareInfo    *HardwareInfo   `json:"hardware_info"`
    AgentVersion    string          `json:"agent_version"`
}

type RegistrationResponse struct {
    AgentID         string          `json:"agent_id"`
    AuthToken       string          `json:"auth_token"`
    Status          string          `json:"registration_status"`
    Config          *AgentConfig    `json:"config"`
}
```

### Heartbeat
```go
type HeartbeatData struct {
    AgentID         string          `json:"agent_id"`
    Timestamp       time.Time       `json:"timestamp"`
    Status          string          `json:"status"`
    HealthMetrics   *HealthMetrics  `json:"health_metrics"`
    LastScanTime    time.Time       `json:"last_scan_time"`
    InstalledTools  []ToolStatus    `json:"installed_tools"`
    QueueSizes      *QueueSizes     `json:"queue_sizes"`
}

type HealthMetrics struct {
    CPUPercent      float64         `json:"cpu_percent"`
    MemoryUsedMB    int64           `json:"memory_used_mb"`
    DiskUsedPercent float64         `json:"disk_used_percent"`
    Uptime          int64           `json:"uptime_seconds"`
}
```

### Asset Inventory
```go
type AssetInventory struct {
    AgentID         string          `json:"agent_id"`
    Timestamp       time.Time       `json:"timestamp"`
    Hardware        *HardwareInfo   `json:"hardware"`
    Software        *SoftwareInfo   `json:"software"`
    Network         *NetworkInfo    `json:"network"`
}

type HardwareInfo struct {
    Manufacturer    string          `json:"manufacturer"`
    Model           string          `json:"model"`
    CPU             *CPUInfo        `json:"cpu"`
    Memory          *MemoryInfo     `json:"memory"`
    Storage         []StorageDevice `json:"storage"`
}
```

## Error Handling

### Error Categories
1. **Network Errors** - Retry with backoff
2. **Authentication Errors** - Re-register if token invalid
3. **Configuration Errors** - Use defaults, log warning
4. **Resource Errors** - Throttle operations
5. **Fatal Errors** - Log, report, restart service

### Error Recovery
```go
type ErrorHandler struct {
    logger          *Logger
    retryPolicy     *RetryPolicy
}

func (e *ErrorHandler) Handle(err error) error
func (e *ErrorHandler) IsRetryable(err error) bool
func (e *ErrorHandler) ShouldRestart(err error) bool
```

**Recovery Strategies:**
- Network failures: Retry with exponential backoff
- Platform unavailable: Enter offline mode
- Disk full: Purge old logs and buffers
- Memory pressure: Reduce buffer sizes
- CPU throttling: Increase scan intervals

## Testing Strategy

### Unit Tests
- Test each component in isolation
- Mock HTTP client for API tests
- Mock file system for config tests
- Test error handling paths
- Test retry logic
- Test buffer overflow handling

### Integration Tests
- Test full registration flow
- Test heartbeat with real API
- Test asset scanning on test systems
- Test tool installation
- Test offline/online transitions
- Test configuration updates

### Platform Tests
- Test against local platform instance
- Verify all API endpoints work
- Test authentication and authorization
- Test data format compatibility
- Test error responses

### Performance Tests
- Measure memory usage over 24 hours
- Measure CPU usage during scans
- Test with 1000+ installed applications
- Test buffer performance with 100MB data
- Measure startup time

## Security Considerations

### Credential Storage
- Store auth token encrypted with AES-256
- Use platform-specific secure storage:
  - Windows: DPAPI
  - Linux: Keyring or encrypted file
  - macOS: Keychain
- Never log credentials
- Rotate tokens periodically

### Communication Security
- Enforce TLS 1.2+
- Validate server certificates
- Pin platform certificate (optional)
- Sign all requests with HMAC-SHA256
- Include timestamp to prevent replay attacks

### Code Security
- No hardcoded secrets
- Sign all release binaries
- Verify update signatures
- Run with minimal privileges
- Sandbox tool installations (future)

### Data Security
- Encrypt sensitive data in buffers
- Sanitize logs (no PII, no secrets)
- Secure file permissions (0600 for config)
- Clear memory after use (credentials)

## Deployment

### Installation Package
- Single binary (statically linked)
- Installation script (bash/PowerShell)
- Service configuration files
- Default configuration template
- Uninstall script

### Installation Process
```bash
# Linux
sudo ./install-avian-agent.sh --deployment-key=KEY

# Windows
.\install-avian-agent.ps1 -DeploymentKey KEY

# macOS
sudo ./install-avian-agent.sh --deployment-key=KEY
```

### Directory Structure
```
Linux/macOS:
/opt/avian-agent/
  ├── bin/avian-agent
  ├── config/agent.yaml
  └── data/buffer.db

/var/log/avian-agent/
  └── agent.log

Windows:
C:\Program Files\Avian Agent\
  ├── avian-agent.exe
  ├── config\agent.yaml
  └── data\buffer.db

C:\ProgramData\Avian Agent\Logs\
  └── agent.log
```

## Performance Targets

- **Startup Time:** < 10 seconds
- **Memory (Idle):** < 50MB
- **Memory (Active):** < 200MB
- **CPU (Idle):** < 1%
- **CPU (Scanning):** < 10%
- **Disk Space:** < 100MB
- **Network (Heartbeat):** < 1KB/min
- **Network (Telemetry):** < 10KB/min
- **Network (Scan):** < 1MB/scan

## Monitoring and Observability

### Metrics Exposed
- Heartbeat success/failure rate
- API call latency
- Buffer size
- Memory usage
- CPU usage
- Scan duration
- Tool installation success rate

### Logging Levels
- **DEBUG:** Detailed execution flow
- **INFO:** Normal operations
- **WARN:** Recoverable errors
- **ERROR:** Serious errors
- **FATAL:** Unrecoverable errors

### Health Checks
- Self-health check every 5 minutes
- Report health in heartbeat
- Automatic restart on failure
- Platform can query health status

## Future Enhancements

### Phase 2
- Real-time event streaming
- Advanced threat detection
- Local policy enforcement
- Agent-to-agent communication

### Phase 3
- Plugin system for extensions
- Custom script execution
- Advanced remediation actions
- Compliance scanning

---

**Design Status:** Ready for implementation
**Next Step:** Create implementation task list
