# Task 1: Load Implementation Tasks

Generate dynamic implementation plan based on design documents and user confirmation of stack organization.

## Before Starting

Check `.workflow-state/code-handoff.md` to see if tasks are already loaded (look for tasks beyond Task 1 and Task 2). If tasks exist, skip this task.

## Step 1: Discover Design Package

Locate and inventory all Design Agent outputs:

```bash
# Find the specification package directory
find . -type d -name "specification-package-iteration-*" | head -1

# List all markdown files in the package
find "$SPEC_DIR" -type f -name "*.md"
```

**Expected directories to check:**
- `specification-package-iteration-*/requirements/`
- `specification-package-iteration-*/user-stories/`
- `specification-package-iteration-*/architecture/`
- `supplement-material/`
- `threat-model/`
- Root level: `README.md`, `score-sheet-*.md`

## Step 2: Comprehensive Document Analysis

Read ALL discovered documents to understand the complete project scope. Pay special attention to:

### Priority 1: Implementation Guidance
- `supplement-material/integration-design.md` (deployment sequences, component integration)
- `README.md` (implementation timeline, architecture summary)

### Priority 2: Requirements & Architecture
- `requirements/functional-requirements.md` (what to build)
- `requirements/non-functional-requirements.md` (performance, security, cost constraints)
- `user-stories/user-stories.md` (user perspective, acceptance criteria)
- `architecture/system-architecture.md` (technical blueprint)

### Priority 3: Context & Constraints
- `supplement-material/gap-analysis.md` (blueprint fit, custom components)
- `supplement-material/input-assessment-analysis.md` (project context)
- `threat-model/README.md` (security requirements)

## Step 3: Generate Implementation Plan

Based on your analysis and confirmed stack organization, determine:

1. **Implementation Phases**: What are the logical groupings of work?
   - Consider: dependencies, risk, complexity, testing needs
   - Example: Foundation → Core Features → Integration → Testing

2. **Task Breakdown**: How should each phase be divided?
   - Group related components together
   - Ensure each task is independently testable
   - Balance task size (not too granular, not too broad)

3. **Reference Mapping**: Which documents inform each task?
   - Link tasks back to requirements (traceability)
   - Note which docs contain implementation details
   - Identify acceptance criteria sources

4. **Implementation Notes**: What guidance should you capture?
   - Key technical decisions
   - Deployment commands or sequences
   - Dependencies or prerequisites
   - Testing approach

## Step 4: Populate code-handoff.md

Update `.workflow-state/code-handoff.md` with your generated implementation plan.

### Task Structure Example

```json
{
  "taskDetails": [
    {
      "taskNumber": "3",
      "taskName": "Governance Stack Implementation",
      "status": "not_started",
      "referenceDocuments": [
        "supplement-material/integration-design.md#component-integration",
        "requirements/functional-requirements.md#FR-001,FR-002"
      ],
      "implementationNotes": "Create IAM roles, KMS keys, and security foundations",
      "subtasks": [
        {
          "taskNumber": "3.1",
          "taskName": "Create IAM roles for Lambda execution",
          "status": "not_started"
        },
        {
          "taskNumber": "3.2",
          "taskName": "Set up KMS keys for encryption",
          "status": "not_started"
        }
      ]
    },
    {
      "taskNumber": "4",
      "taskName": "Data Stack Implementation",
      "status": "not_started",
      "referenceDocuments": [
        "architecture/system-architecture.md#data-layer",
        "requirements/functional-requirements.md#FR-003,FR-004"
      ],
      "implementationNotes": "Create DynamoDB tables, S3 buckets, and data storage infrastructure",
      "subtasks": [
        {
          "taskNumber": "4.1",
          "taskName": "Create DynamoDB tables with proper indexes",
          "status": "not_started"
        },
        {
          "taskNumber": "4.2",
          "taskName": "Set up S3 buckets with encryption and policies",
          "status": "not_started"
        }
      ]
    }
  ]
}
```

### Required Fields for Each Task

- **taskNumber**: Sequential numbering starting from **3** (since Tasks 0, 1, 2 already exist)
- **taskName**: Clear, descriptive name for the phase/task
- **status**: Always "not_started" initially
- **referenceDocuments**: Array of document paths with optional #section anchors
- **implementationNotes**: Brief guidance on approach, key decisions, or prerequisites
- **subtasks**: Optional breakdown of the task (use when task is complex)

