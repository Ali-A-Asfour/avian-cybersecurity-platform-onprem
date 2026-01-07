---
inclusion: manual
---

# Holistic Quality Assessment Methodology

This methodology provides a framework for conducting holistic quality assessment of specification packages, optimizing requirements and architecture together. The approach is aligned with AWS Professional Services' Global Delivery Framework (GDF) and quality standards, using a deferred quality assessment strategy for optimal outcomes.

## Your Expertise Areas

- **Enterprise Architecture**: Multi-tenant systems, microservices, cloud-native architectures
- **AI/ML Systems**: Model deployment, MLOps, agent orchestration, document processing
- **System Integration**: API design, data flows, legacy system integration
- **Performance & Scalability**: High-throughput systems, disaster recovery, monitoring
- **Security & Compliance**: Authentication, authorization, data protection, audit trails, AWS Baseline Security Controls (BSC), Zero-Threat Architecture, STRIDE threat modeling

## Holistic Assessment Framework

You will evaluate complete specification packages (requirements + architecture together) across multiple dimensions using a structured approach that ensures complete coverage and cross-domain optimization. This deferred quality assessment strategy allows for holistic optimization rather than isolated domain improvements.

## Deferred Quality Assessment Strategy

### Approach Benefits
- **Holistic Optimization**: Requirements and architecture optimized together for better overall outcomes
- **Cross-Domain Synergy**: Improvements in one domain inform and enhance the other
- **Reduced Context Switching**: Single complete assessment instead of multiple fragmented reviews
- **Natural Development Flow**: Mirrors real-world enterprise development where complete context enables better decisions

### Assessment Timing
- **Requirements Generated First**: Complete requirements package created without quality gates
- **Architecture Generated Second**: Complete architecture design based on stable requirements
- **Holistic Assessment Third**: Complete quality evaluation of integrated solution
- **Iterative Improvement**: Requirements and architecture improved together until 90/100 achieved

### 1. Requirements Analysis

#### Functional Requirements Review
**Evaluation Criteria:**
- **Completeness**: Are all business capabilities clearly defined with measurable acceptance criteria?
- **Clarity**: Are requirements unambiguous and testable?
- **Traceability**: Can requirements be traced to business objectives and user stories?
- **Consistency**: Do requirements align across functional areas without conflicts?
- **Feasibility**: Are requirements technically achievable within stated constraints?

**Review Questions:**
- Are the functional requirements SMART (Specific, Measurable, Achievable, Relevant, Time-bound)?
- Do acceptance criteria provide clear pass/fail conditions?
- Are dependencies between requirements clearly identified and manageable?
- Are there any missing critical functional areas based on the problem statement?
- Do the requirements support the stated business objectives and success metrics?

#### Non-Functional Requirements Review
**Evaluation Criteria:**
- **Performance**: Are response time, throughput, and resource utilization requirements realistic?
- **Scalability**: Can the system handle projected growth in users, data, and transactions?
- **Security**: Are security requirements comprehensive and aligned with industry standards?
- **Compliance**: Do requirements address all relevant regulatory and governance needs?
- **Operational**: Are monitoring, backup, and maintenance requirements adequate?

**Review Questions:**
- Are performance targets based on realistic load projections and benchmarking?
- Do scalability requirements account for both horizontal and vertical scaling needs?
- Are security requirements aligned with zero-trust principles and defense-in-depth?
- Do compliance requirements cover all applicable regulations (SOX, GDPR, etc.)?
- Are operational requirements sufficient for 24/7 enterprise operations?

### 2. Architecture and Design Review

#### High-Level Architecture Assessment
**Evaluation Criteria:**
- **Architectural Patterns**: Are chosen patterns appropriate for the problem domain?
- **Component Design**: Are system components well-defined with clear responsibilities?
- **Integration Strategy**: Are integration points and data flows clearly specified?
- **Technology Choices**: Are technology selections justified and aligned with constraints?
- **Scalability Design**: Does the architecture support required scale and performance?

**Review Questions:**
- Does the architecture follow established patterns (microservices, event-driven, etc.)?
- Are component boundaries logical with minimal coupling and high cohesion?
- Are integration patterns (synchronous vs. asynchronous) appropriate for each use case?
- Are technology choices aligned with organizational standards and team capabilities?
- Does the architecture eliminate single points of failure and support horizontal scaling?

#### Data Architecture Review
**Evaluation Criteria:**
- **Data Model**: Is the data model normalized and optimized for access patterns?
- **Storage Strategy**: Are storage technologies appropriate for data types and usage?
- **Data Flow**: Are data flows efficient and secure across system boundaries?
- **Consistency**: Are data consistency requirements clearly defined and achievable?
- **Governance**: Are data governance and quality controls adequate?

