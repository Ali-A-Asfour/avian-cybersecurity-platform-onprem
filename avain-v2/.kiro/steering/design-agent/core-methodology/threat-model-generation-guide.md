---
inclusion: manual
---

# Threat Model Generation Methodology v2.0

## Overview

This methodology provides a systematic approach for generating comprehensive, enterprise-grade threat model documents that follow industry best practices including STRIDE methodology, AWS security standards, and OWASP guidelines. This guide is designed to produce detailed threat models similar to AWS ThreatComposer outputs and enterprise security assessments.

## Target Output Format

The threat models generated using this methodology should follow this structure:

### Document Structure

1. **Document Header**
   - Application Name
   - Version
   - Date
   - Classification
   - Status

2. **Executive Summary**
   - Key Security Concerns (3-5 bullet points)
   - Risk Summary (Critical/High/Medium/Low counts)
   - Business Context

3. **Table of Contents**

4. **System Overview**
   - Application Description
   - Business Context (Industry, Regulatory Environment, Business Impact)
   - Technology Stack (Frontend, Backend, Data Layer, AI/ML, Security & Identity, Monitoring)

5. **Architecture Analysis**
   - High-Level Architecture (ASCII diagram)
   - Component Breakdown (by layer)
   - Security Characteristics per layer
   - Attack Surface per layer

6. **Data Flow Diagrams**
   - Multiple data flows with ASCII diagrams
   - Trust Boundaries marked (TB1, TB2, etc.)
   - Threats listed per trust boundary

7. **Trust Boundaries**
   - Trust Boundary Identification Table
   - Detailed Analysis per boundary

8. **Assets and Data Classification**
   - Asset Inventory Table
   - Data Classification (CRITICAL/HIGH/MEDIUM/LOW)
   - Data Flow Classification Table

9. **Threat Analysis (STRIDE)**
   - Organized by STRIDE category
   - Each threat includes:
     - Threat ID (S-01, T-01, R-01, I-01, D-01, E-01)
     - Severity (CRITICAL/HIGH/MEDIUM/LOW)
     - STRIDE Category
     - Component
     - **Threat Statement** (structured format - REQUIRED)
     - Description
     - Attack Scenario (numbered steps)
     - Impact (bullet points)
     - Affected Assets (with IDs)
     - Existing Controls
     - Vulnerabilities
     - Mitigations (numbered list)
     - Residual Risk

10. **Security Controls**
    - Baseline Security Controls
    - System-Specific Controls
    - Control Effectiveness Assessment

11. **Compliance Requirements**
    - Applicable Regulations
    - Compliance Mapping

12. **Recommendations**
    - Prioritized Action Items
    - Implementation Roadmap

13. **Existing Controls Mapping** (CRITICAL)
    - Current Implementation Status
    - Coverage Analysis by Threat
    - Control Coverage Percentages
    - Gap Analysis and Remediation Roadmap

14. **Appendices**
    - Glossary
    - References
    - Admin Information

---

## Security Analysis Principles

### Objectivity and Thoroughness Requirements

All threat model analyses must maintain rigorous objectivity and avoid these problematic patterns:

### Red Flags to Avoid:

1. **Overly Defensive Tone**
   - Do NOT write like an advocate trying to minimize security concerns
   - DO maintain objective, analytical tone throughout
   - DO acknowledge legitimate security risks without downplaying them

2. **Scope Minimization**
   - Do NOT understate the system's actual capabilities or reach
   - Do NOT ignore indirect impacts (e.g., "system doesn't process data" while ignoring that it influences systems that DO process data)
   - DO consider the full scope of influence, including downstream effects
   - DO analyze what the system actually enables, not just what it directly does

3. **Risk Dismissal Patterns**
   - Do NOT systematically dismiss security concerns without thorough investigation
   - Do NOT use dismissive language without detailed justification
   - DO provide substantive analysis for why risks are or aren't applicable
   - DO explain the reasoning behind risk assessments

4. **Contradictory Evidence Gaps**
   - Do NOT mention security features without explaining why they're necessary
   - DO explain why security controls exist and what threats they address
   - DO ensure consistency between stated risk levels and implemented controls

5. **Responsibility Shifting**
   - Do NOT dismiss risks by claiming "other systems will handle security"
   - Do NOT ignore how your system influences or enables security risks in connected systems
   - DO analyze the security implications of your system's role in the broader ecosystem
   - DO consider how your system's outputs or behaviors affect downstream security

### Analysis Quality Indicators:

**High-Quality Analysis Includes:**
- Detailed investigation of each potential threat vector
- Clear explanation of why certain risks apply or don't apply
- Consideration of both direct and indirect security impacts
- Acknowledgment of limitations and areas requiring further review
- Consistent tone that prioritizes security over convenience
- Specific, actionable mitigations with measurable outcomes

**Warning Signs of Poor Analysis:**
- Repetitive justifications that sound like marketing copy
- Systematic dismissal of entire threat categories
- Vague statements about security without specific details
- Contradictions between stated risk levels and security measures
- Focus on what the system "doesn't do" rather than what it enables

