import { NextRequest, NextResponse } from 'next/server';
import { DynamoSessionService } from '@/lib/aws/dynamodb-sessions';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    if (sessionId) {
      await DynamoSessionService.deleteSession(sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: true }); // Always succeed for logout
  }
}