**Review Questions:**
- Does the data model support both current requirements and anticipated evolution?
- Are storage choices (SQL, NoSQL, object storage) optimized for specific use cases?
- Are data flows designed to minimize latency and maximize throughput?
- Are consistency models (eventual vs. strong) appropriate for business requirements?
- Are data lineage, quality, and governance controls comprehensive?

### 3. Security and Compliance Review

#### 3.1 Security Architecture Assessment
**Evaluation Criteria:**
- **Authentication**: Are authentication mechanisms robust and user-friendly?
- **Authorization**: Is access control granular and based on least privilege principles? Is there a clear authentication and authorization model?
- **Data Protection**: Are encryption and data handling practices comprehensive? Are all data flows identified and classified by sensitivity?
- **Network Security**: Are network controls adequate for threat protection?
- **Monitoring**: Are security monitoring and incident response capabilities sufficient?

**Review Questions:**
- Does authentication support multi-factor authentication and single sign-on?
- Is role-based access control (RBAC) implemented with appropriate granularity?
- Are all sensitive data encrypted at rest and in transit using current standards?
- Are network segmentation and firewall rules properly configured?
- Are security monitoring and SIEM integration comprehensive?

#### 3.2 AWS Baseline Security Controls Integration

This section integrates AWS Security Knowledge Base baseline controls and questions to ensure comprehensive security coverage aligned with AWS best practices and Well-Architected Framework principles.

##### Zero-Threat Architecture Approach

**Goal**: Implement comprehensive security controls during the design phase such that the subsequent threat model identifies **zero or minimal residual threats**. This "shift-left" approach embeds security from the start rather than retrofitting controls after threats are identified.

##### Consolidated AWS Baseline Security Controls

The following 38 consolidated controls cover AWS Baseline Security Controls (BSC) and Zero-Threat Architecture principles. Each control integrates multiple related security requirements for efficient AI agent processing and comprehensive coverage.

**Security Architecture & Design Principles**

- [ ] **Security Anti-Patterns & Secure by Default**: Proactively identify security mistakes and ensure secure defaults
  - Question: Have you reviewed against OWASP Top 10 and common AWS security misconfigurations?
  - Question: Are all features secure by default (encryption on, authentication required, least privilege)?
  - Question: Are insecure configurations prevented or warned against?
  - Question: Is defense-in-depth implemented across network, application, and data layers?
  - Verification: Conduct security anti-pattern review and test default configuration security posture

- [ ] **Multi-Tenant Security & Isolation**: Secure multi-tenant request processing and customer code execution
  - Question: Is tenant isolation enforced at all layers (data, compute, network)?
  - Question: Are tenant IDs validated on every request with cross-tenant access prevention?
  - Question: Is customer code executed in isolated sandboxes with resource limits?
  - Question: Are execution environments ephemeral and cleaned between uses?
  - Verification: Test for cross-tenant data leakage and sandbox isolation

**1. Authentication & Identity Controls**

- [ ] **Comprehensive Authentication**: All services have robust authentication with MFA
  - Question: Are all endpoints authenticated including internal service-to-service (SigV4, SSO, mTLS, IAM)?
  - Question: Is MFA mandatory for all human access (hardware/virtual tokens, not SMS)?
  - Question: Are default/weak credentials eliminated with strong password policies (12+ chars, complexity)?
  - Question: Is session management secure (short-lived tokens, secure refresh rotation)?
  - Question: Are adaptive authentication and behavioral analytics implemented?
  - Verification: Test authentication bypass attempts and MFA enforcement

**2. Authorization & Access Control**

- [ ] **IAM Least Privilege & Authorization**: Action-based authorization with least privilege
  - Question: Is IAM action-based authorization implemented for all API calls?
  - Question: Are permission boundaries and temporary credentials used (no long-term access keys)?
  - Question: Is Just-In-Time (JIT) access implemented for elevated privileges?
  - Question: Are unused permissions automatically detected and removed?
  - Question: Is separation of duties enforced with regular access reviews?
  - Verification: Test unauthorized access attempts and review IAM policies for overly permissive statements

- [ ] **Cross-Account & Confused Deputy Protection**: Secure cross-account and service-to-service access
  - Question: Are external IDs used for all cross-account IAM role assumptions?
  - Question: Is aws:SourceAccount or aws:SourceArn condition used in resource policies?
  - Question: Are ARNs parsed and validated consistently across all authorization logic?
  - Question: Are cross-account permissions reviewed regularly and logged?
  - Verification: Test confused deputy scenarios and audit cross-account IAM roles

- [ ] **Resource & Database Access Control**: Secure resource policies and database access
  - Question: Are resource-based policies using condition keys with least privilege?
  - Question: Are databases deployed in private subnets with public accessibility disabled?
  - Question: Is IMDSv2 required for all EC2 instances with metadata access restrictions?
  - Question: Are managed policies using condition keys to restrict scope?
  - Verification: Scan for publicly accessible databases and test metadata access restrictions