---

## Threat Model Development Framework

### Phase 1: Information Gathering

#### Required Inputs

Comprehensive threat modeling requires analysis of:

1. **Project Documentation**
   - Business requirements and objectives
   - User stories and use cases
   - Compliance requirements
   - Service Level Agreements (SLAs)

2. **Architecture Documentation**
   - System architecture diagrams
   - Component descriptions
   - Technology stack details
   - Deployment architecture
   - Network topology

3. **API and Interface Specifications**
   - API endpoint definitions
   - Authentication/authorization mechanisms
   - Data formats and protocols
   - Integration points

4. **Data Architecture**
   - Data flow diagrams
   - Data classification
   - Storage locations
   - Data lifecycle

5. **Security Requirements**
   - Existing security controls
   - Compliance constraints
   - Security policies
   - Incident response procedures

### Phase 2: Document Structure Creation

#### 1. Document Header and Executive Summary

**Template:**

```markdown
# [Application Name] - Comprehensive Threat Model

## Document Information

**Application Name**: [Name]  
**Version**: [Version Number]  
**Date**: [Current Date]  
**Classification**: [Confidential/Internal/Public]  
**Status**: [Active Development/Production/Archived]

## Executive Summary

This threat model provides a comprehensive security analysis of the [Application Name] system, [brief description of what it does].

### Key Security Concerns
- **[Concern 1]**: [Brief description]
- **[Concern 2]**: [Brief description]
- **[Concern 3]**: [Brief description]
- **[Concern 4]**: [Brief description]
- **[Concern 5]**: [Brief description]

### Risk Summary
- **Critical Risks**: [X] identified
- **High Risks**: [X] identified
- **Medium Risks**: [X] identified
- **Total Threats**: [X] across all STRIDE categories
```

#### 2. System Overview

**Template:**

```markdown
## 1. System Overview

### 1.1 Application Description

[Detailed description of the application, its purpose, and key features]

**Primary Use Cases**:
- [Use case 1]
- [Use case 2]
- [Use case 3]

### 1.2 Business Context

**Industry**: [Industry]  
**Regulatory Environment**: 
- [Regulation 1]
- [Regulation 2]
- [Regulation 3]

**Business Impact of Security Breach**:
- **Financial**: [Description and estimated impact]
- **Reputational**: [Description]
- **Operational**: [Description]
- **Legal**: [Description]
- **Competitive**: [Description]

### 1.3 Technology Stack

**Frontend**:
- [Technology 1]
- [Technology 2]

**Backend**:
- [Technology 1]
- [Technology 2]

**Data Layer**:
- [Technology 1]
- [Technology 2]

**AI/ML** (if applicable):
- [Technology 1]
- [Technology 2]

**Security & Identity**:
- [Technology 1]
- [Technology 2]

**Monitoring**:
- [Technology 1]
- [Technology 2]
```

#### 3. Architecture Analysis

Create ASCII diagrams showing:
- High-level architecture with all major components
- Component breakdown by layer
- Security characteristics per layer
- Attack surface per layer

**Example Structure:**

```markdown
## 2. Architecture Analysis

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    [System Name] Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│  [Layer 1 Name]                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐│
│  │ [Component 1]       │    │ [Component 2]                    ││
│  │ - [Feature]         │    │ - [Feature]                      ││
│  └─────────────────────┘    └──────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  [Layer 2 Name]                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐│
│  │ [Component 3]       │    │ [Component 4]                    ││
│  └─────────────────────┘    └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Breakdown

#### Layer 1: [Layer Name]
**Components**:
- [Component 1]
- [Component 2]

**Security Characteristics**:
- [Characteristic 1]
- [Characteristic 2]

**Attack Surface**:
- [Attack vector 1]
- [Attack vector 2]
```

#### 4. Data Flow Diagrams

Create comprehensive data flow diagrams with trust boundaries, data flows, and process interactions.

**IMPORTANT**: The example below shows a chatbot/AI agent architecture. Your diagram should reflect the ACTUAL components and flows of your specific application. Replace all components, flows, and trust boundaries with those from your system architecture.

**Complete Template (Example for AI Chatbot - Customize for Your Application):**

