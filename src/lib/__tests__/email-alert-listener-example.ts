/**
 * Email Alert Listener - Usage Example
 * 
 * This file demonstrates how to use the EmailAlertListener class
 * to monitor SonicWall alert emails.
 */

import { EmailAlertListener } from '../email-alert-listener';
import { logger } from '../logger';

/**
 * Example: Start email alert listener
 */
async function startEmailListener() {
    // Configure email connection
    const config = {
        host: process.env.EMAIL_HOST || 'imap.example.com',
        port: parseInt(process.env.EMAIL_PORT || '993'),
        user: process.env.EMAIL_USER || 'alerts@example.com',
        password: process.env.EMAIL_PASSWORD || 'password',
        tls: process.env.EMAIL_TLS === 'true' || true,
    };

    // Create listener
    const listener = new EmailAlertListener(config);

    // Start listening
    try {
        await listener.start();
        logger.info('Email alert listener started successfully');

        // Keep running (in production, this would be a long-running service)
        // For testing, we'll stop after 30 seconds
        setTimeout(async () => {
            await listener.stop();
            logger.info('Email alert listener stopped');
        }, 30000);
    } catch (error) {
        logger.error('Failed to start email alert listener', error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Example: Parse a sample email
 */
async function parseEmailExample() {
    const config = {
        host: 'imap.example.com',
        port: 993,
        user: 'alerts@example.com',
        password: 'password',
        tls: true,
    };

    const listener = new EmailAlertListener(config);

    // Sample email (simulated)
    const sampleEmail = {
        from: { text: 'alerts@sonicwall.com' },
        subject: 'IPS Alert - High Priority',
        text: 'Critical alert detected on firewall. Serial: C0EAE4123456. Multiple intrusion attempts blocked.',
        date: new Date(),
        headers: {},
    } as any;

    // Parse email
    const parsedAlert = await listener.parseEmail(sampleEmail);

    if (parsedAlert) {
        logger.info('Parsed alert:', parsedAlert);
        // Output:
        // {
        //   alertType: 'ips_alert',
        //   severity: 'critical',
        //   message: 'Critical alert detected...',
        //   timestamp: Date,
        //   deviceIdentifier: 'C0EAE4123456',
        //   deviceId: 'uuid-if-matched'
        // }
    }
}

/**
 * Example: Integration with existing system
 */
async function integrateWithSystem() {
    // In a real application, you would:

    // 1. Load configuration from environment
    const config = {
        host: process.env.EMAIL_HOST!,
        port: parseInt(process.env.EMAIL_PORT!),
        user: process.env.EMAIL_USER!,
        password: process.env.EMAIL_PASSWORD!,
        tls: process.env.EMAIL_TLS === 'true',
    };

    // 2. Create and start listener
    const listener = new EmailAlertListener(config);
    await listener.start();

    // 3. Handle graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down email listener');
        await listener.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down email listener');
        await listener.stop();
        process.exit(0);
    });

    logger.info('Email alert listener integrated with system');
}

// Export examples
export {
    startEmailListener,
    parseEmailExample,
    integrateWithSystem,
};

// Run example if executed directly
if (require.main === module) {
    startEmailListener().catch(console.error);
}
