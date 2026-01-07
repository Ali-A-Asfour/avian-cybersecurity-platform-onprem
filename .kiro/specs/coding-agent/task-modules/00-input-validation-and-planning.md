# Task 0: Input Validation & Implementation Planning

Detect input source, validate documentation quality, and generate implementation plan adapted to available information.

## Before Starting

Check `.workflow-state/code-handoff.md` to see if tasks are already loaded (look for tasks beyond Task 1 and Task 2). If tasks exist, skip this task.

## Step 1: Input Source Detection

Determine whether we're working with Design Agent output or user-provided documents:

### Check for Design Agent Output (Priority Check)
```bash
# Look for Design Agent specification package
DESIGN_AGENT_DIR=$(find . -type d -name "specification-package-iteration-*" -maxdepth 2 | head -1)

if [ -n "$DESIGN_AGENT_DIR" ]; then
    echo "Design Agent output detected: $DESIGN_AGENT_DIR"
    echo "PATH_SELECTION=design-agent"
    exit 0
fi
```

### Check for User-Provided Documents (Only if no Design Agent output)
```bash
# Only check if Design Agent output not found
if [ -z "$DESIGN_AGENT_DIR" ]; then
    # Check if project-doc folder exists
    if [ -d "project-doc" ]; then
        # Count documents in project-doc
        DOC_COUNT=$(find project-doc/ -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.docx" \) 2>/dev/null | wc -l)
        
        if [ "$DOC_COUNT" -gt 0 ]; then
            echo "User documents detected: $DOC_COUNT files in project-doc/"
            echo "PATH_SELECTION=user-documents"
        else
            echo "ERROR: project-doc folder exists but contains no documents"
            echo "PATH_SELECTION=error-no-content"
        fi
    else
        echo "ERROR: No input source found"
        echo "PATH_SELECTION=error-no-input"
    fi
fi
```

### Path Selection Logic
- **Path A (Design Agent)**: If `specification-package-iteration-*` directory exists (takes priority)
- **Path B (User Input)**: If `specification-package-iteration-*` does NOT exist AND `project-doc/` folder exists with content (minimum 1 document)
- **Error**: If neither path has sufficient input, escalate to user

## Step 2A: Design Agent Path Processing

If Design Agent output detected, follow existing logic:

### Discover Design Package
```bash
# Find the specification package directory
SPEC_DIR=$(find . -type d -name "specification-package-iteration-*" | head -1)

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

### Document Analysis Priority
1. **Implementation Guidance**: `supplement-material/integration-design.md`, `README.md`
2. **Requirements & Architecture**: `requirements/functional-requirements.md`, `architecture/system-architecture.md`
3. **Context & Constraints**: `supplement-material/gap-analysis.md`, `threat-model/README.md`

**Proceed to Step 3** with high-quality input.

## Step 2B: User Input Path Processing

If user documents detected, validate quality before proceeding:

### Document Discovery & Analysis
```bash
# Catalog all documents in project-doc
find project-doc/ -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.docx" \) -exec ls -lh {} \;