```markdown
## 3. Data Flow Diagrams

### 3.1 Complete System Data Flow

**NOTE**: This example shows an AI chatbot architecture. Replace all components below with your actual system components from architecture documentation.

```
                                    ┌─────────────────────┐
                                    │   [External Users]  │
                                    │   (Example: Chatbot │
                                    │    Users)           │
                                    └──────────┬──────────┘
                                               │
                    ╔══════════════════════════╧═══════════════════════════╗
                    ║              [TB1] Trust Boundary                    ║
                    ║         (Internet → Application Frontend)            ║
                    ╚══════════════════════════╤═══════════════════════════╝
                                               │
                                    ┌──────────▼──────────┐
                                    │                     │
                    ┌───────────────┤  Frontend (Web App) │◄──────┐
                    │               │                     │       │
                    │               └──────────┬──────────┘       │
                    │                          │                  │
                    │                          │ DF2              │
                    │                          │ Serve user       │
                    │ DF1                      │ requests         │ DF3
                    │ User                     │                  │ User
                    │ interacts                │                  │ Authenticates
                    │                          │                  │
                    │               ╔══════════▼══════════╗       │
                    │               ║       [TB2]         ║       │
                    │               ║  (Frontend → Auth)  ║       │
                    │               ╚══════════╤══════════╝       │
                    │                          │                  │
                    │               ┌──────────▼──────────┐       │
                    │               │                     │       │
                    └──────────────►│   API Gateway       │◄──────┘
                                    │                     │
                                    └──────────┬──────────┘
                                               │
                                               │ DF4
                                               │ Triggers
                    ╔══════════════════════════╧═══════════════════════════╗
                    ║              [TB3] Trust Boundary                    ║
                    ║         (API Gateway → Agent Runtime)                ║
                    ╚══════════════════════════╤═══════════════════════════╝
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                                                      │
         ┌──────────▼──────────┐                            ┌────────────▼─────────┐
         │                     │                            │                      │
         │   LLM Connect       │                            │   Agents/Tools       │
         │   (Orchestration)   │◄──────────────────────────►│   (Processing)       │
         │                     │                            │                      │
         └──────────┬──────────┘                            └────────────┬─────────┘
                    │                                                    │
                    │ DF5                                                │ DF6
                    │ Retrieves                                          │ Gets response
                    │ Data                                               │ from model
                    │                                                    │
    ╔═══════════════╧════════════╗                      ╔════════════════╧═══════════╗
    ║       [TB4]                ║                      ║       [TB5]                ║
    ║  (Agent → Content Filter)  ║                      ║  (Agent → Knowledge Base)  ║
    ╚═══════════════╤════════════╝                      ╚════════════════╤═══════════╝
                    │                                                    │
         ┌──────────▼──────────┐                            ┌───────────▼──────────┐
         │                     │                            │                      │
         │  Content Moderation │                            │   Knowledge Base     │
         │  Policies           │                            │   (e.g. OpenSearch   │
         │  (e.g. Bedrock      │                            │   Vector DB)         │
         │   Guardrails)       │                            │                      │
         └─────────────────────┘                            └──────────────────────┘
                                                                       │
                                                                       │ DF7
                                                                       │ Retrieves
                                                                       │ Data
                                            ╔══════════════════════════╧═══════════╗
                                            ║          [TB6]                       ║
                                            ║  (Knowledge Base → LLM)              ║
                                            ╚══════════════════════════╤═══════════╝
                                                                       │
                                                            ┌──────────▼──────────┐
                                                            │                     │
                                                            │  Large Language     │
                                                            │  Model              │
                                                            │  (e.g. Bedrock)     │
                                                            │                     │
                                                            └──────────┬──────────┘
                                                                       │
                                                                       │ DF8
                                                                       │ Return
                                                                       │ Response
                                                                       │
                                                            ┌──────────▼──────────┐
                                                            │                     │
                                                            │  Chat History       │
                                                            │  or Logs            │
                                                            │  (e.g. DynamoDB)    │
                                                            │                     │
                                                            └─────────────────────┘

