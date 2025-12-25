import { NextRequest, NextResponse } from 'next/server';

interface LivenessCheck {
  alive: boolean;
  timestamp: string;
  uptime: number;
  pid: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const memoryUsage = process.memoryUsage();
  
  const livenessCheck: LivenessCheck = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    pid: process.pid,
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    }
  };

  // Basic health check - if we can respond, we're alive
  return NextResponse.json(livenessCheck, { status: 200 });
}