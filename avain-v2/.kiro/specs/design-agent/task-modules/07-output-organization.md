# Output Organization Requirements

## Overview

This module defines the mandatory folder structure and organization requirements for all Design Agent workflow outputs. Proper organization ensures consistency, traceability, and ease of handoff to development teams.

## Project Folder Structure

**CRITICAL**: All workflow outputs must be organized in a single project folder with the following structure:

```
generated/design/
├── specification-package-iteration-1/  (original generated package)
├── specification-package-iteration-2/  (first improved package, if needed)
├── specification-package-iteration-3/  (second improved package, if needed)
├── specification-package-iteration-X/  (final improved package)
├── score-sheet-iteration-1.md         (initial assessment)
├── score-sheet-iteration-2.md         (second iteration scoring, if created)
├── score-sheet-iteration-3.md         (third iteration scoring, if created)
├── score-sheet-iteration-X.md         (final iteration scoring)
├── executive-summary.md               (quality score and security posture)
├── threat-model/                      (comprehensive security assessment)
│   ├── threat-analysis.md
│   ├── security-controls.md
│   ├── testing-framework.md
│   └── implementation-guidance.md
└── supplement-material/               (input analysis and supporting docs)
    ├── input-assessment-analysis.md
    ├── mcp-prescriptive-guidance.md
    └── [other supporting documents]
```

## Organization Rules

### Single Project Folder
- **Container Principle**: All deliverables must be contained within the `generated/design/` folder
- **No Scattered Files**: No deliverables should be created outside the project folder structure
- **Consistent Path**: Project folder path is always `generated/design/`

### Iteration Numbering
- **Sequential Numbering**: Specification packages numbered sequentially (iteration-1, iteration-2, etc.)
- **Complete Packages**: Each iteration folder contains complete specification package
- **File Versioning**: Modified files in iterations get "-improved" suffix
- **Unchanged Files**: Unchanged files copied from previous iteration to maintain completeness

### Score Sheet Placement
- **Root Level**: All score sheets placed in project root folder with iteration numbering
- **Standalone Documents**: Score sheets are standalone documents providing comprehensive feedback
- **Audit Trail**: Complete progression of scores maintained for audit purposes
- **Clear Naming**: score-sheet-iteration-X.md format for easy identification

### Threat Model Folder
- **Dedicated Folder**: Dedicated folder for all security assessment deliverables
- **Comprehensive Coverage**: All threat modeling outputs contained within this folder
- **Structured Organization**: Logical organization of threat model components
- **Implementation Ready**: Security guidance ready for development team use

### Executive Summary
- **Project Root Level**: Executive summary placed at project root level for easy stakeholder access
- **Comprehensive Overview**: Synthesizes final specification package iteration with quality scores
- **Stakeholder Communication**: Professional document suitable for executive and stakeholder review
- **Implementation Readiness**: Clear assessment of readiness and next steps

### Supplement Material
- **Supporting Documentation**: Supporting documentation including input assessment analysis
- **MCP Prescriptive Guidance**: Comprehensive MCP server inventory and project-specific recommendations
- **Reference Materials**: Additional reference materials and analysis documents
- **Traceability**: Source analysis and supporting evidence for specification generation
- **Historical Record**: Maintains record of analysis and decision-making process

## File Naming Conventions

### Specification Packages
- **Format**: `specification-package-iteration-X/`
- **Sequential**: X = 1, 2, 3, etc. in sequential order
- **Complete**: Each folder contains complete specification package
- **Versioned**: Modified files within iterations use "-improved" suffix

### Score Sheets
- **Format**: `score-sheet-iteration-X.md`
- **Sequential**: X = 1, 2, 3, etc. matching specification package iterations
- **Standalone**: Each score sheet is complete and standalone
- **Comprehensive**: Includes detailed scoring and feedback

### Threat Model Components
- **threat-analysis.md**: Core threat analysis and STRIDE assessment
- **security-controls.md**: Security controls mapping and implementation
- **testing-framework.md**: Security testing framework and procedures
- **implementation-guidance.md**: Implementation guidance and best practices

### Executive Summary
- **executive-summary.md**: Comprehensive project overview and quality assessment summary
- **Project Root Level**: Placed at project root for easy stakeholder access
- **Professional Format**: Suitable for executive and stakeholder presentation

### Supporting Documents
- **input-assessment-analysis.md**: Core input assessment analysis
- **mcp-prescriptive-guidance.md**: MCP server inventory and project-specific recommendations
- **[descriptive-name].md**: Additional supporting documents with descriptive names
- **Clear Naming**: File names should clearly indicate content and purpose

## Quality Assurance Requirements

### Structure Validation
- **Folder Structure**: Validate folder structure matches defined requirements
- **File Presence**: Ensure all required files and folders present
- **Naming Compliance**: Verify file naming conventions followed
- **Organization Logic**: Confirm logical organization and navigation