Legend:
═══ Trust Boundary
─── Data Flow
◄─► Bidirectional Flow
DF# Data Flow Number
TB# Trust Boundary Number
```

**CUSTOMIZATION INSTRUCTIONS**:
1. Replace all component names with your actual system components
2. Update data flows to match your architecture
3. Identify trust boundaries based on your security zones
4. Add/remove components as needed for your system
5. Ensure all external integrations are shown
6. Include all data stores (databases, caches, etc.)
7. Show authentication and authorization flows
8. Mark sensitive data flows clearly

**Example Components to Replace**:
- "Chatbot Users" → Your actual user types (web users, mobile users, API consumers, etc.)
- "Frontend (Web App)" → Your actual frontend (React app, mobile app, CLI, etc.)
- "LLM Connect" → Your actual orchestration layer (if applicable)
- "Agents/Tools" → Your actual processing components (microservices, Lambda functions, etc.)
- "Knowledge Base" → Your actual data stores (PostgreSQL, MongoDB, S3, etc.)
- "Large Language Model" → Your actual AI/ML services (Bedrock, SageMaker, OpenAI, etc.) or remove if not applicable

**Common Application Patterns**:

**For Web Applications**:
- Users → CDN/Load Balancer → Web Server → Application Server → Database
- Include: Authentication service, API Gateway, Cache layer

**For Mobile Applications**:
- Mobile App → API Gateway → Backend Services → Database
- Include: Push notification service, Authentication, File storage

**For Microservices**:
- API Gateway → Service Mesh → Individual Services → Data Stores
- Include: Service discovery, Message queues, Event bus

**For AI/ML Applications**:
- Users → Frontend → API Gateway → Agent/Orchestration → ML Models → Data Stores
- Include: Model serving, Feature store, Training pipeline (if relevant)

**For Data Processing Pipelines**:
- Data Sources → Ingestion → Processing → Storage → Analytics
- Include: ETL services, Data warehouse, Streaming services

### 3.2 Data Flow Details

**NOTE**: The table below shows example data flows for an AI chatbot. Create your own table based on your actual system's data flows from architecture documentation.

| Flow ID | Description | Source | Target | Data Type | Protocol | Authentication | Encryption |
|---------|-------------|--------|--------|-----------|----------|----------------|------------|
| DF1 | [Example] User initiates conversation | [Your External Users] | [Your Frontend] | [Your data types] | HTTPS | Session token | TLS 1.3 |
| DF2 | [Example] Frontend serves requests | [Your Frontend] | [Your API Gateway] | HTTP requests | HTTPS | JWT token | TLS 1.3 |
| DF3 | [Example] User authentication | [Your Frontend] | [Your Auth Service] | Credentials | HTTPS | OAuth2/OIDC | TLS 1.3 |
| DF4 | [Example] API triggers processing | [Your API Gateway] | [Your Backend Services] | API calls | HTTPS | IAM role | TLS 1.3 |
| ... | [Add all your actual data flows] | ... | ... | ... | ... | ... | ... |

**Instructions for Your Application**:
1. List ALL data flows in your system
2. Include flows between all components shown in your diagram
3. Document the actual protocols used (HTTPS, gRPC, AMQP, etc.)
4. Specify authentication mechanisms (JWT, API keys, mTLS, etc.)
5. Note encryption methods (TLS version, at-rest encryption)
6. Include both synchronous and asynchronous flows
7. Document data types being transmitted
8. Mark flows that cross trust boundaries

### 3.3 Trust Boundaries

**NOTE**: The table below shows example trust boundaries for an AI chatbot. Identify and document YOUR actual trust boundaries based on your system architecture.

| Boundary ID | Boundary | Description | Security Controls | Threats |
|-------------|----------|-------------|-------------------|---------|
| TB1 | [Example] Internet → Frontend | [Your external to internal boundary] | TLS 1.3, WAF, DDoS protection | Man-in-the-middle, DDoS |
| TB2 | [Example] Frontend → Authentication | [Your app to auth boundary] | OAuth2, MFA, token validation | Authentication bypass, token theft |
| TB3 | [Example] API Gateway → Backend | [Your API to processing boundary] | IAM roles, request validation | Unauthorized access, injection |
| ... | [Add all your trust boundaries] | ... | ... | ... |

**How to Identify Trust Boundaries**:
1. **Network Boundaries**: Internet → DMZ → Internal Network
2. **Authentication Boundaries**: Unauthenticated → Authenticated zones
3. **Authorization Boundaries**: User role → Admin role transitions
4. **Data Classification Boundaries**: Public → Confidential → Restricted data
5. **Service Boundaries**: External services → Internal services
6. **Cloud Boundaries**: On-premises → Cloud, or Cloud → Cloud
7. **Process Boundaries**: User space → Kernel space (if applicable)

**Common Trust Boundaries by Application Type**:
- **Web Apps**: Internet → CDN → Web Server → App Server → Database
- **Mobile Apps**: Mobile Device → API Gateway → Backend → Database
- **Microservices**: External → API Gateway → Service Mesh → Individual Services
- **AI/ML**: User → Frontend → API → Agent/Orchestration → ML Models → Data

### 3.4 Process Descriptions

**NOTE**: The processes below are examples for an AI chatbot. Document YOUR actual system processes based on your architecture.

**P1: [Example] User Interaction Process**
- [Describe your actual user interaction flow]
- [Include authentication steps]
- [Include session management]
- [Include request routing]

**P2: [Example] Processing/Orchestration Process**
- [Describe your actual processing flow]
- [Include business logic steps]
- [Include validation steps]
- [Include data retrieval]

**P3: [Example] Data Processing Process**
- [Describe your data processing flow]
- [Include transformation steps]
- [Include validation steps]
- [Include storage steps]

**P4: [Example] Response Delivery Process**
- [Describe your response flow]
- [Include formatting steps]
- [Include delivery mechanism]
- [Include state management]

**Instructions**:
1. Document all major processes in your system
2. Include step-by-step flow for each process
3. Identify where data crosses trust boundaries
4. Note security controls at each step
5. Include error handling and edge cases
6. Document asynchronous processes separately

### 3.5 Data Assets in Flow

**NOTE**: The table below shows example data assets. Identify and classify YOUR actual data assets based on your system.

| Asset ID | Asset Name | Flows | Classification | Protection Requirements |
|----------|------------|-------|----------------|------------------------|
| A01 | [Your Asset 1] | [Your Flows] | CRITICAL/HIGH/MEDIUM/LOW | [Your requirements] |
| A02 | [Your Asset 2] | [Your Flows] | CRITICAL/HIGH/MEDIUM/LOW | [Your requirements] |
| ... | [Add all your data assets] | ... | ... | ... |

**Instructions**:
1. List ALL data assets that flow through your system
2. Reference the data flow IDs where each asset appears
3. Classify based on sensitivity (CRITICAL/HIGH/MEDIUM/LOW)
4. Document specific protection requirements for each asset
5. Include both data at rest and data in transit
6. Consider PII, financial data, credentials, business data, etc.

### 3.6 Threat Summary by Trust Boundary

**NOTE**: The threats below are examples. Identify threats specific to YOUR trust boundaries using the structured threat statement format.

**[TB1] [Your First Trust Boundary] Threats**:
- A threat actor who [capability/access] can [action], which leads to [threat impact], resulting in [business impact] of [affected assets]
- [Add all threats for this boundary]

**[TB2] [Your Second Trust Boundary] Threats**:
- A threat actor who [capability/access] can [action], which leads to [threat impact], resulting in [business impact] of [affected assets]
- [Add all threats for this boundary]

**[Continue for all trust boundaries]**

**Instructions**:
1. For EACH trust boundary, identify potential threats
2. Use the structured threat statement format (REQUIRED)
3. Consider all STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
4. Focus on threats specific to that boundary crossing
5. Reference the affected data flows and assets
6. Consider both technical and business impacts
```

