# Coding Agent Workflow - Requirements

## Purpose

Transform design specifications or user-provided project documents into deployed solutions through systematic implementation planning, quality validation, and code execution.

## Business Problem

Development teams face challenges when implementing projects:
- **Inconsistent Input Quality**: Projects start with varying levels of specification completeness
- **Missing Implementation Guidance**: Lack of clear implementation roadmaps from specifications
- **Quality Gate Bypass**: Teams proceed with insufficient documentation, causing implementation delays
- **Context Loss**: Implementation disconnected from original requirements and design decisions

## Solution Approach

### Dual-Path Implementation Workflow

The coding agent supports two execution paths based on input source:

**Path A: Design Agent Integration** (Primary Path - Always Takes Priority)
- Consume enterprise-grade specification packages from Design Agent workflow
- Leverage comprehensive requirements, architecture, and security documentation
- Execute implementation with full traceability to design decisions
- **Trigger**: `specification-package-iteration-*` directory exists

**Path B: Direct User Input** (Fallback Path)
- Accept user-provided project documents from `project-doc/` folder
- Validate input quality and completeness before proceeding
- Generate implementation plan from available documentation
- Ensure minimum quality thresholds are met
- **Trigger**: No Design Agent output AND `project-doc/` folder contains documents

## Key Capabilities

### Input Source Detection & Validation
- **Automatic Path Selection**: Detect Design Agent output vs user-provided documents
- **Quality Assessment**: Evaluate document completeness, clarity, and implementation readiness
- **Minimum Threshold Enforcement**: Prevent implementation with insufficient documentation
- **Gap Identification**: Clearly identify missing information and guide user to provide it

### Document Quality Framework
- **Completeness Assessment**: Verify presence of essential project information
- **Clarity Evaluation**: Ensure documents provide actionable implementation guidance
- **Technical Depth**: Validate sufficient technical detail for implementation decisions
- **Consistency Check**: Identify conflicts or inconsistencies in provided documentation

### Implementation Planning Engine
- **Adaptive Task Generation**: Create implementation plans based on available documentation quality
- **Reference Document Mapping**: Link implementation tasks to source documentation
- **Dependency Analysis**: Identify task dependencies and logical sequencing
- **Risk Assessment**: Flag potential implementation risks based on documentation gaps

### Quality Gate Enforcement
- **Pre-Implementation Validation**: Mandatory quality check before task execution
- **Escalation Triggers**: Clear criteria for when to request additional documentation
- **User Guidance**: Specific recommendations for improving input quality
- **Fallback Options**: Alternative approaches when full documentation unavailable

## Input Quality Standards

### Minimum Required Documentation (Path B)
- **Project Overview**: Clear description of project goals and scope
- **Functional Requirements**: What the system should do (minimum 5 requirements)
- **Technical Architecture**: High-level system design and technology choices
- **User Stories**: User perspective with acceptance criteria (minimum 3 stories)
- **Implementation Context**: Deployment target, constraints, and success criteria

### Quality Assessment Criteria
- **Completeness Score**: 0-100 based on presence of required documentation sections
- **Clarity Score**: 0-100 based on actionability and specificity of information
- **Technical Depth Score**: 0-100 based on sufficient detail for implementation decisions
- **Overall Readiness Score**: Weighted average with 70/100 minimum threshold

### Escalation Thresholds
- **Proceed**: Overall score ≥70/100 with no critical gaps
- **Conditional**: Score 50-69/100 with specific improvement recommendations
- **Block**: Score <50/100 with mandatory additional documentation required

## Enhanced Workflow Structure

### Stage 0: Input Source Detection & Validation
**Objective**: Determine input source and validate quality for implementation readiness

**Key Activities**:
- Detect presence of Design Agent specification package vs user documents
- Analyze document quality, completeness, and implementation readiness
- Generate quality assessment report with specific scores and recommendations
- Make proceed/conditional/block decision based on quality thresholds

**Quality Gates**:
- Input source correctly identified
- Quality assessment completed with numerical scores
- Clear proceed/block decision with justification
- User guidance provided for any identified gaps

### Stage 1: Implementation Planning (Enhanced)
**Objective**: Generate implementation plan adapted to available documentation quality

**Key Activities**:
- Analyze available documentation (Design Agent output OR user documents)
- Extract requirements, architecture, and implementation guidance
- Generate task breakdown with appropriate granularity based on documentation depth
- Map tasks to reference documents with gap identification

**Quality Gates**:
- Implementation plan covers all identifiable requirements
- Tasks appropriately scoped based on available documentation
- Reference document mapping complete
- Risk assessment completed for documentation gaps

### Stage 2: Project Setup & Implementation
**Objective**: Execute implementation plan with continuous reference to source documentation

**Key Activities**:
- Set up project structure based on architecture guidance
- Execute implementation tasks with traceability to requirements
- Adapt implementation approach based on documentation availability
- Maintain quality standards despite potential documentation limitations

**Quality Gates**:
- Project structure aligns with available architecture guidance
- Implementation maintains traceability to source requirements
- Quality standards maintained throughout execution
- Documentation gaps handled appropriately

## Success Criteria

### Process Outcomes
- **Accurate Input Assessment**: Input source and quality correctly identified and evaluated
- **Quality-Gated Execution**: Implementation only proceeds with sufficient documentation
- **Adaptive Implementation**: Implementation plan appropriately scaled to documentation quality
- **Traceability Maintenance**: Clear linkage between implementation and source documentation

### Quality Standards
- Input quality assessment completed with numerical scores and clear recommendations
- Implementation plan covers all identifiable requirements with appropriate task granularity
- Code implementation maintains traceability to source requirements and design decisions
- Quality standards maintained regardless of input source path

## When to Use Each Path

### Path A: Design Agent Integration
**Optimal Scenarios**:
- Enterprise projects requiring comprehensive specification development
- Security-critical systems needing integrated threat modeling
- Complex multi-stakeholder initiatives
- Projects where 90/100 quality standard is essential

### Path B: Direct User Input
**Optimal Scenarios**:
- Rapid prototyping with existing project documentation
- Migration of existing projects with available specifications
- Teams with established documentation practices
- Projects where Design Agent workflow overhead is not justified

## Input Validation Framework

### Document Analysis Engine
- **Content Extraction**: Parse and analyze user-provided documents
- **Structure Recognition**: Identify requirements, architecture, user stories
- **Gap Detection**: Identify missing critical information
- **Quality Scoring**: Generate numerical quality assessments

### Quality Assessment Matrix
| Category | Weight | Minimum Threshold | Description |
|----------|--------|------------------|-------------|
| **Project Overview** | 15% | 60/100 | Clear goals, scope, success criteria |
| **Functional Requirements** | 25% | 70/100 | Specific, testable requirements |
| **Technical Architecture** | 25% | 70/100 | System design, technology choices |
| **User Stories** | 20% | 60/100 | User perspective with acceptance criteria |
| **Implementation Context** | 15% | 50/100 | Deployment, constraints, environment |

### Escalation Triggers

**PAUSE AND Request Additional Documentation When**:
- Overall quality score <70/100
- Critical gaps in functional requirements or architecture
- Conflicting or contradictory information in provided documents
- Insufficient technical detail for implementation decisions
- Missing essential project context or success criteria

**Provide Specific Guidance For**:
- Which documents need improvement
- What specific information is missing
- How to structure requirements and architecture documentation
- Examples of sufficient documentation quality