/**
 * OpenAPI/Swagger documentation utilities for AVIAN Platform
 */

export interface OpenAPIInfo {
  title: string;
  version: string;
  description: string;
  contact?: {
    name: string;
    email: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description: string;
}

export interface OpenAPISecurityScheme {
  type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
  scheme?: string;
  bearerFormat?: string;
  in?: 'query' | 'header' | 'cookie';
  name?: string;
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema: any;
  example?: any;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: any;
      example?: any;
    };
  };
}

export interface OpenAPIResponse {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: any;
      example?: any;
    };
  };
  headers?: {
    [headerName: string]: {
      description?: string;
      schema: any;
    };
  };
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: {
    [statusCode: string]: OpenAPIResponse;
  };
  security?: Array<{ [securitySchemeName: string]: string[] }>;
}

export interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
}

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: {
    [path: string]: OpenAPIPath;
  };
  components?: {
    schemas?: { [schemaName: string]: any };
    responses?: { [responseName: string]: OpenAPIResponse };
    parameters?: { [parameterName: string]: OpenAPIParameter };
    requestBodies?: { [requestBodyName: string]: OpenAPIRequestBody };
    securitySchemes?: { [schemeName: string]: OpenAPISecurityScheme };
  };
  security?: Array<{ [securitySchemeName: string]: string[] }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * AVIAN Platform OpenAPI specification
 */
