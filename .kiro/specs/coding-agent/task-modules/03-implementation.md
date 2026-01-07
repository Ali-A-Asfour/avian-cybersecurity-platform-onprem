# Task 3+: Implementation

Execute the implementation tasks loaded in code-handoff.md, adapting approach based on input source and documentation quality.

## Before Starting

Check `.workflow-state/code-handoff.md` for:
- Current progress and loaded tasks
- Input source (design-agent vs user-documents)
- Quality assessment and documentation gaps (user-documents path)
- Assumptions and risks identified during planning

Remember that you need to read the coding-agent/coding-standards.md steering documents when doing development tasks

## Core Implementation Principles

1. **Generate Artifacts Only** - Never run deployment commands
2. **Build WITH User** - Collaborative, not autonomous
3. **Test Planning Only** - Document test requirements, don't generate test code
4. **Clear Handoff** - Create deploy-handoff.md for Deploy Agent

### Prohibited Commands
- ❌ `cdk deploy` - Never deploy
- ❌ `aws cloudformation deploy` - Never deploy
- ❌ `aws cloudformation create-stack` - Never deploy
- ✅ `cdk synth` - OK (generates templates only)

## Execute Implementation Tasks

Work through the tasks loaded by Task 1 (Tasks 3-N in code-handoff.md):

### For Each Task:

1. **Read the task details** from code-handoff.md:
   - Task name and number
   - Implementation notes
   - **Reference documents list**
   - Quality notes and assumptions (user-documents path)
   - Identified risks and mitigation strategies

2. **Review reference documents BEFORE starting**:
   - Each task has a `referenceDocuments` array listing relevant source docs
   - Read ALL referenced documents to understand requirements and approach
   - Pay special attention to sections marked with `#section-anchor`
   - **Path A**: Comprehensive design specifications with detailed guidance
   - **Path B**: User documents with potential gaps - note assumptions needed

3. **Execute the task with path-appropriate approach**:
   
   **Path A (Design Agent)**:
   - Follow implementation notes as detailed guidance
   - Implement according to comprehensive requirements in design documents
   - Leverage detailed architecture and security specifications
   
   **Path B (User Documents)**:
   - Follow implementation notes while considering documented assumptions
   - Implement based on available user documentation
   - Make reasonable implementation decisions for undocumented areas
   - Document decisions made due to documentation gaps
   - Test thoroughly due to potential specification gaps

4. **Update task status in code-handoff.md** (REQUIRED - DO NOT SKIP):
   - **BEFORE starting**: Mark task as `"current"` 
   - **WHILE working**: Update subtask statuses as you complete them
   - **AFTER finishing**: Mark task as `"complete"`
   - **ALWAYS**: Update `lastUpdated` timestamp to current date/time
   - **ALWAYS**: Update `note` field with progress summary
   
   **Example update**:
   ```json
   {
     "status": "in-progress",
     "lastUpdated": "2025-10-15T16:45:00Z",
     "note": "Task 3 complete: Governance Stack implemented and tested. Starting Task 4: Data Stack Implementation.",
     "taskDetails": [
       { "taskNumber": "3", "status": "complete", ... },
       { "taskNumber": "4", "status": "current", ... }
     ]
   }
   ```

### Example Task Execution Flow:

```
1. Read Task 3 from code-handoff.md
2. See referenceDocuments: ["requirements/functional-requirements.md#FR-003", "integration-design.md#governance-component"]
3. Read functional-requirements.md FR-003 to understand WHAT to build
4. Read integration-design.md governance section to understand HOW to build it
5. Implement the governance stack following the design
6. Test the implementation with `cdk synth`
7. Update Task 3 status to "complete"
8. Move to Task 4
```

### Additional Reference Materials:

**Path A (Design Agent)**:
- `coding-agent/coding-standards.md` steering document for development standards
- Blueprint `blueprint_instructions.md` files for component-specific steps
- Design Agent architecture documents for comprehensive system context
- Threat model documents for security implementation guidance

**Path B (User Documents)**:
- `coding-agent/coding-standards.md` steering document for development standards
- `.workflow-state/input-quality-assessment.md` for documentation gaps and assumptions
- User-provided documents in `project-doc/` folder
- Industry best practices to fill documentation gaps

## Requirements Validation Task

When you reach the requirements validation task (typically Task N-1):

### Process

1. **Read Requirements Directory**
   - `generated/design/specification-package-iteration-*/requirements/`
   - List all functional requirements
   - List all user stories

2. **For Each Functional Requirement**
   - Identify which stack/resource implements it
   - Document in traceability matrix
   - Verify implementation matches requirement
   - Flag any gaps or assumptions

3. **For Each User Story**
   - Verify acceptance criteria can be met
   - Map to implemented features
   - Document how to test/validate
   - Flag any incomplete implementations

4. **Generate Validation Report**
   - Output: `docs/requirements-traceability.md`

### Report Structure

```markdown
# Requirements Traceability Matrix

## Functional Requirements Coverage

| Req ID | Requirement | Implemented By | Status | Notes |
|--------|-------------|----------------|--------|-------|
| FR-001 | User authentication | Governance Stack (Cognito), Compute Stack (Auth Lambda) | ✅ Complete | |
| FR-002 | Data storage | Data Stack (DynamoDB UserTable) | ✅ Complete | |
| FR-003 | API endpoints | API Stack (API Gateway routes) | ✅ Complete | |

## User Story Acceptance Criteria

### US-001: User Login
**Story**: As a user, I want to log in so that I can access my account

**Acceptance Criteria**:
- [ ] User can enter email and password
- [ ] System validates credentials
- [ ] User receives JWT token on success
- [ ] User sees error message on failure

**Implementation**:
- Login endpoint: API Stack (POST /auth/login)
- Validation: Compute Stack (AuthLambda)
- Token generation: Compute Stack (AuthLambda using Cognito)
- Error handling: API Stack (error responses)

**Testing Approach**: See test-plan.md section "Authentication Testing"

## Gaps and Assumptions

### Identified Gaps
1. [Gap description]
   - Impact: [High/Medium/Low]
   - Mitigation: [How to address]

### Assumptions Made
1. [Assumption description]
   - Rationale: [Why this assumption]
   - Risk: [What if assumption is wrong]
   - Validation: [How to verify]

## Testing Recommendations

See `docs/test-plan.md` for detailed testing guidance.

**Priority Testing Areas**:
1. [High-priority feature] - Critical path
2. [Security feature] - Security-critical
3. [Integration point] - Cross-service dependency
```

