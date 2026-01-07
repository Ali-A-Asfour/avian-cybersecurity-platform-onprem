# Task Execution Workflow

## Purpose
This document defines the core workflow methodology for the Coding Agent, ensuring consistent execution of the simplified artifact-generation approach.

## Core Workflow Principles

### 1. Artifact Generation Only
- **Never run deployment commands** (`cdk deploy`, `aws cloudformation deploy`, etc.)
- **Always generate complete artifacts** in `generated/build/solution/`
- **Always create handoff documents** for Deploy Agent
- **Always validate synthesis** with `cdk synth`

### 2. Build WITH User (Collaborative Approach)
- **Always propose stack organization** and get user confirmation
- **Always ask for clarification** when design is ambiguous
- **Always document assumptions** when making implementation decisions
- **Always provide transparency** about what you're building and why

### 3. Test Planning Only (No Test Code Generation)
- **Document test requirements** in `docs/test-plan.md`
- **Map testing needs** to functional requirements
- **Suggest testing approaches** (unit, integration, e2e)
- **Never generate test code** - agent not mature enough for quality test generation

### 4. Clear Handoff Process
- **Create deploy handoff document** with deployment guidance (not rigid steps)
- **Document stack dependencies** and deployment order
- **List all generated artifacts** and their locations
- **Set status to "ready-for-deployment"** when complete

## Task Execution Sequence

### Task 0: Input Validation & Implementation Planning
**Purpose**: Detect input source, validate quality, propose stack organization

**Key Activities**:
1. Check for Design Agent output vs user documents
2. Validate documentation quality (user documents path)
3. Propose stack organization (ALWAYS ask user to confirm)
4. Check for ADRs and blueprint integration
5. Generate initial implementation plan structure

**Success Criteria**:
- Input source identified and validated
- Stack organization confirmed by user
- Blueprint approach determined (if applicable)
- Quality assessment complete (user documents path)

### Task 1: Load Implementation Tasks
**Purpose**: Generate dynamic implementation plan based on design documents

**Key Activities**:
1. Read ALL design documents comprehensively
2. Map functional requirements to implementation tasks
3. Create task breakdown with proper dependencies
4. Link tasks to reference documents
5. Populate code-handoff.md with complete task list

**Success Criteria**:
- All functional requirements covered by tasks
- Task dependencies properly sequenced
- Reference documents mapped to each task
- Implementation notes provide clear guidance

### Task 2: Project Setup
**Purpose**: Initialize project structure based on confirmed approach

**Key Activities**:
1. Create project directory structure
2. Copy blueprints (if blueprint approach)
3. Set up basic CDK structure (if greenfield)
4. Initialize git repository
5. Create initial documentation structure

**Success Criteria**:
- Project structure established
- Blueprint integration complete (if applicable)
- Development environment ready
- Basic documentation framework in place

### Task 3+: Implementation Tasks
**Purpose**: Execute the dynamic implementation plan generated in Task 1

**Key Activities**:
1. Read task details and reference documents
2. Implement according to design specifications
3. Validate with `cdk synth` (no deployment)
4. Update task status in code-handoff.md
5. Move to next task when complete

**Success Criteria**:
- All implementation tasks completed
- CloudFormation templates synthesize successfully
- Requirements traceability documented
- Test plan created (documentation only)

## Stack Organization Patterns

### Layered Approach (Default Recommendation)
```
Governance Stack (IAM, KMS, VPC if needed)
  ↓
Data Stack (DynamoDB, S3, RDS)
  ↓
Compute Stack (Lambda, ECS, Fargate)
  ↓
API Stack (API Gateway, routes)
  ↓
Operations Stack (CloudWatch, alarms)
```

**Benefits**:
- Clear dependencies
- Incremental deployment
- Standard AWS best practice
- 10-50 resources per stack (optimal)

### Alternative Patterns
- **Service-based**: Separate stack per microservice
- **Feature-based**: Separate stack per feature
- **Custom**: User-specified organization

**Always Ask User**: Present recommendation and alternatives, get confirmation before proceeding

## Blueprint Integration Patterns

### Copy & Customize Approach
- Copy blueprint source code to project
- Apply customizations per integration-design.md
- Treat as editable codebase
- Maintain blueprint structure for updates

### Reference & Configure Approach
- Import blueprint as npm package
- Configure via parameters/config files
- Extend via custom stacks
- Treat as external dependency

## Quality Gates

### Before Task 1 (Load Implementation Tasks)
- [ ] Input source identified and validated
- [ ] Stack organization confirmed by user
- [ ] Quality assessment complete (user documents path)
- [ ] Blueprint approach determined (if applicable)

### Before Task 2 (Project Setup)
- [ ] Implementation plan generated and validated
- [ ] All functional requirements covered
- [ ] Task dependencies properly sequenced
- [ ] Reference documents accessible

### Before Task 3+ (Implementation)
- [ ] Project structure established
- [ ] Development environment configured
- [ ] Task breakdown validated
- [ ] Blueprint integration complete (if applicable)

### Before Completion
- [ ] All implementation tasks completed
- [ ] CloudFormation templates synthesize successfully
- [ ] Requirements traceability documented
- [ ] Test plan created
- [ ] Deploy handoff document complete

## Error Handling and Recovery

### Common Issues and Solutions

**Issue**: No input source found
**Solution**: Guide user to provide Design Agent output or place documents in project-doc/

**Issue**: Documentation quality too low (user documents path)
**Solution**: Block execution, provide specific guidance on missing information

**Issue**: Stack organization unclear
**Solution**: Propose layered approach, explain rationale, get user confirmation

**Issue**: Blueprint integration unclear
**Solution**: Check for gap-analysis.md, read integration-design.md for approach

**Issue**: Implementation task unclear
**Solution**: Read reference documents, ask user for clarification if still unclear

### Recovery Patterns

**If Task 0 fails**: Fix input source or documentation quality issues
**If Task 1 fails**: Clarify requirements or design documents
**If Task 2 fails**: Fix project structure or blueprint integration
**If Task 3+ fails**: Review reference documents, clarify requirements

## Success Metrics

### Workflow Completion
- Status: "ready-for-deployment" in code-handoff.md
- All tasks marked "complete"
- Deploy handoff document created
- No deployment commands executed

### Artifact Quality
- CloudFormation templates synthesize without errors
- All functional requirements have implementation
- Requirements traceability matrix complete
- Test plan documents testing approach

### User Experience
- Stack organization confirmed by user
- Clear communication about approach and decisions
- Transparent about assumptions and limitations
- Realistic expectations set for iteration

## Integration with Other Agents

### Design Agent → Coding Agent
- Reads specification packages from Design Agent
- Uses comprehensive design documents as reference
- Follows architecture and security guidance
- Implements according to detailed specifications

### Coding Agent → Deploy Agent
- Creates deploy handoff document with guidance
- Documents stack dependencies and order
- Lists all generated artifacts
- Provides deployment prerequisites and validation steps

## Continuous Improvement

### Feedback Collection
- Document issues encountered during execution
- Note areas where guidance was unclear
- Identify patterns in user questions or confusion
- Track success rates for different project types

### Process Refinement
- Update task modules based on lessons learned
- Improve stack organization recommendations
- Enhance blueprint integration patterns
- Refine quality gates and success criteria