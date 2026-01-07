# AWS Amplify Deployment Guide

## Prerequisites

1. **CDK Infrastructure Deployed**: Ensure your CDK stacks are deployed and you have the output values
2. **AWS CLI Configured**: With appropriate permissions for Amplify
3. **GitHub Repository**: Code pushed to GitHub repository

## Step 1: Deploy CDK Infrastructure

```bash
cd infrastructure
npm install
cdk deploy --all
```

**Save the CDK outputs** - you'll need these values for Amplify environment variables.

## Step 2: Create Amplify App

### Option A: Using AWS Console

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your GitHub repository
4. Select the branch (usually `main`)
5. Amplify will detect the `amplify.yml` build settings automatically

### Option B: Using AWS CLI

```bash
# Create Amplify app
aws amplify create-app --name avian-cybersecurity-platform --repository https://github.com/YOUR_USERNAME/YOUR_REPO

# Create branch
aws amplify create-branch --app-id YOUR_APP_ID --branch-name main --framework Next.js
```

## Step 3: Configure Environment Variables

In the Amplify Console, go to **App settings** → **Environment variables** and add:

### Required Variables (from CDK outputs):

```
AWS_REGION=us-east-1
DATABASE_SECRET_NAME=avian-database-credentials-prod
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from CDK output>
DYNAMODB_SESSIONS_TABLE=avian-sessions-prod
S3_FIREWALL_CONFIG_BUCKET=<from CDK output>
S3_REPORTS_BUCKET=<from CDK output>
AWS_S3_BUCKET=<from CDK output>
NODE_ENV=production
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_DEBUG_ROUTES=false
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Get CDK Output Values:

```bash
# Get Cognito values
aws cloudformation describe-stacks --stack-name AvianApplicationStack-prod --query 'Stacks[0].Outputs'

# Get S3 bucket names
aws cloudformation describe-stacks --stack-name AvianDataStack-prod --query 'Stacks[0].Outputs'

# Get database secret name
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `avian-database-credentials`)].Name'
```

## Step 4: Configure IAM Role for Amplify

Amplify needs permissions to access your AWS resources. Create an IAM role with these policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:avian-database-credentials-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/avian-sessions-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::avian-firewall-configs-*/*",
        "arn:aws:s3:::avian-reports-*/*"
      ]
    }
  ]
}
```

## Step 5: Deploy

1. **Trigger Build**: Push code to your connected branch or manually trigger build in Amplify Console
2. **Monitor Build**: Watch the build logs in Amplify Console
3. **Test Deployment**: Once deployed, test the application functionality

## Step 6: Configure Custom Domain (Optional)

1. In Amplify Console, go to **App settings** → **Domain management**
2. Add your custom domain
3. Amplify will handle SSL certificate provisioning

## Troubleshooting

### Build Failures

- Check build logs in Amplify Console
- Verify all environment variables are set correctly
- Ensure CDK infrastructure is deployed and accessible

### Runtime Errors

- Check CloudWatch logs for Lambda functions
- Verify IAM permissions for Amplify service role
- Test database connectivity from Amplify environment

### Database Connection Issues

- Verify RDS security groups allow connections from Amplify
- Check that database secret exists and is accessible
- Ensure VPC configuration allows Amplify to reach RDS

## Environment-Specific Deployments

For multiple environments (dev, staging, prod):

1. Deploy separate CDK stacks for each environment
2. Create separate Amplify branches
3. Configure environment-specific variables for each branch

```bash
# Example for staging
cdk deploy --all --context environment=staging
```

Then configure staging-specific environment variables in Amplify Console for the staging branch.