### Content Organization
- **Complete Packages**: Each iteration contains complete specification package
- **Audit Trail**: Complete audit trail of improvements and decisions maintained
- **Traceability**: Clear traceability from inputs to outputs maintained
- **Integration**: All components properly integrated and cross-referenced

### Handoff Readiness
- **Development Ready**: Organization supports easy development team handoff
- **Stakeholder Friendly**: Structure supports stakeholder review and approval
- **Maintenance Ready**: Organization supports ongoing maintenance and updates
- **Audit Ready**: Structure supports audit and compliance requirements

## Implementation Guidelines

### Folder Creation
1. **Project Folder**: Create project folder at `generated/design/`
2. **Initial Structure**: Create initial folder structure at workflow start
3. **Progressive Build**: Build structure progressively as workflow advances
4. **Validation**: Validate structure at each major milestone

### File Management
1. **Iteration Management**: Create new iteration folders as needed
2. **File Copying**: Copy unchanged files from previous iterations
3. **Version Control**: Use "-improved" suffix for modified files
4. **Cleanup**: Ensure no orphaned or misplaced files

### Quality Control
1. **Structure Check**: Regular validation of folder structure compliance
2. **Content Review**: Ensure content properly organized and accessible
3. **Navigation Test**: Verify easy navigation and document discovery
4. **Handoff Preparation**: Prepare structure for clean handoff

## Benefits of Proper Organization

### Development Team Benefits
- **Clear Structure**: Easy to understand and navigate
- **Complete Information**: All necessary information in logical locations
- **Audit Trail**: Clear progression and decision history
- **Implementation Ready**: Ready for immediate development use

### Stakeholder Benefits
- **Professional Presentation**: Well-organized and professional appearance
- **Easy Review**: Logical organization supports efficient review
- **Quality Evidence**: Clear evidence of quality process and outcomes
- **Decision Support**: Complete information for decision-making

### Project Management Benefits
- **Progress Tracking**: Clear evidence of progress and completion
- **Quality Assurance**: Structured approach to quality validation
- **Risk Management**: Complete documentation for risk assessment
- **Handoff Management**: Smooth transition to development phase

### Compliance Benefits
- **Audit Ready**: Structure supports audit and compliance requirements
- **Traceability**: Complete traceability from requirements to implementation
- **Documentation**: Comprehensive documentation for regulatory compliance
- **Quality Evidence**: Clear evidence of quality processes and outcomes

### Task Checklist

- [ ] **Task 7.1: Create Project Folders**
  - [ ] **Project Folder Creation**
    - [ ] Create project folder at `generated/design/`
    - [ ] Create initial folder structure at workflow start
    - [ ] Validate folder structure matches defined requirements
  - [ ] **Initial Organization Setup**
    - [ ] Create specification-package-iteration-1 folder
    - [ ] Create supplement-material folder for supporting documents
    - [ ] Establish file naming conventions and organization rules

- [ ] **Task 7.2: Organize Deliverables**
  - [ ] **Iteration Management**
    - [ ] Create additional iteration folders as needed (iteration-2, iteration-3, etc.)
    - [ ] Copy unchanged files from previous iterations
    - [ ] Use "-improved" suffix for modified files in iterations
    - [ ] Maintain complete packages in each iteration folder
  - [ ] **Score Sheet Management**
    - [ ] Place score sheets in project root folder with iteration numbering
    - [ ] Use score-sheet-iteration-X.md naming format
    - [ ] Ensure each score sheet is complete and standalone
    - [ ] Maintain audit trail of quality progression

- [ ] **Task 7.3: Structure Specialized Content**
  - [ ] **Threat Model Organization**
    - [ ] Create dedicated threat-model folder
    - [ ] Organize threat model components within folder (threat-analysis.md, security-controls.md, etc.)
    - [ ] Ensure all security assessment deliverables contained within
  - [ ] **Supplement Material Organization**
    - [ ] Place input-assessment-analysis.md in supplement-material folder
    - [ ] Organize additional supporting documents with descriptive names
    - [ ] Maintain traceability and reference materials

- [ ] **Task 7.4: Prepare Final Package**
  - [ ] **Quality Validation**
    - [ ] Validate folder structure compliance with defined requirements
    - [ ] Ensure all required files and folders present
    - [ ] Verify file naming conventions followed consistently
    - [ ] Confirm logical organization and navigation
  - [ ] **Handoff Preparation**
    - [ ] Verify executive summary is present at project root level
    - [ ] Confirm MCP prescriptive guidance is in supplement-material folder
    - [ ] Ensure complete audit trail of iterations and improvements
    - [ ] Validate implementation readiness and development team handoff
    - [ ] Confirm structure supports stakeholder review and approval