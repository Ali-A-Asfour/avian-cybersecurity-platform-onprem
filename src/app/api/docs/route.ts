import { NextRequest, NextResponse } from 'next/server';
import { OpenAPIUtils } from '@/lib/openapi';

/**
 * GET /api/docs - Serve OpenAPI documentation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Get the OpenAPI specification
    const spec = OpenAPIUtils.getSpec();

    // Add dynamic server URL based on request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Update server URLs
    spec.servers = [
      {
        url: `${baseUrl}/api`,
        description: 'Current server',
      },
      ...(spec.servers || []),
    ];

    if (format === 'yaml') {
      return new NextResponse(OpenAPIUtils.getSpecYAML(), {
        headers: {
          'Content-Type': 'application/x-yaml',
          'Content-Disposition': 'attachment; filename="avian-api.yaml"',
        },
      });
    }

    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch {
    console.error('Error serving OpenAPI documentation:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DOCUMENTATION_ERROR',
          message: 'Failed to serve API documentation',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/docs - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}