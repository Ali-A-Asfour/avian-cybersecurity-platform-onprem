/**
 * DynamoDB Session Service
 * 
 * Replaces Redis-based session management with DynamoDB integration
 * Uses the sessions table created by CDK infrastructure
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
  UpdateItemCommand,
  BatchGetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import crypto from 'crypto';
import { getDynamoDBClient } from './client-factory';

// Use optimized client from factory
const dynamoClient = getDynamoDBClient();

const SESSIONS_TABLE = process.env.DYNAMODB_SESSIONS_TABLE || 'avian-sessions-dev';

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: number; // Unix timestamp for TTL
  extendedSession?: boolean;
  rememberMe?: boolean;
  metadata?: any;
}

export class DynamoSessionService {
  private static readonly DEFAULT_SESSION_TIMEOUT = 3600; // 1 hour
  private static readonly EXTENDED_SESSION_TIMEOUT = 28800; // 8 hours
  private static readonly REMEMBER_ME_TIMEOUT = 604800; // 7 days
  private static readonly IDLE_TIMEOUT = 1800; // 30 minutes

  /**
   * Create a new session
   */
  static async createSession(
    userId: string,
    userData: {
      email: string;
      name: string;
      role: string;
      tenantId: string;
    },
    options: {
      expiresIn?: number;
      extendedSession?: boolean;
      rememberMe?: boolean;
      metadata?: any;
    } = {}
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    
    let expiresIn = options.expiresIn || this.DEFAULT_SESSION_TIMEOUT;
    if (options.extendedSession) {
      expiresIn = this.EXTENDED_SESSION_TIMEOUT;
    }
    if (options.rememberMe) {
      expiresIn = this.REMEMBER_ME_TIMEOUT;
    }

    const sessionData: SessionData = {
      sessionId,
      userId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      tenantId: userData.tenantId,
      createdAt: now.toISOString(),
      lastActivity: now.toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      extendedSession: options.extendedSession || false,
      rememberMe: options.rememberMe || false,
      metadata: options.metadata || {},
    };

    const command = new PutItemCommand({
      TableName: SESSIONS_TABLE,
      Item: marshall(sessionData),
    });

    await dynamoClient.send(command);
    return sessionId;
  }

  /**
   * Get session by session ID
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const command = new GetItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
      });

      const response = await dynamoClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      const sessionData = unmarshall(response.Item) as SessionData;
      
      // Check if session is expired
      if (sessionData.expiresAt < Math.floor(Date.now() / 1000)) {
        await this.deleteSession(sessionId);
        return null;
      }

      // Check idle timeout
      const lastActivity = new Date(sessionData.lastActivity);
      const idleTime = (Date.now() - lastActivity.getTime()) / 1000;
      
      if (idleTime > this.IDLE_TIMEOUT) {
        return null; // Session idle timeout
      }

      return sessionData;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const command = new UpdateItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
        UpdateExpression: 'SET lastActivity = :lastActivity',
        ExpressionAttributeValues: marshall({
          ':lastActivity': new Date().toISOString(),
        }),
        ConditionExpression: 'attribute_exists(sessionId)',
      });

      await dynamoClient.send(command);
      return true;
    } catch (error) {
      console.error('Failed to update session activity:', error);
      return false;
    }
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const command = new DeleteItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
      });

      await dynamoClient.send(command);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  /**
   * Get all sessions for a user (optimized with batch operations)
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      // First, get session IDs from GSI (KEYS_ONLY projection)
      const command = new QueryCommand({
        TableName: SESSIONS_TABLE,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: marshall({
          ':userId': userId,
        }),
      });

      const response = await dynamoClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        return [];
      }

      // Extract session IDs
      const sessionIds = response.Items.map(item => unmarshall(item).sessionId);
      
      // Use BatchGetItem for efficient retrieval (up to 100 items per request)
      const sessions: SessionData[] = [];
      const batchSize = 100;
      
      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);
        const batchCommand = new BatchGetItemCommand({
          RequestItems: {
            [SESSIONS_TABLE]: {
              Keys: batch.map(sessionId => marshall({ sessionId })),
            },
          },
        });

        const batchResponse = await dynamoClient.send(batchCommand);
        
        if (batchResponse.Responses?.[SESSIONS_TABLE]) {
          const batchSessions = batchResponse.Responses[SESSIONS_TABLE]
            .map(item => unmarshall(item) as SessionData)
            .filter(session => session.expiresAt > Math.floor(Date.now() / 1000));
          
          sessions.push(...batchSessions);
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Delete all sessions for a user
   */
  static async deleteUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      for (const session of sessions) {
        await this.deleteSession(session.sessionId);
      }
    } catch (error) {
      console.error('Failed to delete user sessions:', error);
    }
  }

  /**
   * Extend session expiration
   */
  static async extendSession(sessionId: string, additionalSeconds: number = 3600): Promise<boolean> {
    try {
      const newExpiresAt = Math.floor(Date.now() / 1000) + additionalSeconds;
      
      const command = new UpdateItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
        UpdateExpression: 'SET expiresAt = :expiresAt, lastActivity = :lastActivity',
        ExpressionAttributeValues: marshall({
          ':expiresAt': newExpiresAt,
          ':lastActivity': new Date().toISOString(),
        }),
        ConditionExpression: 'attribute_exists(sessionId)',
      });

      await dynamoClient.send(command);
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  /**
   * Validate session and return user data
   */
  static async validateSession(sessionId: string): Promise<{
    valid: boolean;
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId: string;
    };
    needsRefresh?: boolean;
  }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { valid: false };
    }

    // Update activity
    await this.updateSessionActivity(sessionId);

    // Check if session needs refresh (less than 10 minutes remaining)
    const timeRemaining = session.expiresAt - Math.floor(Date.now() / 1000);
    const needsRefresh = timeRemaining < 600; // 10 minutes

    return {
      valid: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        tenantId: session.tenantId,
      },
      needsRefresh,
    };
  }

  /**
   * Store additional session data
   */
  static async updateSessionData(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
    try {
      const updateExpressions: string[] = [];
      const attributeValues: any = {};
      
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'sessionId' && key !== 'userId') { // Don't update keys
          updateExpressions.push(`${key} = :${key}`);
          attributeValues[`:${key}`] = value;
        }
      });

      if (updateExpressions.length === 0) {
        return true;
      }

      const command = new UpdateItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: marshall(attributeValues),
        ConditionExpression: 'attribute_exists(sessionId)',
      });

      await dynamoClient.send(command);
      return true;
    } catch (error) {
      console.error('Failed to update session data:', error);
      return false;
    }
  }
}