### Important: Task Numbering
- **Task 0**: Input Validation & Implementation Planning (already exists)
- **Task 1**: Load Implementation Tasks (already exists - this task)
- **Task 2**: Project Setup (already exists)
- **Task 3+**: Implementation tasks (generated by this task)

### Guidelines for Task Generation

1. **Logical Sequencing**: Order tasks by dependencies (foundation before features)
2. **Appropriate Granularity**: Each task should be completable in a focused work session
3. **Clear Scope**: Task names should clearly indicate what will be built/configured
4. **Traceability**: Link back to requirements and design documents
5. **Testability**: Each task should have clear completion criteria
6. **Flexibility**: Don't over-specify - leave room for implementation decisions

## Step 5: Add Requirements Validation Task

Add a requirements validation task as the second-to-last task:

```json
{
  "taskNumber": "N-1",
  "taskName": "Requirements Validation",
  "status": "not_started",
  "referenceDocuments": [
    "requirements/functional-requirements.md",
    "user-stories/user-stories.md"
  ],
  "implementationNotes": "Ensure all requirements are implemented and traceable",
  "subtasks": [
    {
      "taskNumber": "N-1.1",
      "taskName": "Create requirements traceability matrix",
      "status": "not_started"
    },
    {
      "taskNumber": "N-1.2",
      "taskName": "Validate user story acceptance criteria",
      "status": "not_started"
    }
  ]
}
```

**Example**: If you generate Tasks 3, 4, 5, 6 for implementation, then Requirements Validation would be Task 7.

## Step 6: Add Test Planning Task

Add a test planning task as the final task:

```json
{
  "taskNumber": "N",
  "taskName": "Test Planning & Documentation",
  "status": "not_started",
  "referenceDocuments": [
    "requirements/functional-requirements.md"
  ],
  "implementationNotes": "Create test plan document - do NOT generate test code",
  "subtasks": [
    {
      "taskNumber": "N.1",
      "taskName": "Document test requirements for each feature",
      "status": "not_started"
    },
    {
      "taskNumber": "N.2",
      "taskName": "Create deployment handoff document",
      "status": "not_started"
    }
  ]
}
```

**Example**: If you generate Tasks 3, 4, 5, 6 for implementation and Task 7 for requirements validation, then Test Planning would be Task 8.

## Step 7: Validation & Completion

Before marking Task 1 complete:

1. **Verify Coverage**: Do your tasks cover all functional requirements?
2. **Check Dependencies**: Are tasks ordered correctly?
3. **Validate References**: Do all referenced documents exist?
4. **Review Scope**: Is the plan realistic for the project type (POC vs Production)?

## After Completion

Update `.workflow-state/code-handoff.md`:
- Mark Task 1 as "complete"
- **Change overall status from "ready" to "in-progress"** (this activates the workflow in the UI)
- Update lastUpdated timestamp
- Add note summarizing your analysis:
  - Number of tasks generated
  - Key implementation phases identified
  - Stack organization confirmed
  - Any concerns or risks noted

**Example completion:**
```json
{
  "status": "in-progress",
  "lastUpdated": "2025-10-15T15:30:00Z",
  "note": "Task 1 complete. Generated 6 implementation tasks based on analysis of 18 functional requirements. Layered stack organization confirmed by user. Ready to proceed to Task 2: Project Setup.",
  "taskDetails": [
    {
      "taskNumber": "1",
      "taskName": "Load Implementation Tasks",
      "status": "complete"
    },
    {
      "taskNumber": "2",
      "taskName": "Project Setup",
      "status": "not_started"
    }
  ]
}
```

## Troubleshooting

**If no specification package found:**
- Check project root for README.md with project overview
- Look for any design documents in alternate locations
- Ask user for specification package location

**If documents are incomplete:**
- Work with what's available
- Note gaps in implementationNotes
- Flag missing information for user clarification

**If implementation guidance is unclear:**
- Synthesize plan from requirements and architecture docs
- Use functional requirements as task breakdown guide
- Document assumptions in implementationNotes