#### 5. Trust Boundaries

**Template:**

```markdown
## 4. Trust Boundaries

### 4.1 Trust Boundary Identification

| ID | Boundary | Description | Security Controls | Risk Level |
|----|----------|-------------|-------------------|------------|
| TB1 | [Source] → [Target] | [Description] | [Controls] | [CRITICAL/HIGH/MEDIUM/LOW] |
| TB2 | [Source] → [Target] | [Description] | [Controls] | [CRITICAL/HIGH/MEDIUM/LOW] |

### 4.2 Trust Boundary Analysis

#### TB1: [Source] → [Target] ([RISK LEVEL])
**Description**: [Detailed description]

**Assets Crossing Boundary**:
- [Asset 1]
- [Asset 2]

**Existing Controls**:
- [Control 1]
- [Control 2]

**Threats**:
- [Threat 1]
- [Threat 2]

**Recommendations**:
- [Recommendation 1]
- [Recommendation 2]
```

#### 6. Assets and Data Classification

**Template:**

```markdown
## 5. Assets and Data Classification

### 5.1 Asset Inventory

| Asset ID | Asset Name | Type | Classification | Location | Owner |
|----------|------------|------|----------------|----------|-------|
| A01 | [Name] | Data/Asset | CRITICAL/HIGH/MEDIUM/LOW | [Location] | [Owner] |
| A02 | [Name] | Data/Asset | CRITICAL/HIGH/MEDIUM/LOW | [Location] | [Owner] |

### 5.2 Data Classification

#### CRITICAL (Highest Protection)
**Definition**: Data that if compromised would cause severe harm

**Assets**:
- [Asset 1]
- [Asset 2]

**Protection Requirements**:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Access logging and monitoring
- Multi-factor authentication for access
- Data masking in non-production
- Retention: [X] years (regulatory)

#### HIGH (Strong Protection)
[Similar structure]

#### MEDIUM (Standard Protection)
[Similar structure]

#### LOW (Basic Protection)
[Similar structure]

### 5.3 Data Flow Classification

| Data Flow | Source | Destination | Classification | Encryption | Authentication |
|-----------|--------|-------------|----------------|------------|----------------|
| [Flow 1] | [Source] | [Dest] | [Class] | [Type] | [Method] |
```

#### 7. STRIDE Threat Analysis

This is the core section. Each threat should follow this detailed format:

**Threat Statement Format:**

All threats must be written using this structured format:

**"A [threat actor] who [capability/access] can [action], which leads to [threat impact], resulting in [business impact] of [affected assets]"**

**Examples:**
- "A threat actor with access to the private key for the public API Gateway TLS certificate can set up their own API endpoint, which leads to spoofing of our legitimate endpoint, resulting in reduced confidentiality of vehicle listing, registration status and vehicle registration documents"
- "A threat actor with control of network traffic between users and the API Gateway endpoint can tamper with valid and authenticated requests to the API, negatively impacting vehicle registration, vehicle listing, registration status and vehicle registration documents"
- "A threat actor who is able to access the AWS Lambda function logs can may find sensitive data captured within the logs, resulting in reduced confidentiality of vehicle registration, vehicle listing, registration status and vehicle registration documents"

**Template:**

