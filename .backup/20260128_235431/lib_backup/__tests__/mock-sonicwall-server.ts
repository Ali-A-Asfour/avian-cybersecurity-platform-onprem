/**
 * Mock SonicWall API Server for Testing
 * 
 * Provides a mock HTTP server that simulates SonicWall API responses.
 * Supports authentication, security statistics, interfaces, system status, VPN, and licenses.
 * 
 * Requirements: Task 2.4 - Create mock SonicWall API server for testing
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export interface MockSonicWallServerConfig {
    port?: number;
    authToken?: string;
    username?: string;
    password?: string;
    simulateErrors?: boolean;
    simulateRateLimit?: boolean;
    simulateTimeout?: boolean;
    responseDelay?: number;
}

export interface MockSecurityStats {
    ips_blocks_today: number;
    gav_blocks_today: number;
    dpi_ssl_blocks_today: number;
    atp_verdicts_today: number;
    app_control_blocks_today: number;
    content_filter_blocks_today: number;
    botnet_blocks_today: number;
}

export interface MockInterfaceStatus {
    name: string;
    zone: string;
    ip_address: string;
    status: string;
    link_speed: string;
}

export interface MockSystemHealth {
    cpu_percent: number;
    ram_percent: number;
    uptime_seconds: number;
    firmware_version: string;
    model: string;
    serial_number: string;
    ha_role?: string;
    ha_state?: string;
}

export interface MockVPNPolicy {
    name: string;
    status: string;
    remote_gateway: string;
    encryption: string;
    authentication_method: string;
}

export interface MockLicenseInfo {
    ips_expiry: string;
    gav_expiry: string;
    atp_expiry: string;
    app_control_expiry: string;
    content_filter_expiry: string;
    support_expiry: string;
}

/**
 * Mock SonicWall API Server
 * 
 * Simulates a SonicWall firewall API for testing purposes.
 * Supports all major endpoints and error scenarios.
 */
export class MockSonicWallServer {
    private server: Server | null = null;
    private port: number;
    private authToken: string;
    private username: string;
    private password: string;
    private simulateErrors: boolean;
    private simulateRateLimit: boolean;
    private simulateTimeout: boolean;
    private responseDelay: number;
    private requestCount: number = 0;
    private rateLimitCount: number = 0;

    // Mock data
    private securityStats: MockSecurityStats = {
        ips_blocks_today: 100,
        gav_blocks_today: 50,
        dpi_ssl_blocks_today: 25,
        atp_verdicts_today: 10,
        app_control_blocks_today: 5,
        content_filter_blocks_today: 15,
        botnet_blocks_today: 8,
    };

    private interfaces: MockInterfaceStatus[] = [
        {
            name: 'X0',
            zone: 'WAN',
            ip_address: '192.168.1.1',
            status: 'up',
            link_speed: '1000Mbps',
        },
        {
            name: 'X1',
            zone: 'LAN',
            ip_address: '10.0.0.1',
            status: 'up',
            link_speed: '1000Mbps',
        },
        {
            name: 'X2',
            zone: 'DMZ',
            ip_address: '172.16.0.1',
            status: 'down',
            link_speed: '0',
        },
    ];

    private systemHealth: MockSystemHealth = {
        cpu_percent: 45.5,
        ram_percent: 60.2,
        uptime_seconds: 86400,
        firmware_version: '7.0.1-5050',
        model: 'TZ370',
        serial_number: 'ABC123456',
    };

    private vpnPolicies: MockVPNPolicy[] = [
        {
            name: 'Site-to-Site VPN',
            status: 'up',
            remote_gateway: '203.0.113.1',
            encryption: 'AES-256',
            authentication_method: 'PSK',
        },
        {
            name: 'Remote Access VPN',
            status: 'down',
            remote_gateway: '203.0.113.2',
            encryption: 'AES-128',
            authentication_method: 'Certificate',
        },
    ];

    private licenses: MockLicenseInfo = {
        ips_expiry: '2025-12-31',
        gav_expiry: '2025-12-31',
        atp_expiry: '2025-12-31',
        app_control_expiry: '2025-12-31',
        content_filter_expiry: '2025-12-31',
        support_expiry: '2025-12-31',
    };

    constructor(config: MockSonicWallServerConfig = {}) {
        this.port = config.port || 0; // 0 = random available port
        this.authToken = config.authToken || 'mock-auth-token-12345';
        this.username = config.username || 'admin';
        this.password = config.password || 'password123';
        this.simulateErrors = config.simulateErrors || false;
        this.simulateRateLimit = config.simulateRateLimit || false;
        this.simulateTimeout = config.simulateTimeout || false;
        this.responseDelay = config.responseDelay || 0;
    }