# Check for common document types
ls project-doc/*requirements* 2>/dev/null
ls project-doc/*architecture* 2>/dev/null
ls project-doc/*design* 2>/dev/null
```

### Quality Assessment Framework

Analyze each document and score across these dimensions:

#### 1. Project Overview Assessment (15% weight, 60/100 minimum)
**Look for**:
- Clear project goals and objectives
- Defined scope and boundaries
- Success criteria and metrics
- Stakeholder identification

**Scoring**:
- 90-100: Comprehensive overview with clear goals, scope, and success criteria
- 70-89: Good overview with most elements present
- 50-69: Basic overview with some missing elements
- 30-49: Minimal overview, lacks clarity
- 0-29: No clear project overview

#### 2. Functional Requirements Assessment (25% weight, 70/100 minimum)
**Look for**:
- Specific, testable requirements (minimum 5)
- Clear acceptance criteria
- Requirements traceability
- Priority/importance indicators

**Scoring**:
- 90-100: 10+ detailed requirements with clear acceptance criteria
- 70-89: 5-9 well-defined requirements with acceptance criteria
- 50-69: 3-4 basic requirements, some acceptance criteria
- 30-49: 1-2 vague requirements, minimal criteria
- 0-29: No clear functional requirements

#### 3. Technical Architecture Assessment (25% weight, 70/100 minimum)
**Look for**:
- System architecture overview
- Technology stack decisions
- Component interactions
- Integration patterns

**Scoring**:
- 90-100: Detailed architecture with components, tech stack, and integration
- 70-89: Good architecture overview with key components identified
- 50-69: Basic architecture, some technology choices
- 30-49: Minimal architecture information
- 0-29: No architecture guidance

#### 4. User Stories Assessment (20% weight, 60/100 minimum)
**Look for**:
- User stories in proper format (As a... I want... So that...)
- Acceptance criteria for each story
- User personas or roles
- Story prioritization

**Scoring**:
- 90-100: 5+ detailed user stories with acceptance criteria
- 70-89: 3-4 well-formed user stories
- 50-69: 2-3 basic user stories
- 30-49: 1-2 incomplete user stories
- 0-29: No user stories

#### 5. Implementation Context Assessment (15% weight, 50/100 minimum)
**Look for**:
- Deployment environment details
- Technical constraints
- Performance requirements
- Security considerations

**Scoring**:
- 90-100: Comprehensive context with deployment, constraints, and requirements
- 70-89: Good context with most elements present
- 50-69: Basic context information
- 30-49: Minimal context
- 0-29: No implementation context

### Quality Calculation & Decision

```
Overall Score = (Project Overview × 0.15) + (Functional Requirements × 0.25) + 
                (Technical Architecture × 0.25) + (User Stories × 0.20) + 
                (Implementation Context × 0.15)
```

**Decision Matrix**:
- **Proceed** (Score ≥70/100): Generate implementation plan and continue
- **Conditional** (Score 50-69/100): Generate plan with warnings and recommendations
- **Block** (Score <50/100): Stop execution and request additional documentation

### Quality Assessment Report

Generate a detailed report in `.workflow-state/input-quality-assessment.md`:

```markdown
# Input Quality Assessment Report

**Assessment Date**: [Date]
**Input Source**: User-provided documents in project-doc/
**Overall Score**: [Score]/100
**Decision**: [Proceed/Conditional/Block]

## Document Analysis

### Documents Analyzed
- [List all documents with file sizes and types]

## Quality Scores

| Category | Weight | Score | Weighted Score | Status |
|----------|--------|-------|----------------|--------|
| Project Overview | 15% | [score]/100 | [weighted] | ✅/⚠️/❌ |
| Functional Requirements | 25% | [score]/100 | [weighted] | ✅/⚠️/❌ |
| Technical Architecture | 25% | [score]/100 | [weighted] | ✅/⚠️/❌ |
| User Stories | 20% | [score]/100 | [weighted] | ✅/⚠️/❌ |
| Implementation Context | 15% | [score]/100 | [weighted] | ✅/⚠️/❌ |

**Overall Score**: [total]/100

## Detailed Findings

### Strengths
- [List what was well documented]

### Gaps Identified
- [List missing or insufficient information]

### Recommendations
- [Specific guidance for improving documentation]

## Implementation Impact

### Risks
- [Potential implementation risks due to documentation gaps]

### Mitigation Strategies
- [How implementation will adapt to documentation limitations]
```

### Escalation Logic

**If Score <50/100 (Block Decision)**:
```
STOP EXECUTION

Provide user with:
1. Quality assessment report
2. Specific list of missing documentation
3. Examples of sufficient documentation
4. Recommendation to use Design Agent workflow for comprehensive specifications
```

**If Score 50-69/100 (Conditional Decision)**:
```
PROCEED WITH WARNINGS

Inform user:
1. Implementation will proceed with limitations
2. Specific areas where documentation is insufficient
3. How implementation will adapt to gaps
4. Recommendation to improve documentation for better results
```

**If Score ≥70/100 (Proceed Decision)**:
```
PROCEED NORMALLY

Continue to Step 3 with user documents as reference
```

## Step 3: Stack Organization Proposal

**ALWAYS propose and confirm stack organization with user.**

### Process

1. **Analyze Architecture**
   - Read architecture documents
   - Identify AWS services and resources
   - Understand component relationships
   - Assess complexity (number of services, resources, integrations)

2. **Generate Proposal**
   Present to user:
   
   ```
   Based on your architecture, I recommend organizing as:
   
   **Layered Approach** (Recommended):
   - Governance Stack (IAM roles, KMS keys, VPC if needed)
   - Data Stack (DynamoDB tables, S3 buckets, RDS instances)
   - Compute Stack (Lambda functions, ECS services, Fargate tasks)
   - API Stack (API Gateway, routes, integrations)
   - Operations Stack (CloudWatch dashboards, alarms, logs)
   
   **Rationale**: 
   - Clear dependencies: Data → Compute → API → Operations
   - Easier to manage and deploy incrementally
   - Standard AWS best practice
   - Each stack has 10-50 resources (optimal size)
   
   **Stack Dependencies**:
   ```
   Governance (no dependencies)
     ↓
   Data (depends on Governance for IAM/KMS)
     ↓
   Compute (depends on Governance, Data)
     ↓
   API (depends on Compute)
     ↓
   Operations (depends on all)
   ```
   
   **Alternative Options**:
   - Service-based: Separate stack per microservice
   - Feature-based: Separate stack per feature
   - Custom organization: You specify the structure
   
   **For Complex Systems**:
   If this is part of a larger system, consider:
   - Creating separate projects for each major service
   - Reusing shared infrastructure across projects
   - Using CDK cross-stack references
   
   Do you want to proceed with the layered approach, or would you 
   prefer a different organization?
   ```

3. **Wait for Confirmation**
   - User can accept recommended approach
   - User can request alternative organization
   - User can specify custom structure

4. **Document Decision**
   - Record confirmed approach in code-handoff.md
   - Document rationale
   - Note any custom requirements

5. **Proceed with Implementation**
   - Generate tasks based on confirmed structure
   - Map design documents to tasks
   - Create implementation plan

### Why Always Ask?

This aligns with "build WITH you" philosophy:
- ✅ Transparency: User sees the plan before implementation
- ✅ Flexibility: User can override if they have specific needs
- ✅ Education: User learns why layered is recommended
- ✅ Collaboration: User is part of the decision

## Step 4: Check for Architecture Decision Records (ADRs)

### Process

1. **Check if ADRs exist**
   ```bash
   find . -type d -name "adrs" -o -name "decisions" -maxdepth 3
   ```

2. **If ADRs exist, scan titles/summaries**
   - List all ADR files
   - Read titles and summaries only

3. **Read ONLY if implementation-relevant**
   - "Stack Organization Strategy"
   - "Multi-Stack vs Monolithic"
   - "Deployment Sequence"
   - "Technology Selection" (if affects IaC)

4. **Skip business/architecture rationale ADRs**
   - Most ADR content is already in architecture.md
   - Focus on implementation decisions only

### Rationale

- ADRs often contain historical context not needed for implementation
- Most relevant content is already in architecture.md
- Selective reading saves time and reduces noise

## Step 5: Check for Blueprint Integration

### Process

1. **Check for supplement-material/ directory**
   ```bash
   find . -type d -name "supplement-material" -maxdepth 2
   ```

2. **If gap-analysis.md exists → Blueprint-based project**
   - Read `supplement-material/gap-analysis.md`
   - Read `supplement-material/integration-design.md`
   - Determine approach from integration-design.md:
     * "Copy & Customize" OR
     * "Reference & Configure"

3. **If gap-analysis.md does NOT exist → Greenfield project**
   - Build everything from scratch
   - Use standard layered approach

### Blueprint Project Task Breakdown

If blueprint detected:

**Task 2: Blueprint Integration**
- IF "Copy & Customize":
  * Copy blueprint source code to project
  * Apply customizations per integration-design.md
  * Treat as editable codebase
- IF "Reference & Configure":
  * Import blueprint as package/dependency
  * Configure via parameters/config files
  * Treat as external library

**Task 3: Custom Extensions**
- Build CRITICAL gaps from gap-analysis.md
- These are features NOT in blueprint
- Output to: `generated/build/infrastructure/extensions/`

**Task 4: Integration Layer**
- Wire blueprint + custom extensions together
- Output to: `generated/build/infrastructure/integration/`

### Greenfield Project Task Breakdown

If no blueprint:

**Task 2-6: Standard Layered Implementation**
- Task 2: Governance Stack
- Task 3: Data Stack
- Task 4: Compute Stack
- Task 5: API Stack
- Task 6: Operations Stack

## Step 6: Implementation Plan Generation

Based on the input source and quality, generate an appropriate implementation plan:

### For Path A (Design Agent) - High Quality Input
Generate comprehensive implementation plan following existing logic:

1. **Implementation Phases**: Foundation → Core Features → Integration → Testing
2. **Task Breakdown**: Detailed tasks with clear scope and dependencies
3. **Reference Mapping**: Link to specific design documents and sections
4. **Implementation Notes**: Detailed guidance from design specifications

### For Path B (User Input) - Variable Quality Input
Generate adaptive implementation plan based on documentation quality:

#### High Quality User Input (Score ≥80/100)
- Generate detailed implementation plan similar to Design Agent path
- Create comprehensive task breakdown with clear dependencies
- Map tasks to specific sections in user documents
- Include detailed implementation notes

#### Medium Quality User Input (Score 70-79/100)
- Generate moderate implementation plan with broader task scope
- Group related functionality into larger tasks
- Map tasks to available documentation with gap notes
- Include implementation notes with assumptions documented

#### Conditional Quality User Input (Score 50-69/100)
- Generate basic implementation plan with minimal task breakdown
- Focus on core functionality that is well-documented
- Include extensive gap notes and assumptions
- Add tasks for clarifying requirements during implementation

### Task Structure Template

```json
{
  "taskDetails": [
    {
      "taskNumber": "1",
      "taskName": "Project Setup",
      "status": "not_started",
      "referenceDocuments": [
        "project-doc/architecture.md#deployment",
        "project-doc/requirements.md#environment"
      ],
      "implementationNotes": "Set up project structure based on available architecture guidance",
      "qualityNotes": "Limited deployment details - implement basic structure",
      "assumptions": ["Assuming standard web application structure", "Using default security practices"],
      "risks": ["May need architecture refinement during implementation"]
    }
  ]
}
```

### Additional Fields for Path B
- **qualityNotes**: Document limitations in available information
- **assumptions**: List assumptions made due to documentation gaps
- **risks**: Identify potential implementation risks

## Step 4: Populate code-handoff.md

Update `.workflow-state/code-handoff.md` with the generated implementation plan:

### Enhanced Metadata
```json
{
  "inputSource": "design-agent" | "user-documents",
  "qualityScore": 85, // Only for user-documents path
  "qualityDecision": "proceed" | "conditional" | "block", // Only for user-documents
  "documentationGaps": ["list", "of", "identified", "gaps"], // Only for user-documents
  "assumptions": ["list", "of", "assumptions"], // Only for user-documents
  "status": "ready",
  "lastUpdated": "2025-01-13T10:30:00Z",
  "taskDetails": [...]
}
```

## Step 5: Validation & Completion

### For Path A (Design Agent)
- Verify coverage of all functional requirements
- Check task dependencies and sequencing
- Validate reference document paths
- Ensure realistic scope for project type

### For Path B (User Input)
- Verify implementation plan matches documentation quality
- Ensure assumptions are clearly documented
- Validate that risks are identified and mitigated
- Confirm plan is executable with available information

## After Completion

Update `.workflow-state/code-handoff.md`:
- Mark Task 0 as "complete"
- Change overall status from "ready" to "in-progress"
- Update lastUpdated timestamp
- Add completion note with path taken and key decisions

**Path A Example**:
```json
{
  "status": "in-progress",
  "lastUpdated": "2025-01-13T15:30:00Z",
  "note": "Task 0 complete. Design Agent path detected. Generated 6 implementation tasks based on comprehensive specification package with 18 functional requirements.",
  "inputSource": "design-agent"
}
```

**Path B Example**:
```json
{
  "status": "in-progress", 
  "lastUpdated": "2025-01-13T15:30:00Z",
  "note": "Task 0 complete. User documents path with quality score 75/100. Generated 4 implementation tasks with documented assumptions for architecture gaps.",
  "inputSource": "user-documents",
  "qualityScore": 75,
  "qualityDecision": "proceed"
}
```

## Troubleshooting

### No Input Source Found
```
ERROR: No valid input source detected

CASE 1: No Design Agent output AND no project-doc folder
- No specification-package-iteration-* directory found
- No project-doc/ folder found

CASE 2: No Design Agent output AND empty project-doc folder  
- No specification-package-iteration-* directory found
- project-doc/ folder exists but contains no documents

Please either:
1. Run Design Agent workflow first to generate comprehensive specifications
2. Place project documents in project-doc/ folder with at least one document

Required for user documents path:
- Project overview/requirements document
- Basic architecture or design information  
- At least 3 user stories or functional requirements

Note: Design Agent output takes priority - if specification-package-iteration-* exists, 
user documents in project-doc/ will be ignored.
```

### Quality Score Too Low
```
BLOCKED: Documentation quality insufficient for implementation

Quality Score: [score]/100 (Minimum: 50/100)

Critical gaps identified:
- [List specific missing information]

Recommendations:
1. Add detailed functional requirements with acceptance criteria
2. Provide system architecture overview with technology choices
3. Include user stories with clear acceptance criteria
4. Specify deployment environment and constraints

Consider using Design Agent workflow for comprehensive specification development.
```

### Conflicting Information
```
WARNING: Conflicting information detected in documents

Conflicts found:
- [List specific conflicts]

Resolution required before proceeding:
1. Review conflicting sections
2. Provide clarification or updated documentation
3. Remove or update conflicting information
```