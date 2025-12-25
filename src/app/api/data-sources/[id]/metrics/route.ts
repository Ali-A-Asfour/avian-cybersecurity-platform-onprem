import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = params;

    // Mock metrics data for demonstration
    const metrics = {
      events_per_second: Math.random() * 100,
      total_events_today: Math.floor(Math.random() * 100000),
      error_rate: Math.random() * 10,
      latency_ms: Math.floor(Math.random() * 500) + 50,
      uptime_percentage: 95 + Math.random() * 5
    };

    return NextResponse.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Failed to fetch data source metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}