**3. Data Protection & Encryption**

- [ ] **Encryption in Transit**: TLS 1.2+ with approved cipher suites
  - Question: Are TLS 1.2 and 1.3 supported with TLS 1.0/1.1 explicitly disabled?
  - Question: Are only approved cipher suites enabled with perfect forward secrecy (PFS)?
  - Question: Is certificate revocation checking enabled (OCSP with CRL fallback)?
  - Question: Are appropriate encryption modes and key lengths used (AES-256, RSA 2048+)?
  - Verification: Use testssl.sh or nmap to verify TLS configuration

- [ ] **Encryption at Rest & Key Management**: Comprehensive data encryption with KMS
  - Question: Can customers encrypt content with Customer Managed Keys (CMKs)?
  - Question: Is all service data encrypted at rest with appropriate methods?
  - Question: Is encryption context used in all KMS encrypt/decrypt operations?
  - Question: Are KMS key policies secure with automatic key rotation enabled?
  - Question: Is client-side encryption used for highly sensitive data?
  - Verification: Complete KMS integration tests and audit encryption configurations

- [ ] **Data Classification & Handling**: Proper data classification and lifecycle management
  - Question: Is all data classified by sensitivity (CRITICAL/HIGH/MEDIUM/LOW)?
  - Question: Are handling requirements defined and enforced for each classification level?
  - Question: Is secure data deletion implemented (cryptographic erasure or overwriting)?
  - Question: Are data deletion requests processed within required timeframes (30 days for GDPR)?
  - Question: Are data retention policies automated with backup encryption?
  - Verification: Audit data stores for classification tags and test data deletion end-to-end

- [ ] **Data Integrity & Metadata Protection**: Prevent data tampering and metadata leakage
  - Question: Is data integrity verification implemented (checksums, digital signatures)?
  - Question: Are S3 object metadata and EC2 tags free of sensitive data?
  - Question: Is tokenization used to protect sensitive data in service logs?
  - Question: Are file uploads validated (type, size, content, malware scanning)?
  - Verification: Test data integrity verification and audit metadata fields

**4. Secrets Management**

- [ ] **Comprehensive Secrets Management**: Centralized secrets with automatic rotation
  - Question: Are all secrets stored in AWS Secrets Manager (no hardcoded secrets)?
  - Question: Are secrets rotated automatically every 90 days maximum?
  - Question: Is secret scanning automated in CI/CD and repositories with pre-commit hooks?
  - Question: Is log filtering implemented to redact secrets automatically?
  - Question: Are secrets isolated per environment with least privilege access?
  - Question: Is emergency rotation capability available for compromised secrets?
  - Verification: Scan for hardcoded secrets and test rotation procedures

**5. Network Security**

- [ ] **Network Segmentation & Access Control**: Least privilege network access
  - Question: Are workloads deployed in private subnets with proper segmentation?
  - Question: Are security groups and NACLs configured with least privilege?
  - Question: Are VPC endpoints used for private AWS service connectivity?
  - Question: Are bastion hosts hardened for administrative access?
  - Question: Is dual-stack support (IPv4/IPv6) provided for customer-facing endpoints?
  - Verification: Review network architecture and test network isolation

- [ ] **Network Monitoring & Protection**: Flow logs, IDS, and DNS security
  - Question: Are VPC flow logs enabled and monitored?
  - Question: Is network-based intrusion detection/prevention implemented?
  - Question: Is TLS inspection configured for encrypted traffic analysis?
  - Question: Are DNS security controls implemented (DNSSEC, DNS filtering)?
  - Question: Is subdomain takeover prevention implemented?
  - Verification: Review flow logs and test DNS security controls

**6. Application Security**

- [ ] **Input Validation & Output Encoding**: Comprehensive injection prevention
  - Question: Is whitelist validation implemented at all entry points?
  - Question: Is output encoding applied based on context (HTML, JavaScript, URL, CSS)?
  - Question: Are parameterized queries used (no string concatenation)?
  - Question: Is request signing (HMAC) used for critical requests?
  - Question: Are request size limits and rate limiting enforced?
  - Verification: Test with injection payloads (SQL, XSS, XXE, SSRF)

- [ ] **Web Security Controls**: XSS, SSRF, XXE, CSRF, and web-specific protections
  - Question: Is Content Security Policy (CSP) configured with strict policies?
  - Question: Are user-supplied URLs validated against allowlists (SSRF prevention)?
  - Question: Is XML external entity (XXE) processing disabled in all parsers?
  - Question: Is CSRF protection implemented (tokens, double-submit cookies, SameSite)?
  - Question: Are secure HTTP headers set (HSTS, X-Frame-Options, X-Content-Type-Options)?
  - Question: Are secure cookie settings used (HttpOnly, Secure, SameSite)?
  - Question: Is CORS configured securely with explicit origin allowlists?
  - Verification: Test with XSS, SSRF, XXE, and CSRF payloads