```markdown
## 6. Threat Analysis (STRIDE)

### 6.1 Spoofing Threats

#### S-01: [Threat Name]
**Severity**: CRITICAL/HIGH/MEDIUM/LOW  
**STRIDE Category**: Spoofing  
**Component**: [Component Name]

**Threat Statement**:
A [threat actor] who [capability/access] can [action], which leads to [threat impact], resulting in [business impact] of [affected assets]

**Description**:
[Additional detailed context about the threat]

**Attack Scenario**:
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]
5. [Step 5]

**Impact**:
- [Impact 1]
- [Impact 2]
- [Impact 3]

**Affected Assets**:
- A01: [Asset Name]
- A02: [Asset Name]

**Existing Controls**:
- [Control 1]
- [Control 2]

**Vulnerabilities**:
- [Vulnerability 1]
- [Vulnerability 2]

**Mitigations**:
1. **[Mitigation Name]**: [Description]
2. **[Mitigation Name]**: [Description]
3. **[Mitigation Name]**: [Description]

**Residual Risk**: [CRITICAL/HIGH/MEDIUM/LOW] (with mitigations)

---

[Repeat for each threat in category]

### 6.2 Tampering Threats

#### T-01: [Threat Name]
[Same structure as above]

### 6.3 Repudiation Threats

#### R-01: [Threat Name]
[Same structure as above]

### 6.4 Information Disclosure Threats

#### I-01: [Threat Name]
[Same structure as above]

### 6.5 Denial of Service Threats

#### D-01: [Threat Name]
[Same structure as above]

### 6.6 Elevation of Privilege Threats

#### E-01: [Threat Name]
[Same structure as above]
```

### Phase 3: Threat Identification Guidelines

#### STRIDE Categories

**Spoofing (S-XX)**
- Identity theft
- Authentication bypass
- Credential theft
- Token forgery
- Session hijacking
- Service impersonation

**Tampering (T-XX)**
- Data manipulation
- Code injection
- Configuration tampering
- Model poisoning (AI/ML)
- Prompt injection (AI/ML)
- Request manipulation

**Repudiation (R-XX)**
- Transaction denial
- Action repudiation
- Log tampering
- Audit trail gaps
- Non-repudiation failures

**Information Disclosure (I-XX)**
- Data leakage
- PII exposure
- Credential exposure
- Model extraction (AI/ML)
- Training data exposure (AI/ML)
- Configuration exposure
- API key exposure

**Denial of Service (D-XX)**
- Resource exhaustion
- Rate limit abuse
- Model resource exhaustion (AI/ML)
- Token quota exhaustion (AI/ML)
- Service disruption
- Availability attacks

**Elevation of Privilege (E-XX)**
- Privilege escalation
- Authorization bypass
- Role manipulation
- Permission boundary violations
- Administrative access abuse

#### AI/ML Specific Threats

When analyzing AI/ML systems, include these additional threat categories:

1. **Model Security**
   - Model poisoning
   - Model extraction/theft
   - Adversarial inputs
   - Model inversion attacks

2. **Training Data Security**
   - Data poisoning
   - Training data extraction
   - Bias injection
   - Data integrity violations

3. **Prompt Security** (for LLMs)
   - Prompt injection
   - Jailbreaking
   - System prompt exposure
   - Context manipulation

4. **Output Security**
   - PII leakage in responses
   - Hallucinations
   - Biased outputs
   - Malicious content generation

### Phase 4: Severity Assessment

Use this matrix to determine threat severity:

| Likelihood | Impact: Low | Impact: Medium | Impact: High | Impact: Critical |
|------------|-------------|----------------|--------------|------------------|
| Very High  | MEDIUM      | HIGH           | CRITICAL     | CRITICAL         |
| High       | MEDIUM      | HIGH           | HIGH         | CRITICAL         |
| Medium     | LOW         | MEDIUM         | HIGH         | HIGH             |
| Low        | LOW         | LOW            | MEDIUM       | HIGH             |

**Impact Factors:**
- Financial loss
- Data breach scope
- Regulatory violations
- Reputational damage
- Service disruption
- User safety

**Likelihood Factors:**
- Attack complexity
- Required privileges
- Attack surface exposure
- Existing controls
- Known exploits

### Phase 5: Mitigation Development

For each threat, provide:

1. **Preventive Controls**: Stop the threat from occurring
2. **Detective Controls**: Identify when threat is occurring
3. **Corrective Controls**: Respond to and recover from threat
4. **Compensating Controls**: Alternative controls when primary controls aren't feasible

**Mitigation Quality Criteria:**
- Specific and actionable
- Measurable effectiveness
- Realistic implementation timeline
- Cost-benefit justified
- Aligned with security best practices

### Phase 6: Documentation Completion

#### Security Controls Section

```markdown
## 7. Security Controls

### 7.1 Baseline Security Controls

| Control ID | Control Name | Description | Implementation Status | Effectiveness |
|------------|--------------|-------------|----------------------|---------------|
| BSC-01 | [Name] | [Description] | Implemented/Planned | High/Medium/Low |

### 7.2 System-Specific Controls

| Control ID | Control Name | Threats Mitigated | Status | Ticket |
|------------|--------------|-------------------|--------|--------|
| SSC-01 | [Name] | T-01, T-02 | Implemented | [Link] |
```