export const avianOpenAPISpec: OpenAPIDocument = {
  openapi: '3.0.3',
  info: {
    title: 'AVIAN Cybersecurity Platform API',
    version: '1.0.0',
    description: `
# AVIAN Platform API

The AVIAN Cybersecurity Platform provides comprehensive APIs for managing cybersecurity operations, including:

- **Authentication & Authorization**: JWT-based authentication with MFA support
- **Multi-Tenant Management**: Secure tenant isolation and management
- **Ticket Management**: Security incident tracking and workflow management
- **Alert Management**: Real-time security alert processing and correlation
- **Compliance Tracking**: Multi-framework compliance monitoring and reporting
- **Notification System**: Real-time notifications and communication
- **Dashboard & Analytics**: Comprehensive security posture visualization

## Authentication

All API endpoints (except public ones) require authentication using JWT Bearer tokens:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

API requests are rate-limited based on the endpoint type:
- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per hour
- User-specific endpoints: 1000 requests per hour
- Webhook endpoints: 1000 requests per minute

Rate limit information is included in response headers:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Unix timestamp when the rate limit resets

## Error Handling

All API responses follow a consistent format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456789"
  }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... },
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456789"
  }
}
\`\`\`

## Pagination

List endpoints support pagination with the following query parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 50, max: 100)
- \`sort_by\`: Field to sort by
- \`sort_order\`: Sort direction (asc/desc, default: desc)
    `,
    contact: {
      name: 'AVIAN Platform Support',
      email: 'support@avian-platform.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://api.avian-platform.com/v1',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.avian-platform.com/v1',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
    schemas: {
      // Common schemas
      UUID: {
        type: 'string',
        format: 'uuid',
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
      Timestamp: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-01T00:00:00Z',
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          sort_by: { type: 'string' },
          sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      
      // Error schemas
      ApiError: {
        type: 'object',
        required: ['code', 'message', 'timestamp', 'request_id'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Invalid request data' },
          details: { type: 'object' },
          timestamp: { $ref: '#/components/schemas/Timestamp' },
          request_id: { type: 'string', example: 'req_123456789' },
          path: { type: 'string', example: '/api/tickets' },
        },
      },
      
      // User schemas
      User: {
        type: 'object',
        required: ['id', 'tenant_id', 'email', 'first_name', 'last_name', 'role'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          tenant_id: { $ref: '#/components/schemas/UUID' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string', maxLength: 50 },
          last_name: { type: 'string', maxLength: 50 },
          role: { 
            type: 'string', 
            enum: ['super_admin', 'tenant_admin', 'analyst', 'user'] 
          },
          mfa_enabled: { type: 'boolean' },
          last_login: { $ref: '#/components/schemas/Timestamp' },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
      
      // Tenant schemas
      Tenant: {
        type: 'object',
        required: ['id', 'name', 'domain'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          name: { type: 'string', maxLength: 100 },
          domain: { type: 'string', maxLength: 100 },
          logo_url: { type: 'string', format: 'uri' },
          theme_color: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
          settings: { type: 'object' },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
      
      // Ticket schemas
      Ticket: {
        type: 'object',
        required: ['id', 'tenant_id', 'title', 'description', 'category', 'severity', 'priority', 'status'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          tenant_id: { $ref: '#/components/schemas/UUID' },
          requester: { type: 'string' },
          assignee: { $ref: '#/components/schemas/UUID' },
          title: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 5000 },
          category: {
            type: 'string',
            enum: ['security_incident', 'vulnerability', 'compliance', 'access_request', 'other']
          },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'awaiting_response', 'resolved', 'closed']
          },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          sla_deadline: { $ref: '#/components/schemas/Timestamp' },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
      
      // Alert schemas
      Alert: {
        type: 'object',
        required: ['id', 'tenant_id', 'source', 'title', 'description', 'severity', 'category', 'status'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          tenant_id: { $ref: '#/components/schemas/UUID' },
          source: { type: 'string', maxLength: 100 },
          title: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 5000 },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          category: {
            type: 'string',
            enum: ['malware', 'phishing', 'data_breach', 'unauthorized_access', 'policy_violation', 'other']
          },
          status: {
            type: 'string',
            enum: ['open', 'investigating', 'resolved', 'false_positive']
          },
          metadata: { type: 'object' },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
      
      // Compliance schemas
      ComplianceFramework: {
        type: 'object',
        required: ['id', 'name', 'version'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          name: { type: 'string', maxLength: 100 },
          version: { type: 'string', maxLength: 20 },
          description: { type: 'string', maxLength: 1000 },
          controls: {
            type: 'array',
            items: { $ref: '#/components/schemas/ComplianceControl' }
          },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
      
      ComplianceControl: {
        type: 'object',
        required: ['id', 'framework_id', 'title', 'status'],
        properties: {
          id: { $ref: '#/components/schemas/UUID' },
          framework_id: { $ref: '#/components/schemas/UUID' },
          title: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          status: {
            type: 'string',
            enum: ['not_started', 'in_progress', 'completed', 'not_applicable']
          },
          notes: { type: 'string', maxLength: 2000 },
          evidence: { type: 'array', items: { type: 'object' } },
          last_reviewed: { $ref: '#/components/schemas/Timestamp' },
          created_at: { $ref: '#/components/schemas/Timestamp' },
          updated_at: { $ref: '#/components/schemas/Timestamp' },
        },
      },
    },
    
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      
      ValidationError: {
        description: 'Invalid request data',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      
      RateLimitError: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': {
            description: 'Maximum requests allowed',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in current window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Unix timestamp when rate limit resets',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      
      SortByParam: {
        name: 'sort_by',
        in: 'query',
        description: 'Field to sort by',
        schema: { type: 'string' },
      },
      
      SortOrderParam: {
        name: 'sort_order',
        in: 'query',
        description: 'Sort direction',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      },
      
      TenantIdParam: {
        name: 'tenant_id',
        in: 'path',
        required: true,
        description: 'Tenant ID',
        schema: { $ref: '#/components/schemas/UUID' },
      },
      
      UserIdParam: {
        name: 'user_id',
        in: 'path',
        required: true,
        description: 'User ID',
        schema: { $ref: '#/components/schemas/UUID' },
      },
      
      TicketIdParam: {
        name: 'ticket_id',
        in: 'path',
        required: true,
        description: 'Ticket ID',
        schema: { $ref: '#/components/schemas/UUID' },
      },
      
      AlertIdParam: {
        name: 'alert_id',
        in: 'path',
        required: true,
        description: 'Alert ID',
        schema: { $ref: '#/components/schemas/UUID' },
      },
    },
  },
  
  security: [
    { BearerAuth: [] },
  ],
  
  tags: [
    { name: 'Authentication', description: 'User authentication and authorization' },
    { name: 'Users', description: 'User management operations' },
    { name: 'Tenants', description: 'Multi-tenant management' },
    { name: 'Tickets', description: 'Security incident ticket management' },
    { name: 'Alerts', description: 'Security alert management' },
    { name: 'Compliance', description: 'Compliance framework and control management' },
    { name: 'Dashboard', description: 'Dashboard and analytics data' },
    { name: 'Notifications', description: 'Notification management' },
    { name: 'Webhooks', description: 'Webhook endpoints for external integrations' },
  ],
  
  paths: {}, // Will be populated by individual route handlers
};

/**
 * Utility functions for OpenAPI documentation
 */
export class OpenAPIUtils {
  /**
   * Add a path to the OpenAPI specification
   */
  static addPath(path: string, pathItem: OpenAPIPath): void {
    avianOpenAPISpec.paths[path] = pathItem;
  }

  /**
   * Generate OpenAPI operation for a route
   */
  static createOperation(config: {
    tags?: string[];
    summary: string;
    description?: string;
    operationId?: string;
    parameters?: OpenAPIParameter[];
    requestBody?: OpenAPIRequestBody;
    responses?: { [statusCode: string]: OpenAPIResponse };
    security?: Array<{ [securitySchemeName: string]: string[] }>;
  }): OpenAPIOperation {
    return {
      ...config,
      responses: {
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' },
        '429': { $ref: '#/components/responses/RateLimitError' },
        '500': { $ref: '#/components/responses/InternalServerError' },
        ...config.responses,
      },
    };
  }

  /**
   * Generate standard CRUD operations for a resource
   */
  static createCrudOperations(
    resource: string,
    schema: string,
    options: {
      tags?: string[];
      requireAuth?: boolean;
      additionalOperations?: Partial<OpenAPIPath>;
    } = {}
  ): OpenAPIPath {
    const { tags = [resource], requireAuth = true } = options;
    const security = requireAuth ? [{ BearerAuth: [] }] : undefined;

    return {
      get: this.createOperation({
        tags,
        summary: `List ${resource}`,
        description: `Retrieve a paginated list of ${resource}`,
        operationId: `list${resource}`,
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortByParam' },
          { $ref: '#/components/parameters/SortOrderParam' },
        ],
        responses: {
          '200': {
            description: `List of ${resource}`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${schema}` },
                    },
                    meta: {
                      type: 'object',
                      properties: {
                        pagination: { $ref: '#/components/schemas/Pagination' },
                        timestamp: { $ref: '#/components/schemas/Timestamp' },
                        request_id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        security,
      }),
      
      post: this.createOperation({
        tags,
        summary: `Create ${resource}`,
        description: `Create a new ${resource}`,
        operationId: `create${resource}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schema}` },
            },
          },
        },
        responses: {
          '201': {
            description: `${resource} created successfully`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: `#/components/schemas/${schema}` },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
        security,
      }),
      
      ...options.additionalOperations,
    };
  }

  /**
   * Get the complete OpenAPI specification as JSON
   */
  static getSpec(): OpenAPIDocument {
    return avianOpenAPISpec;
  }

  /**
   * Generate OpenAPI specification as JSON string
   */
  static getSpecJSON(): string {
    return JSON.stringify(avianOpenAPISpec, null, 2);
  }

  /**
   * Generate OpenAPI specification as YAML string
   */
  static getSpecYAML(): string {
    // Simple YAML conversion - in production, use a proper YAML library
    return JSON.stringify(avianOpenAPISpec, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/{/g, '')
      .replace(/}/g, '');
  }
}