- [ ] **Code Security & Testing**: SAST, DAST, SCA, and vulnerability management
  - Question: Is static analysis (SAST) integrated in CI/CD pipeline?
  - Question: Is dynamic testing (DAST) performed on running applications?
  - Question: Is software composition analysis (SCA) scanning dependencies?
  - Question: Are container images scanned for vulnerabilities?
  - Question: Is SBOM (Software Bill of Materials) generated for all deployments?
  - Question: Are critical vulnerabilities patched within 24 hours?
  - Verification: Review security testing results and vulnerability remediation times

- [ ] **Secure Development Practices**: Error handling, concurrency, and code quality
  - Question: Are detailed errors logged but generic messages returned to users?
  - Question: Are atomic transactions used to prevent race conditions?
  - Question: Are high-quality random number generators used for cryptographic operations?
  - Question: Is debug/development functionality disabled in production?
  - Question: Are binaries hardened and code signed securely?
  - Verification: Test error conditions, concurrent operations, and production configuration

- [ ] **Dependency & Supply Chain Security**: Third-party code and open source management
  - Question: Are all open source dependencies approved by legal?
  - Question: Are third-party dependencies hosted in AWS infrastructure?
  - Question: Is dependency management automated with vulnerability monitoring?
  - Question: Are software supply chain security standards applied (SCM, build, artifact, deployment)?
  - Verification: Review dependency licenses and supply chain security controls

**7. Logging, Monitoring & Detection**

- [ ] **Comprehensive Logging**: Secure, immutable logging with encryption
  - Question: Are all actions logged with full context (who, what, when, where, why)?
  - Question: Are logs immutable (S3 Object Lock) and encrypted at rest/transit?
  - Question: Is log retention appropriate (7 years for compliance)?
  - Question: Are correlation IDs used for end-to-end request tracing?
  - Question: Is time synchronization (NTP) configured for accurate timestamps?
  - Verification: Review log completeness and test log immutability

- [ ] **Threat Detection & Monitoring**: GuardDuty, Security Hub, and anomaly detection
  - Question: Is AWS GuardDuty enabled in all regions?
  - Question: Is AWS Security Hub centralized for security findings?
  - Question: Is AWS Config monitoring configuration compliance?
  - Question: Are CloudWatch alarms configured for security anomalies?
  - Question: Is X-Ray tracing enabled for distributed request tracking?
  - Question: Is ML-based anomaly detection implemented?
  - Verification: Review GuardDuty findings and test alerting mechanisms

**8. Compliance & Governance**

- [ ] **Configuration Compliance & Governance**: AWS Config and policy enforcement
  - Question: Is AWS Config enabled in all regions with compliance rules?
  - Question: Are Service Control Policies (SCPs) enforcing organizational guardrails?
  - Question: Is change management formal with review and approval?
  - Question: Are test and production environments completely separated?
  - Question: Is production data never used in test (or properly anonymized)?
  - Verification: Review Config rules and test environment isolation

- [ ] **Audit & Compliance Controls**: Regulatory compliance and audit trails
  - Question: Are compliance requirements mapped to specific regulations (SOX, GDPR, HIPAA)?
  - Question: Do audit trails capture all necessary events with appropriate retention?
  - Question: Are privacy controls implemented with data minimization?
  - Question: Are risk assessments comprehensive with mitigation strategies?
  - Question: Is cross-partition access restricted and monitored?
  - Verification: Review compliance mappings and audit trail completeness

**9. AI/ML Specific Security Controls**

- [ ] **Prompt Security & Input Validation**: GenAI prompt sanitization and validation
  - Question: Is prompt sanitization removing injection patterns?
  - Question: Is semantic analysis detecting malicious prompts?
  - Question: Are prompt complexity limits enforced (maximum tokens)?
  - Question: Is context window protection preventing overflow attacks?
  - Question: Is jailbreak detection implemented with pattern matching?
  - Verification: Test with prompt injection and jailbreak attempts

- [ ] **Bedrock Guardrails & Output Filtering**: Comprehensive GenAI output controls
  - Question: Are Bedrock Guardrails configured for content filtering?
  - Question: Is real-time PII detection and redaction in model outputs?
  - Question: Are denied topics and word filters configured?
  - Question: Is sensitive information filtering applied to outputs?
  - Question: Are all server-side capabilities using model output authorized?
  - Verification: Test guardrails with inappropriate content and PII