#### Compliance Requirements Section

```markdown
## 8. Compliance Requirements

### 8.1 Applicable Regulations

| Regulation | Requirements | Compliance Status | Gaps |
|------------|--------------|-------------------|------|
| [Name] | [Requirements] | Compliant/Partial/Non-Compliant | [Gaps] |

### 8.2 Compliance Mapping

| Requirement | Related Threats | Controls | Status |
|-------------|-----------------|----------|--------|
| [Requirement] | T-01, I-01 | BSC-01, SSC-01 | [Status] |
```

#### Recommendations Section

```markdown
## 9. Recommendations

### 9.1 Critical Priority

1. **[Recommendation]**
   - **Threat**: [Threat ID]
   - **Impact**: [Description]

### 9.2 High Priority

[Similar structure]

### 9.3 Medium Priority

[Similar structure]

### 9.4 Implementation Roadmap

**Note**: Implementation timeline and resource allocation should be determined by the organization based on their specific constraints, priorities, and available resources.

**Recommended Prioritization**:

**Critical Priority (Immediate Focus)**:
- [List critical recommendations]

**High Priority (Next Phase)**:
- [List high priority recommendations]

**Medium Priority (Subsequent Phase)**:
- [List medium priority recommendations]

**Continuous Activities**:
- [List ongoing activities]
```

#### Existing Controls Mapping Section

**CRITICAL SECTION**: This section is essential for understanding current security posture.

```markdown
## 10. Existing Controls Mapping

### 10.1 Overview

This section maps security controls documented in architecture specifications to identified threats, providing a clear view of current security posture and coverage gaps.

### 10.2 [Control Category] Controls

#### Existing Implementation

**[Component] Configuration**:
```[language]
// Document actual current implementation
[Configuration details from architecture docs]
```

**Coverage Analysis**:
| Threat ID | Threat Name | Control Coverage | Gap Analysis |
|-----------|-------------|------------------|--------------|
| [ID] | [Name] | PARTIAL (XX%) | ✅ Implemented, ❌ Missing, ⚠️ Needs improvement |

**Documented Controls**:
- ✅ [Control name] (implemented)
- ⚠️ [Control name] (partial)
- ❌ [Control name] (NOT implemented)

**[Category] Coverage**: XX% (X of Y controls implemented)

### 10.9 Control Coverage Summary

#### Overall Coverage by Threat Category

| Category | Total Threats | Fully Covered | Partially Covered | Not Covered | Coverage % |
|----------|---------------|---------------|-------------------|-------------|------------|
| Spoofing | X | X (XX%) | X (XX%) | X (XX%) | XX% |
| [Continue for all STRIDE categories]
| **TOTAL** | **XX** | **XX (XX%)** | **XX (XX%)** | **XX (XX%)** | **XX%** |

#### Control Implementation Status by Layer

| Layer | Total Controls | Implemented | Partial | Not Implemented | Coverage % |
|-------|----------------|-------------|---------|-----------------|------------|
| [Layer 1] | X | X | X | X | XX% |
| **TOTAL** | **XX** | **XX (XX%)** | **XX (XX%)** | **XX (XX%)** | **XX%** |

#### Critical Gaps Requiring Immediate Attention

**🔴 Critical Priority**:
1. [Gap description with threat ID]

**🟡 High Priority**:
[List gaps]

**🟢 Medium Priority**:
[List gaps]

### 10.10 Gap Remediation Roadmap

```
Current State: XX% Threat Coverage, XX% Control Implementation

Target State: XX% Threat Coverage, XX% Control Implementation

Note: Implementation timeline should be determined by the organization 
based on their specific constraints, priorities, and available resources.

Recommended Prioritization:
- Critical Priority: [List critical gaps]
- High Priority: [List high priority gaps]
- Medium Priority: [List medium priority gaps]
- Continuous Activities: [List ongoing activities]
```
```

**Key Requirements for This Section**:
1. **Quantify Everything**: Use percentages for all coverage metrics
2. **Visual Indicators**: Use ✅ ⚠️ ❌ for quick scanning
3. **Actual Implementation**: Document what's really deployed, not what's planned
4. **Specific Configurations**: Include actual values (e.g., "JWT 1-hour expiration", "10,000 req/sec")
5. **Gap Analysis**: For each threat, show what's missing
6. **Remediation Timeline**: Clear roadmap from current to target state

**Control Categories to Cover**:
- Authentication & Identity Controls
- API Gateway & Network Security Controls
- AI/ML Security Controls (if applicable)
- Data Protection Controls
- Monitoring & Logging Controls
- Disaster Recovery & Business Continuity Controls
- Development & Deployment Security Controls

---

#### Appendices

