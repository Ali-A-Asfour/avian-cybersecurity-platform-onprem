import { NextRequest, NextResponse } from 'next/server';

// Mock saved queries storage
const savedQueries: any[] = [];

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      queries: savedQueries
    });
  } catch {
    console.error('Failed to fetch saved queries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved queries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, query } = body;

    if (!name || !query) {
      return NextResponse.json(
        { error: 'Name and query are required' },
        { status: 400 }
      );
    }

    const newQuery = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      query,
      created_at: new Date().toISOString(),
      created_by: 'current_user' // In real implementation, get from auth
    };

    savedQueries.push(newQuery);

    return NextResponse.json({
      success: true,
      query: newQuery
    });
  } catch {
    console.error('Failed to save query:', error);
    return NextResponse.json(
      { error: 'Failed to save query' },
      { status: 500 }
    );
  }
}