    /**
     * Start the mock server
     * 
     * @returns Promise that resolves when server is listening
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on('error', reject);

            this.server.listen(this.port, () => {
                const address = this.server!.address();
                if (address && typeof address === 'object') {
                    this.port = address.port;
                }
                resolve();
            });
        });
    }

    /**
     * Stop the mock server
     * 
     * @returns Promise that resolves when server is closed
     */
    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Get the server URL
     * 
     * @returns Server URL (e.g., http://localhost:3000)
     */
    getUrl(): string {
        return `http://localhost:${this.port}`;
    }

    /**
     * Get the server port
     * 
     * @returns Port number
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Reset request counters
     */
    resetCounters(): void {
        this.requestCount = 0;
        this.rateLimitCount = 0;
    }

    /**
     * Set mock security statistics
     */
    setSecurityStats(stats: Partial<MockSecurityStats>): void {
        this.securityStats = { ...this.securityStats, ...stats };
    }

    /**
     * Set mock interfaces
     */
    setInterfaces(interfaces: MockInterfaceStatus[]): void {
        this.interfaces = interfaces;
    }

    /**
     * Set mock system health
     */
    setSystemHealth(health: Partial<MockSystemHealth>): void {
        this.systemHealth = { ...this.systemHealth, ...health };
    }

    /**
     * Set mock VPN policies
     */
    setVPNPolicies(policies: MockVPNPolicy[]): void {
        this.vpnPolicies = policies;
    }

    /**
     * Set mock licenses
     */
    setLicenses(licenses: Partial<MockLicenseInfo>): void {
        this.licenses = { ...this.licenses, ...licenses };
    }

    /**
     * Enable/disable error simulation
     */
    setSimulateErrors(simulate: boolean): void {
        this.simulateErrors = simulate;
    }

    /**
     * Enable/disable rate limit simulation
     */
    setSimulateRateLimit(simulate: boolean): void {
        this.simulateRateLimit = simulate;
    }

    /**
     * Enable/disable timeout simulation
     */
    setSimulateTimeout(simulate: boolean): void {
        this.simulateTimeout = simulate;
    }

    /**
     * Set response delay in milliseconds
     */
    setResponseDelay(delay: number): void {
        this.responseDelay = delay;
    }

    /**
     * Handle incoming HTTP request
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        this.requestCount++;

        // Simulate timeout
        if (this.simulateTimeout) {
            // Don't respond - let the request hang
            return;
        }

        // Simulate response delay
        if (this.responseDelay > 0) {
            await this.sleep(this.responseDelay);
        }

        // Simulate rate limiting
        if (this.simulateRateLimit) {
            this.rateLimitCount++;
            if (this.rateLimitCount <= 2) {
                // First 2 requests get rate limited
                res.writeHead(429, {
                    'Content-Type': 'application/json',
                    'Retry-After': '60',
                });
                res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
                return;
            }
        }

        // Parse URL
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const path = url.pathname;

        // Route requests
        if (path === '/api/sonicos/auth') {
            await this.handleAuth(req, res);
        } else if (path === '/api/sonicos/reporting/security-services/statistics') {
            await this.handleSecurityStats(req, res);
        } else if (path === '/api/sonicos/interfaces') {
            await this.handleInterfaces(req, res);
        } else if (path === '/api/sonicos/system/status') {
            await this.handleSystemStatus(req, res);
        } else if (path === '/api/sonicos/vpn/policies') {
            await this.handleVPNPolicies(req, res);
        } else if (path === '/api/sonicos/licenses') {
            await this.handleLicenses(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }
    }

    /**
     * Handle authentication request
     */
    private async handleAuth(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // Read request body
        const body = await this.readBody(req);
        let credentials: any;

        try {
            credentials = JSON.parse(body);
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }

        // Simulate errors
        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        // Validate credentials
        if (credentials.username !== this.username || credentials.password !== this.password) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
        }

        // Return auth token
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: this.authToken }));
    }

    /**
     * Handle security statistics request
     */
    private async handleSecurityStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.checkAuth(req, res)) {
            return;
        }

        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.securityStats));
    }

    /**
     * Handle interfaces request
     */
    private async handleInterfaces(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.checkAuth(req, res)) {
            return;
        }

        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ interfaces: this.interfaces }));
    }

    /**
     * Handle system status request
     */
    private async handleSystemStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.checkAuth(req, res)) {
            return;
        }

        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.systemHealth));
    }

    /**
     * Handle VPN policies request
     */
    private async handleVPNPolicies(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.checkAuth(req, res)) {
            return;
        }

        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ policies: this.vpnPolicies }));
    }

    /**
     * Handle licenses request
     */
    private async handleLicenses(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.checkAuth(req, res)) {
            return;
        }

        if (this.simulateErrors) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.licenses));
    }

    /**
     * Check authentication header
     */
    private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing authorization header' }));
            return false;
        }

        const token = authHeader.replace('Bearer ', '');

        if (token !== this.authToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid auth token' }));
            return false;
        }

        return true;
    }

    /**
     * Read request body
     */
    private async readBody(req: IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                resolve(body);
            });

            req.on('error', reject);
        });
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