```markdown
## 11. Appendices

### 10.1 Glossary

| Term | Definition | Example |
|------|------------|---------|
| [Term] | [Definition] | [Example] |

### 10.2 References

| Reference | Description | URL |
|-----------|-------------|-----|
| [Name] | [Description] | [URL] |

### 10.3 Admin Information

* **AppSec Review Link**: [Link]
* **Team**: [Team Name]
* **Design Documentation**: [Link]
* **Threat Model Version**: [Version]
* **Last Updated**: [Date]
* **Next Review Date**: [Date]
* **Reviewers**: [Names]
* **Approval Status**: [Status]
```

---

## Quality Assurance Checklist

Before finalizing a threat model, verify:

### Completeness
- [ ] All system components analyzed
- [ ] All data flows documented
- [ ] All trust boundaries identified
- [ ] All STRIDE categories covered
- [ ] All assets classified
- [ ] All threats have mitigations
- [ ] All mitigations have owners and timelines
- [ ] **Existing Controls Mapping section completed** ⭐
- [ ] **Current coverage percentages calculated** ⭐
- [ ] **Gap analysis documented for each threat** ⭐
- [ ] **Remediation roadmap with timelines** ⭐

### Technical Accuracy
- [ ] Architecture diagrams match actual system
- [ ] Technology stack is current
- [ ] Threat scenarios are realistic
- [ ] Mitigations are technically feasible
- [ ] Severity ratings are justified
- [ ] Residual risks are documented

### Stakeholder Alignment
- [ ] Business context is accurate
- [ ] Compliance requirements are complete
- [ ] Risk appetite is reflected
- [ ] Recommendations are prioritized
- [ ] Implementation timeline is realistic

### Documentation Quality
- [ ] Clear and professional language
- [ ] Consistent formatting
- [ ] No spelling or grammar errors
- [ ] All tables are complete
- [ ] All diagrams are readable
- [ ] All references are valid

---

## Best Practices

### Do's
- **Use specific, measurable language** with quantified metrics (e.g., "51% coverage", "10,000 req/sec")
- **Provide detailed attack scenarios** with numbered steps
- **Include realistic impact assessments** with dollar amounts where possible
- **Reference industry standards** (OWASP, NIST, CIS) with specific mappings
- **Consider both technical and business impacts** in every threat
- **Document assumptions clearly** with rationale
- **Update regularly** as system evolves (quarterly minimum)
- **Quantify current security posture** using the Existing Controls Mapping section
- **Use visual indicators** (✅ ⚠️ ❌) for quick scanning
- **Include actual configuration values** from architecture documentation
- **Calculate coverage percentages** for all threat categories
- **Provide gap remediation roadmap** with timelines and priorities

### Don'ts
- Don't use vague or generic descriptions
- Don't dismiss threats without thorough analysis
- Don't ignore indirect or downstream impacts
- Don't over-rely on single controls
- **Don't skip the Existing Controls Mapping section** - it's critical for stakeholders
- **Don't assume controls are implemented** - verify with architecture docs
- **Don't use qualitative assessments only** - quantify everything possible
- **Don't forget to map existing controls to threats** - show what's protecting what
- **Don't include cost estimates or specific timelines** - leave for customer to determine
- **Don't include insider threat controls** - focus on technical security controls
- **Don't include social engineering/phishing controls** - handled by awareness programs
- **Don't include third-party vendor risk controls** - handled by vendor management

### Critical Success Factors

**For Threat Models to be Actionable**:
1. **Quantified Current State**: Must show current coverage percentages (e.g., "51% overall coverage")
2. **Clear Gap Analysis**: Each threat must show what controls exist vs. what's missing
3. **Prioritized Remediation**: Critical, High, and Medium priority gaps
4. **Measurable Targets**: Define target coverage percentages
5. **Visual Communication**: Use tables, charts, and indicators for executive summaries
6. **Technical Focus**: Focus on technical security controls, excluding organizational policies
7. **Customer Flexibility**: Allow customer to determine timelines and resource allocation

**Scope Exclusions**:
- Cost estimates and budgets (customer determines based on their resources)
- Specific implementation timelines (customer determines based on priorities)
- Insider threat controls (handled by organizational HR/security policies)
- Social engineering/phishing controls (handled by security awareness programs)
- Third-party vendor risks (handled by vendor management processes)

---

## Maintenance and Updates

Threat models should be updated when:

1. **Architecture Changes**
   - New components added
   - Components removed or replaced
   - Integration points change
   - Deployment model changes

2. **New Threats Emerge**
   - New attack techniques discovered
   - Vulnerabilities disclosed
   - Threat landscape changes
   - Regulatory changes

3. **Security Incidents**
   - Incidents occur in your system
   - Similar incidents occur in industry
   - Post-incident reviews completed

4. **Regular Reviews**
   - Quarterly reviews minimum
   - Annual comprehensive reviews
   - Before major releases
   - After significant changes

---

## Conclusion

This methodology ensures comprehensive security assessment that meets enterprise security standards while supporting implementation planning objectives. The resulting threat models provide actionable security guidance that can be integrated into development workflows, security operations, and compliance programs.

By following this structured approach, security teams can produce consistent, high-quality threat models that effectively communicate security risks and drive meaningful security improvements.