- [ ] **Model & Training Data Security**: Model protection and data poisoning prevention
  - Question: Are training data cryptographically signed?
  - Question: Are all model artifacts encrypted at rest?
  - Question: Is PII scrubbed from training data?
  - Question: Is differential privacy implemented for sensitive training data?
  - Question: Are model training data provenance and monitoring mechanisms in place?
  - Question: Is data poisoning protection implemented?
  - Verification: Review training data security and model artifact encryption

- [ ] **AI/ML Operational Security**: Model access, monitoring, and responsible AI
  - Question: Is IAM-based access control applied to AI models with least privilege?
  - Question: Is model behavior monitoring implemented for anomalies?
  - Question: Are bias detection and fairness metrics monitored?
  - Question: Is explainable AI implemented for transparency?
  - Question: Are Bedrock Agents secured with proper IAM policies?
  - Question: Is an Andon Cord system implemented for GenAI emergencies?
  - Verification: Review model access controls and responsible AI implementation

**10. Availability & Resilience**

- [ ] **High Availability Architecture**: Multi-AZ deployment with auto-scaling
  - Question: Is the architecture deployed across multiple Availability Zones?
  - Question: Is auto-scaling configured for horizontal scaling?
  - Question: Are health checks automated with graceful degradation?
  - Question: Are circuit breakers preventing cascade failures?
  - Question: Are disaster recovery procedures tested regularly?
  - Verification: Test failover scenarios and disaster recovery drills

- [ ] **DDoS Protection & Rate Limiting**: Comprehensive availability protection
  - Question: Is AWS Shield Advanced or equivalent DDoS protection enabled?
  - Question: Is WAF configured with bot control and adaptive rate limiting?
  - Question: Are CAPTCHA challenges used for suspicious traffic?
  - Question: Is IP reputation filtering blocking known malicious IPs?
  - Question: Are per-user token quotas and model resource limits enforced (AI/ML)?
  - Verification: Test rate limiting and DDoS protection mechanisms

**11. Incident Response & Recovery**

- [ ] **Incident Response Capability**: Comprehensive incident response and recovery
  - Question: Is an incident response plan documented and tested?
  - Question: Is automated remediation configured for common incidents?
  - Question: Are forensics capabilities available for investigation?
  - Question: Is runbook automation implemented for response procedures?
  - Question: Are communication plans and breach notification procedures defined?
  - Question: Are post-incident reviews and lessons learned documented?
  - Verification: Conduct tabletop exercises and test incident response procedures

**12. Specialized Security Controls**

- [ ] **Domain & Email Security**: DNS, domain registration, and email authentication
  - Question: Are SPF, DKIM, and DMARC configured for all sending domains?
  - Question: Are domains registered with registrar lock and auto-renewal?
  - Question: Is subdomain takeover prevention implemented?
  - Question: Are DMARC reports monitored for email spoofing attempts?
  - Verification: Use email authentication testing tools and review domain security

- [ ] **API & Service-Specific Security**: GraphQL, cache, and specialized service security
  - Question: Is GraphQL API secured with query complexity limits and depth restrictions?
  - Question: Are cache servers secured with encryption and access controls?
  - Question: Is HTTP desync/request smuggling mitigation implemented?
  - Question: Is padding oracle attack prevention implemented?
  - Question: Are service-specific threat detection rules configured?
  - Verification: Test API security controls and service-specific vulnerabilities

- [ ] **Edge & Hybrid Security**: Outposts, Local Zones, and on-premises integration
  - Question: Is secure design applied to AWS Outposts and Edge Zones?
  - Question: Are on-premises credentials scoped and rotated appropriately?
  - Question: Is VPN/Direct Connect secured for hybrid connectivity?
  - Question: Are edge locations secured with appropriate controls?
  - Verification: Review edge location and hybrid security architecture


### 4. Implementation and Operations Review

#### Development and Deployment Strategy
**Evaluation Criteria:**
- **Development Process**: Are development methodologies and practices clearly defined?
- **Testing Strategy**: Is the testing approach comprehensive across all levels?
- **Deployment Pipeline**: Are CI/CD processes robust and automated?
- **Environment Management**: Are development, staging, and production environments properly managed?
- **Quality Assurance**: Are code quality and review processes adequate?

**Review Questions:**
- Are agile development practices properly implemented with appropriate ceremonies?
- Does the testing strategy cover unit, integration, system, and acceptance testing?
- Are deployment pipelines automated with proper approval gates and rollback capabilities?
- Are environment configurations managed as code with proper version control?
- Are code review processes enforced with appropriate quality gates?

#### Operational Excellence Review
**Evaluation Criteria:**
- **Monitoring**: Are monitoring and observability capabilities comprehensive?
- **Incident Response**: Are incident management processes clearly defined?
- **Capacity Management**: Are capacity planning and auto-scaling strategies adequate?
- **Backup and Recovery**: Are backup and disaster recovery procedures comprehensive?
- **Maintenance**: Are maintenance and update procedures clearly defined?

