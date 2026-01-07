# Design Agent Workflow - Design Document

## Architecture Overview

This workflow implements an orchestrated process with modular task architecture that transforms project documents into enterprise-grade specification packages through systematic progression across multiple stages.

Each stage has focused objectives and clear quality gates, progressing from initial session management through requirements generation, dual-path architecture design, holistic quality assessment, comprehensive security evaluation, and final output organization.

## Modular Task Architecture

The workflow is organized into focused, modular task files for better organization and clarity:

- **Stage 0: Session Management Module** - Execution modes, handoff protocols, and session recovery
- **Stage 1: Project Analysis Module** - Project complexity assessment and workflow recommendations  
- **Stage 2: Requirements Generation Module** - Input assessment and requirements package generation
- **Stage 3: Architecture Generation Module** - Dual-path architecture design with Intelligence Hub integration
- **Stage 4: Holistic Quality Assessment Module** - Comprehensive quality evaluation and iterative improvement
- **Stage 5: Security Assessment Module** - Threat modeling and security controls integration
- **Stage 6: Documentation Generation Module** - MCP prescriptive guidance and executive summary generation
- **Stage 7: Output Organization Module** - Project folder structure and deliverable organization requirements

## Enhanced Project Input System Architecture

### Input Category Framework

The input system processes project materials in two distinct phases to maintain proper separation between requirements and architecture concerns.

## Requirements Generation Phase (Stage 2)

Processes three categories of project materials to establish pure business-driven requirements:

#### Category 1: Project Context (`project-doc/project-context/`)
**Purpose**: Project-specific requirements, business context, and stakeholder needs
**Processing Logic**:
- Extract core business objectives and functional requirements
- Identify user personas, workflows, and success criteria
- Document project-specific constraints and technical preferences
- Generate primary functional and non-functional requirements
**Output**: Core project requirements that define "what we're building"

#### Category 2: Technical Knowledge (`project-doc/technical-knowledge/`)
**Purpose**: External reference materials and integration specifications
**Processing Logic**:
- Analyze external API documentation without treating as build targets
- Extract integration patterns, data formats, and authentication requirements
- Identify service limits, rate limits, and compatibility constraints
- Document how external systems influence architecture decisions
**Output**: Integration requirements that define "what we're integrating with"

#### Category 3: Organization Context (`project-doc/organization-context/`)
**Purpose**: Company policies, standards, and organizational constraints
**Processing Logic**:
- Extract naming conventions, tagging strategies, and resource patterns
- Apply security policies, compliance requirements, and budget constraints
- Enforce organizational standards across all architecture decisions
- Validate against company-specific requirements (MAP credits, cost allocation)
**Output**: Organizational constraints that define "how we must build"

## Architecture Generation Phase (Stage 3)

Incorporates reference system analysis to inform architecture decisions:

#### Project Code Analysis (from Stage 1 output)
**Purpose**: Existing codebases and reference system analysis
**Processing Logic**:
- Use comprehensive codebase analysis from Stage 1 (stored in `.workflow-state/reference-architectures/`)
- Identify reusable components and integration opportunities
- Document existing system dependencies and integration requirements
- Generate integration strategies and compatibility requirements
**Output**: Reference system considerations that inform "how we can leverage existing assets"

### Context Separation Engine

**Classification Logic**:
- Folder-based automatic categorization prevents content misinterpretation
- Clear boundaries between project scope and external dependencies
- Organizational constraints applied consistently across all decisions
- Reference system analysis separated from requirements generation

**Traceability Framework**:
- Requirements linked to specific input categories and source documents (project-context, technical-knowledge, organization-context only)
- Architecture decisions traced to requirements plus reference system analysis
- Compliance documentation showing organizational policy application
- Integration specifications clearly separated from build requirements

### Processing Workflow Integration

**Stage 0-1 Integration**: Input discovery, categorization, and project-code analysis during session management and project analysis
**Stage 2 Integration**: Three-category processing during requirements generation (project-context, technical-knowledge, organization-context)
**Stage 3 Integration**: Requirements-driven architecture generation informed by reference system analysis from Stage 1
**Stage 4-7 Integration**: Category-specific validation during quality assessment and final documentation

## Stage Architecture

### Stage 0: Session Management
**Objective**: Establish workflow context and execution mode

