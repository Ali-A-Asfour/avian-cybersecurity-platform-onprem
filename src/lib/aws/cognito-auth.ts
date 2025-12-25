/**
 * AWS Cognito Authentication Service
 * 
 * Replaces custom JWT authentication with AWS Cognito integration
 * Provides secure authentication with AWS-managed security features
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListUsersCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { getCognitoClient } from './client-factory';

// Use optimized client from factory
const cognitoClient = getCognitoClient();

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

if (!USER_POOL_ID || !CLIENT_ID) {
  console.warn('Cognito configuration missing. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID');
}

export interface CognitoUser {
  id: string; // Cognito sub
  email: string;
  name: string;
  role: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<CognitoUser> {
  if (!CLIENT_ID) {
    throw new Error('Cognito not configured');
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Token refresh failed');
    }

    const { AccessToken, IdToken } = response.AuthenticationResult;

    if (!AccessToken || !IdToken) {
      throw new Error('Missing tokens in refresh response');
    }

    // Get user details with new access token
    const userCommand = new GetUserCommand({
      AccessToken,
    });

    const userResponse = await cognitoClient.send(userCommand);

    // Parse user attributes
    const attributes = userResponse.UserAttributes || [];
    const getAttr = (name: string) => attributes.find(attr => attr.Name === name)?.Value || '';

    return {
      id: userResponse.Username || '',
      email: getAttr('email'),
      name: `${getAttr('given_name')} ${getAttr('family_name')}`.trim(),
      role: getAttr('custom:user_role') || 'User',
      tenantId: getAttr('custom:tenant_id') || 'default',
      accessToken: AccessToken,
      refreshToken, // Keep the same refresh token
      idToken: IdToken,
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string): Promise<CognitoUser> {
  if (!USER_POOL_ID || !CLIENT_ID) {
    throw new Error('Cognito not configured');
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed');
    }

    const { AccessToken, RefreshToken, IdToken } = response.AuthenticationResult;

    if (!AccessToken || !RefreshToken || !IdToken) {
      throw new Error('Missing authentication tokens');
    }

    // Get user details
    const userCommand = new GetUserCommand({
      AccessToken,
    });

    const userResponse = await cognitoClient.send(userCommand);

    // Parse user attributes
    const attributes = userResponse.UserAttributes || [];
    const getAttr = (name: string) => attributes.find(attr => attr.Name === name)?.Value || '';

    return {
      id: userResponse.Username || '',
      email: getAttr('email'),
      name: `${getAttr('given_name')} ${getAttr('family_name')}`.trim(),
      role: getAttr('custom:user_role') || 'User',
      tenantId: getAttr('custom:tenant_id') || 'default',
      accessToken: AccessToken,
      refreshToken: RefreshToken,
      idToken: IdToken,
    };
  } catch (error) {
    console.error('Cognito authentication failed:', error);
    throw new Error('Invalid email or password');
  }
}

/**
 * Get current user from access token with automatic refresh
 */
export async function getCurrentUser(accessToken: string): Promise<CognitoUser> {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);

    // Parse user attributes
    const attributes = response.UserAttributes || [];
    const getAttr = (name: string) => attributes.find(attr => attr.Name === name)?.Value || '';

    return {
      id: response.Username || '',
      email: getAttr('email'),
      name: `${getAttr('given_name')} ${getAttr('family_name')}`.trim(),
      role: getAttr('custom:user_role') || 'User',
      tenantId: getAttr('custom:tenant_id') || 'default',
      accessToken,
      refreshToken: '', // Not available from GetUser
      idToken: '', // Not available from GetUser
    };
  } catch (error) {
    // If access token is expired, try to refresh
    const refreshToken = localStorage.getItem('cognito-refresh-token');
    if (refreshToken) {
      try {
        const refreshedUser = await refreshAccessToken(refreshToken);
        
        // Update stored tokens
        localStorage.setItem('cognito-access-token', refreshedUser.accessToken);
        localStorage.setItem('cognito-id-token', refreshedUser.idToken);
        
        return refreshedUser;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Clear invalid tokens
        localStorage.removeItem('cognito-access-token');
        localStorage.removeItem('cognito-refresh-token');
        localStorage.removeItem('cognito-id-token');
        throw new Error('Session expired');
      }
    }
    
    console.error('Failed to get current user:', error);
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Change user password
 */
export async function changePassword(
  accessToken: string,
  previousPassword: string,
  proposedPassword: string
): Promise<void> {
  try {
    const command = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword,
    });

    await cognitoClient.send(command);
  } catch (error) {
    console.error('Password change failed:', error);
    throw new Error('Failed to change password');
  }
}

/**
 * Initiate password reset
 */
export async function forgotPassword(email: string): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('Cognito not configured');
  }

  try {
    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    await cognitoClient.send(command);
  } catch (error) {
    console.error('Forgot password failed:', error);
    throw new Error('Failed to initiate password reset');
  }
}

/**
 * Confirm password reset with code
 */
export async function confirmForgotPassword(
  email: string,
  confirmationCode: string,
  newPassword: string
): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('Cognito not configured');
  }

  try {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    });

    await cognitoClient.send(command);
  } catch (error) {
    console.error('Confirm forgot password failed:', error);
    throw new Error('Failed to reset password');
  }
}

/**
 * Sign out user globally (invalidate all tokens)
 */
export async function signOutUser(accessToken: string): Promise<void> {
  try {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    await cognitoClient.send(command);
  } catch (error) {
    console.error('Global sign out failed:', error);
    // Don't throw - logout should always succeed locally
  }
}

/**
 * Admin function: Create new user
 */
export async function createUser(
  email: string,
  temporaryPassword: string,
  givenName: string,
  familyName: string,
  role: string,
  tenantId: string
): Promise<void> {
  if (!USER_POOL_ID) {
    throw new Error('Cognito not configured');
  }

  try {
    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      TemporaryPassword: temporaryPassword,
      MessageAction: 'SUPPRESS', // Don't send welcome email
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: givenName },
        { Name: 'family_name', Value: familyName },
        { Name: 'custom:user_role', Value: role },
        { Name: 'custom:tenant_id', Value: tenantId },
      ],
    });

    await cognitoClient.send(createCommand);

    // Add to appropriate group
    const groupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: role,
    });

    await cognitoClient.send(groupCommand);
  } catch (error) {
    console.error('User creation failed:', error);
    throw new Error('Failed to create user');
  }
}

/**
 * Validate access token and return user info
 */
export async function validateToken(accessToken: string): Promise<CognitoUser | null> {
  try {
    return await getCurrentUser(accessToken);
  } catch (error) {
    return null; // Invalid or expired token
  }
}
