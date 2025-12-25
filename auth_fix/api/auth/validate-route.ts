import { NextRequest, NextResponse } from 'next/server';
import { DynamoSessionService } from '@/lib/aws/dynamodb-sessions';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    const sessionResult = await DynamoSessionService.validateSession(sessionId);
    
    if (sessionResult.valid) {
      await DynamoSessionService.extendSession(sessionId);
      return NextResponse.json({ 
        success: true, 
        user: sessionResult.user 
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Session validation failed' },
      { status: 401 }
    );
  }
}