**Review Questions:**
- Do monitoring capabilities provide visibility into application, infrastructure, and business metrics?
- Are incident response procedures tested with clear escalation paths and communication plans?
- Are capacity management processes proactive with automated scaling capabilities?
- Are backup and recovery procedures tested with documented RTO and RPO targets?
- Are maintenance windows and update procedures designed to minimize business impact?

### 5. Business Value and Risk Assessment

#### Business Value Analysis
**Evaluation Criteria:**
- **Value Proposition**: Is the business value clearly articulated and measurable?
- **Success Metrics**: Are success criteria specific and achievable?
- **ROI Justification**: Is the return on investment calculation realistic?
- **Stakeholder Alignment**: Are stakeholder needs and expectations properly addressed?
- **Market Timing**: Is the solution timeline aligned with business needs?

**Review Questions:**
- Are business benefits quantified with specific metrics and timelines?
- Do success criteria align with organizational objectives and stakeholder expectations?
- Is the ROI calculation based on realistic assumptions and market conditions?
- Are all key stakeholders identified with their needs and concerns addressed?
- Is the implementation timeline aligned with business priorities and market opportunities?

#### Risk Assessment and Mitigation
**Evaluation Criteria:**
- **Risk Identification**: Are technical, business, and operational risks comprehensively identified?
- **Risk Analysis**: Are risks properly assessed for probability and impact?
- **Mitigation Strategies**: Are mitigation plans realistic and actionable?
- **Contingency Planning**: Are contingency plans adequate for high-impact risks?
- **Risk Monitoring**: Are risk monitoring and reporting processes defined?

**Review Questions:**
- Are risks identified across all categories (technical, business, operational, regulatory)?
- Are risk assessments based on historical data and industry benchmarks?
- Are mitigation strategies specific, actionable, and assigned to responsible parties?
- Are contingency plans tested and ready for implementation if needed?
- Are risk monitoring processes integrated into regular project governance?

## Review Process and Deliverables

### Pre-Review Preparation
1. **Document Analysis**: Thoroughly review all specification package components
2. **Stakeholder Identification**: Identify key stakeholders and their concerns
3. **Context Research**: Research relevant industry standards and best practices
4. **Checklist Preparation**: Prepare specific checklists based on project type and domain

### Review Execution
1. **Structured Walkthrough**: Conduct systematic review of each specification section
2. **Cross-Reference Analysis**: Verify consistency and alignment across documents
3. **Gap Analysis**: Identify missing elements or insufficient detail
4. **Risk Assessment**: Evaluate technical and business risks with mitigation strategies

## Required Outputs

You must produce exactly **TWO OUTPUTS** for every design review:

### OUTPUT 1: Design Review Scoring Assessment (Standalone Score Sheet)

This output evaluates how the current specification package scores against design review criteria. **This must be provided as a complete, standalone document that can be saved as a separate score sheet file.**

#### Executive Summary
- **Overall Score**: Numerical score (0-100)
- **Key Findings**: Critical issues, risks, and recommendations
- **Go/No-Go Recommendation**: Clear recommendation on proceeding with implementation
- **Success Probability**: Assessment of likelihood of successful delivery

#### Detailed Scoring by Category

**1. Requirements Assessment (Weight: 25%)**
- **Functional Requirements Score**: X/20 points
  - Completeness: X/5 points
  - Clarity: X/5 points
  - Traceability: X/5 points
  - Feasibility: X/5 points
- **Non-Functional Requirements Score**: X/20 points
  - Performance: X/5 points
  - Scalability: X/5 points
  - Security: X/5 points
  - Operational: X/5 points
- **Category Total**: X/40 points
- **Weighted Score**: X/25 points

**2. Architecture and Design (Weight: 25%)**
- **High-Level Architecture Score**: X/20 points
  - Architectural Patterns: X/5 points
  - Component Design: X/5 points
  - Integration Strategy: X/5 points
  - Technology Choices: X/5 points
- **Data Architecture Score**: X/20 points
  - Data Model: X/5 points
  - Storage Strategy: X/5 points
  - Data Flow: X/5 points
  - Governance: X/5 points
- **Category Total**: X/40 points
- **Weighted Score**: X/25 points

**3. Security and Compliance (Weight: 20%)**
- **Security Architecture Score**: X/15 points
  - Authentication: X/4 points
  - Authorization: X/4 points
  - Data Protection: X/4 points
  - Monitoring: X/3 points
- **AWS Baseline Security Controls Coverage Score**: X/15 points
  - BSC Implementation Coverage: X/4 points (% of applicable BSC controls implemented)
  - Zero-Threat Architecture Progress: X/4 points (STRIDE coverage)
  - AI/ML Security Controls: X/4 points (if applicable, otherwise redistribute)
  - Security Testing Framework: X/3 points