**Key Activities**:
- Execution mode detection (new session, continuation, recovery)
- Customer context capture (project goals, technical preferences, organizational context)
- Workflow state initialization (`.workflow-state/design-handoff.md`, `.workflow-state/customer-context.md`)
- Context source establishment (project-doc folder, customer context, current prompt)

**Quality Gates**:
- Customer context captured and documented
- Workflow state files initialized
- Context sources identified and accessible
- Execution mode determined

### Stage 1: Project Analysis
**Objective**: Assess project complexity and provide workflow recommendations

**Key Activities**:
- Input source assessment (existing documents vs scratch vs mixed)
- Document analysis (count, size, types)
- Complexity categorization (Simple/Moderate/Complex/Enterprise)
- Time estimation and workflow recommendations
- Session management strategy guidance

**Quality Gates**:
- Input scenario determined
- Clear complexity categorization documented
- Workflow recommendations provided
- Session strategy defined

### Stage 2: Requirements Generation
**Objective**: Transform project inputs into structured requirements packages based purely on business needs, integration requirements, and organizational constraints

**Three-Category Input Processing Architecture**:

**Requirements-Focused Input Analysis**:
- **project-context/**: Project-specific requirements, business context, and stakeholder needs
- **technical-knowledge/**: External reference materials, API documentation, and integration specifications
- **organization-context/**: Company policies, standards, compliance requirements, and organizational constraints

**Context Classification Engine**:
- Automatic categorization of input materials by folder structure
- Clear separation between "what we're building" vs "what we're integrating with" vs "organizational constraints" 
- Prevention of misinterpretation of external references as project build targets
- Traceability matrix linking requirements to specific input categories and source documents
- **No influence from existing code patterns** - requirements driven purely by business needs

**Category-Specific Processing Logic**:

**Project Context Processing**:
- Extract business objectives, functional requirements, and user stories
- Identify stakeholder needs and success criteria
- Document project-specific constraints and preferences
- Generate core functional and non-functional requirements

**Technical Knowledge Processing**:
- Analyze external API documentation to extract integration requirements
- Identify service limits, rate limits, and technical constraints from external systems
- Document authentication patterns, data formats, and compatibility requirements
- Generate integration specifications without treating external systems as build targets

**Organization Context Processing**:
- Extract naming conventions, tagging strategies, and resource organization patterns
- Apply AWS resource tagging requirements for cost allocation and MAP credits
- Enforce security policies, encryption standards, and access control patterns
- Validate budget limits and cost optimization requirements
- Generate organizational compliance requirements and policy constraints

**Components Generated**:
- Three-category input assessment analysis with context separation
- Project requirements documentation (functional, non-functional) from project-context
- Integration requirements specification from technical-knowledge analysis
- Organizational compliance requirements from organization-context processing
- Category-specific traceability matrices linking requirements to input sources
- Gap analysis with category-specific missing information identification
- Generation readiness assessment across the three requirements categories

**Quality Gates**:
- All requirements traceable to specific input categories and source documents
- Clear separation maintained between project requirements and external integration needs
- Organizational policies and standards properly extracted and applied as constraints
- Requirements driven purely by business needs without existing code bias
- Complete requirements package structure with category-specific organization
- Basic completeness validation across the three requirements categories

### Stage 3: Architecture Generation
**Objective**: Generate comprehensive architecture design based on stable requirements using dual-path approach

**Dual-Path Architecture**:

**Task 3.1: Intelligence Hub Availability Assessment**
- Check MCP configuration for Intelligence Hub server
- Verify connection and availability
- Document path selection (A or B) in workflow state
- Set execution parameters

**Task 3.2: Architecture Generation Execution**

**Path A: Intelligence Hub Integration** (when available)
- Present deep research decision to user (standard 15 min vs deep 60 min)
- Submit job with requirements and deep research flag
- Monitor status (SUBMITTED → PROCESSING → EXPERT_COMPLETED → COMPLETED)
- Retrieve and save complete JSON response to `architecture/intelligence-hub-response.md`
- Integrate expert insights and asset rankings (60% threshold for technology shortlisting)

**Path B: Standard Architecture Generation** (when Intelligence Hub is unavailable)
- Load customer context from `.workflow-state/customer-context.md`
- Apply architecture guidance selection framework with organizational constraints from organization-context
- Extract and document repository links from technical-knowledge materials
- Download external reference architectures to `.workflow-state/reference-architectures/`
- **Integrate multi-category requirements**: project-context (core requirements), technical-knowledge (integration needs), organization-context (policy constraints), project-code (legacy considerations)
- **Perform comprehensive gap analysis**: existing systems + external references + organizational policies vs. project requirements
- **Apply organizational standards**: naming conventions, tagging strategies, security policies from organization-context throughout architecture design

**Task 3.3: Common Architecture Activities** (path convergence)
- Design system architecture incorporating requirements and reference analysis:
  - Core components from project-context requirements
  - Integration patterns and external system interfaces from technical-knowledge
  - Organizational compliance (naming, tagging, security) from organization-context
  - Reference system integration opportunities from Stage 1 project-code analysis
- Create Architecture Decision Records (ADRs) documenting requirements influence and reference system considerations
- Document technical specifications with clear traceability to requirements and reference analysis
- Apply organizational policies consistently across all architecture components
- Balance new requirements with existing system integration opportunities

**Task 3.4: Architecture Integration Validation**
- Requirements coverage analysis (95%+ threshold)
- Component integration validation (interface compatibility, data flow)
- **Service Limits Impact Assessment**:
  - Extract AWS service inventory from architecture
  - Research current service limits using AWS documentation
  - Perform usage estimation for POC and production scenarios
  - Identify high-risk limits and document mitigation strategies
  - Plan service limit increase requests where needed
- Technical feasibility assessment
- Documentation completeness review
- Generate validation score (≥85/100 required)
- Output: `supplement-material/architecture-integration-validation.md`

**Components Generated**:
- System architecture with multi-category component specifications:
  - Core system components addressing project-context requirements
  - Integration interfaces for technical-knowledge external systems
  - Organizational compliance implementations (tagging, naming, security)
  - Reference system integration components
- Architecture decision records with category-specific influence traceability
- Technical specifications with clear input category source documentation
- Implementation planning incorporating organizational standards and reference system constraints
- Intelligence Hub response (Path A) or comprehensive multi-category reference analysis (Path B)
- Gap analysis covering project requirements, external integrations, organizational policies, and reference systems
- Architecture integration validation report with service limits and compliance assessment

**Quality Gates**:
- Complete architecture design documented
- Requirements coverage validated (95%+)
- Service limits assessed and mitigation strategies documented
- Architecture integration validation score ≥85/100
- All ADRs complete with rationale

### Stage 4: Holistic Quality Assessment
**Objective**: Achieve 90/100 quality score through systematic holistic improvement

**Output Organization**: All outputs organized in single project folder with structured layout:
```
generated/design/
├── specification-package-iteration-1/  (original generated package)
├── specification-package-iteration-2/  (first improved package)
├── specification-package-iteration-3/  (second improved package, if needed)
├── score-sheet-iteration-1.md         (initial assessment)
├── score-sheet-iteration-2.md         (second iteration scoring)
├── score-sheet-iteration-3.md         (third iteration scoring, if needed)
├── threat-model/                       (comprehensive security assessment)
└── supplement-material/                (input analysis and supporting docs)
    ├── input-assessment-analysis.md
    ├── mcp-prescriptive-guidance.md
    └── [other supporting documents]
```

**Deferred Quality Strategy**:
- Requirements and architecture generated first (Stages 1-2)
- Holistic optimization of both domains together
- Cross-domain improvements for better outcomes
- Reduced context switching and improved efficiency

**Enhanced Quality Framework**:
- **Requirements Analysis** (25%): Completeness across all four input categories, clarity, category-specific traceability
- **Architecture & Design** (25%): Patterns, components, multi-category integration, organizational compliance
- **Security & Compliance** (20%): Controls, standards, risk management, organizational policy adherence
- **Implementation & Operations** (15%): Development strategy, operational excellence, reference system integration
- **Business Value & Risk** (15%): Value proposition, risk assessment, organizational alignment

**Iteration Rules**:
- Modified files get "-improved" suffix
- Unchanged files copied from previous iteration
- Continue until 90/100 score achieved (max 5 iterations)
- Each iteration produces complete specification package

### Stage 5: Security Assessment
**Objective**: Integrate comprehensive security assessment

**Security Framework**:
- AWS threat modeling template structure
- STRIDE-based threat identification
- Baseline Security Controls (BSC) mapping
- Security testing framework with test cases
- Threat actor profiles and anti-patterns

**Quality Gates**:
- Complete threat model with STRIDE analysis
- Security controls mapped to all identified threats
- Security testing framework with concrete test cases
- Implementation guidance provided

### Stage 6: Documentation Generation
**Objective**: Generate prescriptive guidance and executive summaries

**Key Activities**:
- Tools prescriptive guidance generation with comprehensive MCP servers and Skills inventory
- Project-specific MCP and Skills recommendations with usage patterns
- Executive summary creation synthesizing final specification package
- Stakeholder communication materials and implementation readiness assessment

**Components Generated**:
- MCP prescriptive guidance document in supplement material
- Executive summary at project root level
- Implementation guidance and recommendations
- Stakeholder communication materials

**Quality Gates**:
- Complete MCP server inventory and recommendations
- Comprehensive executive summary reflecting final quality scores
- Clear implementation guidance and next steps
- Professional stakeholder communication materials

### Stage 7: Output Organization
**Objective**: Validate folder structure and prepare final handoff

**Key Activities**:
- Project structure initialization and validation
- Iterative content management (iteration folders, score sheets)
- Specialized content organization (threat model, supplement material)
- Final handoff preparation with executive summary

**Output Structure Validation**:
```
generated/design/
├── specification-package-iteration-1/
├── specification-package-iteration-X/
├── score-sheet-iteration-1.md
├── score-sheet-iteration-X.md
├── executive-summary.md
├── threat-model/
│   ├── threat-analysis.md
│   ├── security-controls.md
│   ├── testing-framework.md
│   └── implementation-guidance.md
└── supplement-material/
    ├── input-assessment-analysis.md
    ├── gap-analysis.md (if applicable)
    ├── integration-design.md (if applicable)
    └── architecture-integration-validation.md
```

**Quality Gates**:
- Folder structure matches defined requirements
- All required files and folders present
- File naming conventions followed
- Executive summary complete
- Handoff documentation ready

## Problem-Solution Mapping

### 1. Context Loss → Session Management
**Problem**: Workflow context lost between sessions or execution modes
**Solution**: Dedicated session management stage with customer context capture and workflow state initialization

### 2. Incomplete Requirements → Systematic Requirements Generation
**Problem**: Teams proceed with poorly structured requirements and lack understanding of existing systems
**Solution**: Dedicated requirements generation stage with comprehensive input assessment, brownfield codebase analysis, and traceability matrix

### 3. Poor Architecture Quality → Dual-Path Architecture Design
**Problem**: Architecture decisions lack rationale and technical depth
**Solution**: Dual-path architecture generation with Intelligence Hub integration (Path A) or systematic standard generation (Path B), both with comprehensive validation

### 4. Service Limits Risks → Proactive Service Limits Assessment
**Problem**: Implementation failures due to AWS service quota constraints
**Solution**: Comprehensive service limits impact assessment in architecture validation with mitigation strategies

### 5. Fragmented Quality Assessment → Holistic Quality Optimization
**Problem**: Requirements and architecture optimized in isolation leading to suboptimal outcomes
**Solution**: Deferred quality assessment optimizing requirements and architecture together

### 6. Security Gaps → Integrated Threat Modeling
**Problem**: Security added as afterthought
**Solution**: AWS-compliant threat modeling with STRIDE methodology and actionable mitigations

### 7. Disorganized Deliverables → Structured Output Organization
**Problem**: Scattered files and inconsistent organization
**Solution**: Dedicated output organization stage with validated folder structure and handoff preparation

### 8. Complex Navigation → Modular Task Architecture
**Problem**: Large monolithic task files difficult to navigate and maintain
**Solution**: Focused task modules with clear organization and easy navigation

### 9. Reference System Integration → Brownfield Analysis Framework
**Problem**: Existing codebases and reference systems not properly analyzed for integration
**Solution**: Comprehensive brownfield analysis methodology with codebase assessment and integration evaluation

### 10. External Reference Misinterpretation → Context Classification Engine
**Problem**: External API documentation and reference materials misinterpreted as project build targets
**Solution**: Four-category input system with automatic classification preventing confusion between "what we're building" vs "what we're integrating with"

### 11. Inconsistent Organizational Standards → Policy-Driven Architecture
**Problem**: Organizational policies and standards inconsistently applied across projects
**Solution**: Organization-context processing that automatically applies naming conventions, tagging strategies, security policies, and compliance requirements

### 12. Context Mixing and Confusion → Multi-Category Input Framework
**Problem**: Project requirements, external integrations, organizational constraints, and reference system considerations mixed together causing specification confusion
**Solution**: Structured four-folder input system with category-specific processing logic and clear traceability

## Orchestration Patterns

### Session Management Coordination
- **Execution Mode Detection**: New session, continuation, or recovery
- **Context Capture**: Customer goals, technical preferences, organizational context
- **State Initialization**: Workflow state and customer context files
- **Handoff Protocols**: Seamless workflow progression across stages

### Project Analysis Coordination
- **Input Assessment**: Existing documents vs scratch vs mixed scenarios
- **Complexity Assessment**: Document analysis and categorization
- **Strategy Recommendation**: Execution mode and session management guidance
- **Risk Identification**: Early identification of potential challenges

### Requirements Generation Coordination
- **Multi-Category Input Management**: Systematic processing across project-context, technical-knowledge, organization-context, and project-code folders
- **Context Classification**: Automatic separation of project requirements, external integrations, organizational constraints, and legacy considerations
- **Integration Requirements Extraction**: Analysis of external reference materials to derive integration needs without misinterpretation as build targets
- **Policy Application**: Consistent application of organizational standards, naming conventions, and compliance requirements
- **Brownfield Analysis**: Systematic reference system assessment and integration evaluation with compatibility planning
- **Structure Adherence**: Category-specific requirements package frameworks with clear traceability
- **Foundation Establishment**: Stable multi-category requirements foundation for architecture design 

### Architecture Generation Coordination
- **Path Selection**: Intelligence Hub availability assessment and path determination
- **Path A Execution**: Deep research decision, job submission, expert insights integration with multi-category requirements
- **Path B Execution**: Guidance selection, reference architecture analysis, context-aware design incorporating all four input categories
- **Path Convergence**: Common architecture activities integrating project requirements, external integrations, organizational policies, and reference system constraints
- **Multi-Category Design Integration**: Architecture aligned with requirements from all four input categories
- **Policy Enforcement**: Automatic application of organizational standards throughout architecture design
- **Decision Documentation**: Category-specific influence traceability in ADRs showing which input category influenced each decision
- **Comprehensive Validation**: Requirements coverage across all categories, integration feasibility, service limits, organizational compliance
- **Service Limits Assessment**: Proactive AWS quota analysis with organizational constraint consideration

### Holistic Quality Assessment Coordination
- **Cross-Domain Optimization**: Requirements and architecture improved together
- **Assessment Management**: Multi-dimensional quality evaluation
- **Progress Tracking**: Score progression and issue resolution
- **Quality Threshold Enforcement**: Mandatory 90/100 standard

### Security Assessment Coordination
- **Context Integration**: Complete specification information for threat modeling
- **Standards Compliance**: AWS security requirements and BSC mapping
- **Mitigation Focus**: Actionable security controls and implementation guidance
- **Testing Framework**: Concrete security test cases and validation procedures

### Output Organization Coordination
- **Structure Validation**: Folder structure compliance with defined requirements
- **Iteration Management**: Sequential specification packages with proper naming
- **Content Organization**: Threat model, supplement material, score sheets
- **Handoff Preparation**: Executive summary and final deliverable packaging

### Modular Task Coordination
- **Clear Organization**: Each workflow stage organized in focused modules
- **Session Management**: Consistent handoff protocols across modules
- **Progress Tracking**: Unified progress tracking across modular tasks
- **Context Sources**: Standardized context loading from workflow state files

## Quality Assurance Framework

### Multi-Dimensional Assessment
Each specification package evaluated across 5 weighted categories with detailed scoring and feedback for systematic improvement.

### Iteration Management
- Standalone score sheets for transparency
- Complete specification packages for each iteration
- Clear improvement tracking and issue resolution
- Maximum 5 iterations to reach quality threshold

### Implementation Readiness Validation
- Minimum 90/100 quality score achieved
- All critical issues addressed and resolved
- Comprehensive security posture defined
- Stakeholder and development team approval

## Success Criteria

### Process Success
- Complete specification package with all components
- 90/100+ quality score across all dimensions
- Comprehensive threat model with actionable mitigations
- Clear audit trail of improvements and decisions

### Implementation Readiness
- Requirements traceable to business objectives
- Architecture decisions with rationale and alternatives
- User stories with implementation guidance
- Security controls mapped to specific threats
- Development team validation of feasibility

## Escalation Triggers

**PAUSE AND Escalate to user When**:
- Critical information gaps prevent quality assessment
- Fundamental architectural or feasibility issues identified
- Security requirements conflict with functional constraints
- Quality threshold not achievable within iteration limits
- Stakeholder requirements conflict with technical limitations