## Test Planning Task

When you reach the final test planning task (typically Task N):

### Process

1. **For Each Functional Requirement**
   - Document what needs testing
   - Map to components that implement it
   - Suggest test approach (unit, integration, e2e)
   - Define acceptance criteria

2. **Document Test Data Requirements**
   - What test data is needed
   - How to generate or obtain it
   - Data privacy considerations

3. **Suggest Testing Strategy**
   - Testing phases and approach
   - Tools and frameworks to consider
   - Testing environment requirements

### Test Plan Document Structure

```markdown
# Test Plan

## Testing Strategy

### Unit Testing
- **Scope**: Individual Lambda functions, utility classes
- **Framework**: Jest for Node.js, pytest for Python
- **Coverage Target**: 80% minimum for business logic

### Integration Testing
- **Scope**: API endpoints, database operations, service integrations
- **Approach**: Test against real AWS services in test environment
- **Tools**: Postman/Newman for API testing

### End-to-End Testing
- **Scope**: Complete user workflows
- **Approach**: Automated browser testing for UI, API workflow testing
- **Tools**: Cypress for web UI, custom scripts for API workflows

## Test Requirements by Feature

### Feature: User Authentication
**What to Test**:
- Valid login with correct credentials
- Invalid login with wrong credentials
- Token expiration handling
- Password reset flow

**Test Data Needed**:
- Valid user accounts in test Cognito pool
- Invalid credential combinations
- Expired tokens

**Acceptance Criteria**:
- All authentication flows work as specified
- Security controls prevent unauthorized access
- Error messages are user-friendly

### Feature: Data Processing
[Similar structure for each feature]

## Testing Environment

### Prerequisites
- AWS test account with appropriate permissions
- Test data sets
- Monitoring and logging enabled

### Setup Instructions
1. Deploy infrastructure to test environment
2. Load test data
3. Configure monitoring
4. Run smoke tests

## Test Execution

### Manual Testing Checklist
- [ ] All API endpoints respond correctly
- [ ] User workflows complete successfully
- [ ] Error handling works as expected
- [ ] Security controls are effective

### Automated Testing
- Unit tests: Run with `npm test` or `pytest`
- Integration tests: Run with test scripts
- E2E tests: Run with `npm run e2e`

## Success Criteria

- All functional requirements have corresponding tests
- Test coverage meets minimum thresholds
- All tests pass in clean test environment
- Performance meets non-functional requirements
```

### What NOT to Generate

- ❌ No unit test files
- ❌ No integration test files
- ❌ No test framework setup
- ❌ No mocks or stubs

**Rationale**: Agent not mature enough for test generation. Better to document requirements clearly than generate shallow/broken tests.

## Handoff to Deploy Agent

After completing all implementation tasks:

1. **Verify Synthesis**
   ```bash
   cdk synth
   ```
   Ensure CloudFormation templates generate without errors.

2. **Create Deploy Handoff Document**
   - Use template: `resources/shared/templates/deploy-handoff-template.md`
   - Document deployment order (guidance, not rigid steps)
   - List required AWS credentials/permissions
   - Specify deployment regions (from deployment-strategy.md)
   - Note any manual steps required
   - Document stack dependencies

3. **Output Location**
   Save handoff document to: `.workflow-state/deploy-handoff.md`

4. **Update Workflow Status**
   - Set status to "ready-for-deployment" in code-handoff.md
   - Document artifact locations
   - List all generated stacks

5. **NO DEPLOYMENT**
   - ❌ Do NOT run `cdk deploy`
   - ❌ Do NOT run `aws cloudformation` commands
   - ❌ Do NOT execute deployment
   - ✅ Provide artifacts and handoff document only

## After Completing Each Task

**IMMEDIATELY** update `.workflow-state/code-handoff.md`:
- Change completed task status from `"current"` to `"complete"`
- Change next task status from `"not_started"` to `"current"`
- Update `lastUpdated` timestamp
- Update `note` field with what was accomplished

**DO NOT PROCEED TO THE NEXT TASK WITHOUT UPDATING THE FILE**

## After All Tasks Complete

Final update to `.workflow-state/code-handoff.md`:
- Mark final task as `"complete"`
- Change overall `status` from `"in-progress"` to `"ready-for-deployment"`
- Update `lastUpdated` timestamp
- Update `note` with completion summary and handoff status
- Document any issues or deviations

### Expected Output Structure

```
generated/build/
├── solution/
│   ├── infrastructure/
│   │   ├── governance-stack/
│   │   ├── data-stack/
│   │   ├── compute-stack/
│   │   ├── api-stack/
│   │   └── operations-stack/
│   └── application/
│       └── lambda-functions/
└── docs/
    ├── deployment-guide.md
    ├── operations-runbook.md
    ├── requirements-traceability.md
    └── test-plan.md

.workflow-state/
├── code-handoff.md (status: "ready-for-deployment")
└── deploy-handoff.md (complete with deployment guidance)
```
