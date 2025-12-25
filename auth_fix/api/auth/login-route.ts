import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/aws/cognito-auth';
import { DynamoSessionService } from '@/lib/aws/dynamodb-sessions';

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe } = await request.json();
    
    const cognitoUser = await authenticateUser(email, password);
    
    const sessionId = await DynamoSessionService.createSession(
      cognitoUser.id,
      {
        email: cognitoUser.email,
        name: cognitoUser.name,
        role: cognitoUser.role,
        tenantId: cognitoUser.tenantId,
      },
      {
        rememberMe,
        metadata: {
          cognitoTokens: {
            accessToken: cognitoUser.accessToken,
            refreshToken: cognitoUser.refreshToken,
            idToken: cognitoUser.idToken,
          }
        }
      }
    );

    const authUser = {
      id: cognitoUser.id,
      email: cognitoUser.email,
      name: cognitoUser.name,
      role: cognitoUser.role,
      tenantId: cognitoUser.tenantId,
    };

    return NextResponse.json({ 
      success: true, 
      user: authUser, 
      sessionId 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