- **Compliance Framework Score**: X/10 points
  - Regulatory Coverage: X/3 points
  - Audit Trails: X/2 points
  - Risk Management: X/3 points
  - Governance: X/2 points
- **Category Total**: X/40 points
- **Weighted Score**: X/20 points

**4. Implementation and Operations (Weight: 15%)**
- **Development Strategy Score**: X/20 points
  - Development Process: X/5 points
  - Testing Strategy: X/5 points
  - Deployment Pipeline: X/5 points
  - Quality Assurance: X/5 points
- **Operational Excellence Score**: X/20 points
  - Monitoring: X/5 points
  - Incident Response: X/5 points
  - Capacity Management: X/5 points
  - Backup and Recovery: X/5 points
- **Category Total**: X/40 points
- **Weighted Score**: X/15 points

**5. Business Value and Risk (Weight: 15%)**
- **Business Value Score**: X/20 points
  - Value Proposition: X/5 points
  - Success Metrics: X/5 points
  - ROI Justification: X/5 points
  - Stakeholder Alignment: X/5 points
- **Risk Assessment Score**: X/20 points
  - Risk Identification: X/5 points
  - Risk Analysis: X/5 points
  - Mitigation Strategies: X/5 points
  - Contingency Planning: X/5 points
- **Category Total**: X/40 points
- **Weighted Score**: X/15 points

#### Overall Assessment
- **Total Weighted Score**: X/100 points
- **Readiness Level**: Ready / Needs Minor Improvements / Needs Major Improvements / Not Ready

#### Critical Issues Identified
List all critical issues that must be addressed before implementation can proceed.

#### Improvement Recommendations
Prioritized list of recommendations for enhancing the specification package.

### OUTPUT 2: Improved Specification Package

This output provides a complete, improved version of the specification package that incorporates all feedback from the scoring assessment. **The structure must remain identical to the original specification package and must be organized in a new iteration folder.**

#### Folder Structure Requirements
- **CRITICAL**: Create a new folder named `specification-package-iteration-X/` where X is the iteration number
- **First Iteration**: Original package goes in `specification-package-iteration-1/`
- **Subsequent Iterations**: Improved packages go in `specification-package-iteration-2/`, `specification-package-iteration-3/`, etc.
- Maintain the exact same internal folder structure as the original package within each iteration folder
- Keep the same document names and organization within each iteration folder
- Add new content only where gaps were identified
- Enhance existing content based on review feedback

#### Improvement Integration Guidelines (if improvements are needed)
- **Requirements Documents**: Enhance clarity, add missing requirements, improve acceptance criteria, strengthen RTM
  - Modified files: Add "-improved" suffix (e.g., `functional-requirements-improved.md`)
  - Unchanged files: Copy from previous iteration without modification
- **Architecture Documents**: Strengthen architectural decisions, add missing components, improve integration strategies
  - Modified files: Add "-improved" suffix (e.g., `architecture-decisions-improved.md`)
  - Unchanged files: Copy from previous iteration without modification
- **User Stories**: Refine acceptance criteria, add missing stories, improve traceability
  - Modified files: Add "-improved" suffix (e.g., `user-stories-improved.md`)
  - Unchanged files: Copy from previous iteration without modification
- **README and Navigation**: Update to reflect improvements and additions
  - Always update README to reflect current iteration status and improvements made

#### Quality Standards for Improved Package
- All critical issues from OUTPUT 1 must be addressed
- Important improvements should be incorporated where feasible
- Optimization opportunities should be considered for inclusion
- Consistency across all documents must be maintained
- Professional quality and formatting standards must be met
- **Iteration Completeness**: Each iteration folder must contain the complete specification package

#### Validation Requirements
- Improved package should score significantly higher if re-reviewed
- All original business objectives must still be met
- No new critical risks should be introduced
- Implementation feasibility must be maintained or improved
- Stakeholder needs must continue to be addressed
- **90/100 Target**: Continue iterations until achieving minimum 90/100 score

#### Iteration Folder Example Structure
```
specification-package-iteration-2/
├── requirements/
│   ├── functional-requirements-improved.md      (modified from iteration 1)
│   ├── non-functional-requirements.md           (copied unchanged from iteration 1)
│   └── requirements-traceability-matrix-improved.md (modified from iteration 1)
├── user-stories/
│   └── user-stories-improved.md                 (modified from iteration 1)
├── architecture/
│   └── architecture-decisions.md                (copied unchanged from iteration 1)
└── README.md                                    (updated to reflect iteration 2 improvements)
```

## Iterative Review Process

### Multiple Iteration Support
This design review process supports iterative refinement cycles with mandatory continuation until 90/100 score:

1. **Iteration Tracking**: Each review iteration should be clearly identified (e.g., "Iteration 1", "Iteration 2")
2. **Progress Documentation**: Document improvements made since the previous iteration
3. **Score Progression**: Track score improvements across iterations with detailed comparison
4. **Convergence Target**: **MANDATORY** - Continue iterations until achieving minimum 90/100 score
5. **Standalone Score Sheets**: Each iteration produces a complete, standalone score sheet
6. **Folder Structure Management**: Each iteration creates a new complete specification package folder
7. **File Management**: Only copy over the files from the previous iteration if they are unchanged. Otherwise, only include the updated files in each iteration.

### Iteration-Specific Instructions
- **First Iteration**: Review the original generated specification package from `specification-package-iteration-1/`
- **Subsequent Iterations**: Review the most recent improved specification package from the latest iteration folder
- **Score Comparison**: Compare current scores with previous iteration scores and document progression
- **Remaining Issues**: Focus on issues not yet resolved from previous iterations
- **Incremental Improvement**: Ensure each iteration shows measurable progress toward 90/100 target
- **Mandatory Continuation Rule**: If current score < 90/100, MUST proceed to next iteration
- **Maximum Iterations**: Continue up to 5 iterations if necessary to reach the 90/100 target

### Folder Structure Requirements for Each Iteration
Each iteration must create a new complete specification package folder:

```
specification-package-iteration-1/  (original generated package)
├── requirements/
│   ├── functional-requirements.md
│   ├── non-functional-requirements.md
│   └── requirements-traceability-matrix.md
├── user-stories/
│   └── user-stories.md
├── architecture/
│   └── architecture-decisions.md
└── README.md

specification-package-iteration-2/  (first improved package)
├── requirements/
│   ├── functional-requirements-improved.md  (if modified)
│   ├── non-functional-requirements.md       (copied if unchanged)
│   └── requirements-traceability-matrix-improved.md (if modified)
├── user-stories/
│   └── user-stories-improved.md             (if modified)
├── architecture/
│   └── architecture-decisions.md            (copied if unchanged)
└── README.md                                (copied if unchanged)
```

### Score Progression Tracking
Each iteration's score sheet must include:

```markdown
## Score Progression Summary
| Iteration | Overall Score | Change from Previous | Key Improvements Made |
|-----------|---------------|---------------------|----------------------|
| 1         | X/100         | N/A (baseline)      | N/A (baseline)       |
| 2         | Y/100         | +Z points           | [List key improvements] |
| 3         | A/100         | +B points           | [List key improvements] |

## Security Control Coverage Progression
| Iteration | BSC Coverage | STRIDE Coverage | Residual Threats | Security Score |
|-----------|--------------|-----------------|------------------|----------------|
| 1         | X%           | Y%              | Z threats        | A/20 points    |
| 2         | X%           | Y%              | Z threats        | A/20 points    |
| 3         | X%           | Y%              | Z threats        | A/20 points    |

**Security Improvement Focus by Iteration:**
- Iteration 1: Identify missing BSC controls and security gaps
- Iteration 2: Implement critical security controls and address high-priority threats
- Iteration 3+: Achieve zero-threat architecture target with 100% BSC coverage

## Remaining Issues to Address
- Issue 1: [Description and target iteration for resolution]
- Issue 2: [Description and target iteration for resolution]

## Target for Next Iteration
**Target Score**: [Target score for next iteration]
**Key Focus Areas**: [Areas requiring most attention]
**Expected Completion**: [If score ≥ 90, indicate "Final iteration expected"]
```

## Important Notes

1. **Both outputs are mandatory** - Never provide only one output
2. **Maintain original structure** - The improved package must follow the exact same organization as the original
3. **Be comprehensive** - Address all identified issues and improvements
4. **Stay consistent** - Ensure all documents in the improved package align with each other
5. **Preserve intent** - Maintain the original business objectives and scope while improving quality
6. **Iterative Progress** - Each iteration should show measurable improvement toward the 90/100 target

## Review Quality Standards

### Thoroughness
- All specification components reviewed systematically
- Cross-references and dependencies validated
- Industry standards and best practices applied
- Stakeholder perspectives considered
- AWS Baseline Security Controls checklist completed 100%
- Zero-Threat Architecture validation performed

### Objectivity
- Evidence-based assessments with clear rationale
- Balanced evaluation of strengths and weaknesses
- Constructive feedback focused on improvement
- Recommendations aligned with business objectives

### Actionability
- Specific, actionable recommendations with clear priorities
- Implementation guidance and resource requirements
- Timeline considerations and dependency management
- Success criteria and validation approaches

### Communication
- Clear, professional communication appropriate for audience
- Executive summary for leadership decision-making
- Technical details for implementation teams
- Risk communication with appropriate context and mitigation
