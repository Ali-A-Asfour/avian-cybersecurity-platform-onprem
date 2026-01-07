# Coding Agent - Design Document

## Architecture Overview

This workflow implements a dual-path implementation system that transforms either Design Agent specification packages or user-provided project documents into deployed solutions through systematic input validation, implementation planning, and code execution.

## Dual-Path Architecture

### Path A: Design Agent Integration (Primary Path - Takes Priority)
**Input Source**: Enterprise-grade specification packages from Design Agent workflow
**Trigger Condition**: `specification-package-iteration-*` directory exists

**Reference Files**:
- `architecture/system-architecture.md`
- `architecture/component-specifications.md`
- `architecture/deployment-architecture.md`
- `architecture/architecture-decision-records/*.md`
- `requirements/` folder contents
- `supplement-material/non-functional-requirements.md`
- `threat-model/threat-analysis.md`
- `threat-model/security-controls.md`
- `threat-model/implementation-guidance.md`
- `executive-summary.md`

### Path B: Direct User Input (Fallback Path)
**Input Source**: User-provided documents in `project-doc/` folder
**Trigger Condition**: `specification-package-iteration-*` does NOT exist AND `project-doc/` folder contains at least one document

**Expected Document Types**:
- Project overview and requirements documents
- Architecture and design specifications
- User stories and acceptance criteria
- Technical constraints and deployment guidance
- Any existing project documentation

**Priority Logic**: Design Agent output always takes priority. If both exist, Path A is used and `project-doc/` contents are ignored.

## Enhanced Coding Agent Workflow

### Task Modules
Implementation instructions are organized in enhanced task modules:
- `task-modules/00-input-validation-and-planning.md` - Input source detection, quality validation, and implementation planning
- `task-modules/01-project-setup.md` - Project structure and blueprint setup
- `task-modules/02-implementation.md` - Execute implementation tasks

### Coding Standards
Implementation patterns and standards are defined in steering files:
- `.kiro/steering/coding-agent/coding-standards.md` - Code quality, patterns, and best practices

### Progress Tracking
- `.workflow-state/code-handoff.md` - Current workflow state and task progress

## Input Validation Framework

### Document Quality Assessment Engine
**Purpose**: Evaluate user-provided documents for implementation readiness

**Key Components**:
- **Content Analyzer**: Extracts and categorizes information from project documents
- **Quality Scorer**: Generates numerical quality assessments across multiple dimensions
- **Gap Detector**: Identifies missing critical information for implementation
- **Recommendation Generator**: Provides specific guidance for improving documentation

### Quality Assessment Matrix

| Category | Weight | Minimum Threshold | Assessment Criteria |
|----------|--------|------------------|-------------------|
| **Project Overview** | 15% | 60/100 | Goals, scope, success criteria clarity |
| **Functional Requirements** | 25% | 70/100 | Specific, testable, complete requirements |
| **Technical Architecture** | 25% | 70/100 | System design, technology stack, integration |
| **User Stories** | 20% | 60/100 | User perspective, acceptance criteria |
| **Implementation Context** | 15% | 50/100 | Deployment, constraints, environment |

**Overall Threshold**: 70/100 minimum for implementation to proceed

### Decision Framework
- **Proceed**: Score ≥70/100 with no critical gaps
- **Conditional**: Score 50-69/100 with improvement recommendations
- **Block**: Score <50/100 with mandatory additional documentation required

## Reference Documents System

Each task in code-handoff.md includes a `referenceDocuments` array that points to relevant source documents:

**Path A Example** (Design Agent):
```json
{
  "taskNumber": "2",
  "taskName": "S3 Integration",
  "referenceDocuments": [
    "requirements/functional-requirements.md#FR-003",
    "integration-design.md#s3-component"
  ],
  "implementationNotes": "Implement S3 MCP tools..."
}
```

**Path B Example** (User Input):
```json
{
  "taskNumber": "2",
  "taskName": "User Authentication",
  "referenceDocuments": [
    "project-doc/requirements.md#authentication",
    "project-doc/architecture.md#auth-flow"
  ],
  "implementationNotes": "Implement authentication based on user requirements",
  "qualityNotes": "Limited architecture detail - implement basic approach"
}
```

**IMPORTANT**: Always read the reference documents for a task BEFORE implementing it. These documents contain:
- Requirements (WHAT to build)
- Design specifications (HOW to build it)
- Acceptance criteria (WHEN it's done)
- Integration details (HOW it connects)

If you're unsure about any aspect of a task, the answer is in the reference documents.



## Escalation Triggers

**PAUSE AND Request Additional Documentation When**:
- Overall quality score <50/100 for user documents
- Critical gaps in functional requirements or architecture
- Conflicting or contradictory information in provided documents
- Insufficient technical detail for implementation decisions
- Missing essential project context or success criteria