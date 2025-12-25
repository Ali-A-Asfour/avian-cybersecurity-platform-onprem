// WebSocket service for real-time notifications
// This would typically use Socket.IO or native WebSockets

export interface WebSocketMessage {
  type: 'notification' | 'alert' | 'ticket_update' | 'system_message';
  data: any;
  timestamp: Date;
  user_id?: string;
  tenant_id?: string;
}

export class WebSocketService {
  private static connections: Map<string, WebSocket[]> = new Map();

  /**
   * Register a WebSocket connection for a user
   */
  static registerConnection(userId: string, ws: WebSocket): void {
    const userConnections = this.connections.get(userId) || [];
    userConnections.push(ws);
    this.connections.set(userId, userConnections);

    // Clean up on close
    ws.addEventListener('close', () => {
      this.removeConnection(userId, ws);
    });
  }

  /**
   * Remove a WebSocket connection
   */
  static removeConnection(userId: string, ws: WebSocket): void {
    const userConnections = this.connections.get(userId) || [];
    const filteredConnections = userConnections.filter(conn => conn !== ws);
    
    if (filteredConnections.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, filteredConnections);
    }
  }

  /**
   * Send message to a specific user
   */
  static sendToUser(userId: string, message: WebSocketMessage): void {
    const userConnections = this.connections.get(userId) || [];
    
    userConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send message to all users in a tenant
   */
  static sendToTenant(tenantId: string, message: WebSocketMessage): void {
    // This would require maintaining a tenant-to-users mapping
    // For now, we'll iterate through all connections
    this.connections.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ...message, tenant_id: tenantId }));
        }
      });
    });
  }

  /**
   * Broadcast message to all connected users
   */
  static broadcast(message: WebSocketMessage): void {
    this.connections.forEach((connections) => {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    });
  }

  /**
   * Send notification via WebSocket
   */
  static sendNotification(userId: string, notification: {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    metadata?: Record<string, any>;
  }): void {
    const message: WebSocketMessage = {
      type: 'notification',
      data: notification,
      timestamp: new Date(),
      user_id: userId,
    };

    this.sendToUser(userId, message);
  }

  /**
   * Send alert notification via WebSocket
   */
  static sendAlertNotification(tenantId: string, alert: {
    id: string;
    title: string;
    severity: string;
    category: string;
  }): void {
    const message: WebSocketMessage = {
      type: 'alert',
      data: alert,
      timestamp: new Date(),
      tenant_id: tenantId,
    };

    this.sendToTenant(tenantId, message);
  }

  /**
   * Send ticket update notification via WebSocket
   */
  static sendTicketUpdate(userId: string, ticketUpdate: {
    ticket_id: string;
    title: string;
    status: string;
    assignee?: string;
  }): void {
    const message: WebSocketMessage = {
      type: 'ticket_update',
      data: ticketUpdate,
      timestamp: new Date(),
      user_id: userId,
    };

    this.sendToUser(userId, message);
  }

  /**
   * Get connection count for a user
   */
  static getUserConnectionCount(_userId: string): number {
    return this.connections.get(userId)?.length || 0;
  }

  /**
   * Get total connection count
   */
  static getTotalConnectionCount(): number {
    let total = 0;
    this.connections.forEach(connections => {
      total += connections.length;
    });
    return total;
  }
}

// Example usage in a Next.js API route:
/*
// pages/api/ws.ts or app/api/ws/route.ts
import { WebSocketService } from '@/services/websocket.service';

export function GET(_request: Request) {
  const { searchParams } = new URL(request.url);
  const _userId = searchParams.get('user_id');
  
  if (!userId) {
    return new Response('Missing user_id', { status: 400 });
  }

  // Upgrade to WebSocket (this would need proper WebSocket handling)
  // This is a simplified example - actual implementation would depend on your WebSocket library
  
  return new Response('WebSocket endpoint', { status: 200 });
}
*/