# Coding Agent Workflow - Tasks

Transform Design Agent specification packages OR user-provided project documents into deployed solutions through dual-path implementation workflow.

## Enhanced Task Modules

- **[Task 0: Input Validation & Implementation Planning](task-modules/00-input-validation-and-planning.md)** - Detect input source, validate quality, and generate implementation plan
- **[Task 1: Load Implementation Tasks](task-modules/01-load-implementation-tasks.md)** - Generate dynamic implementation plan based on design documents
- **[Task 2: Project Setup](task-modules/02-project-setup.md)** - Initialize project structure
- **[Task 3+: Implementation](task-modules/03-implementation.md)** - Execute implementation plan (generates artifacts only, no deployment)

## Dual-Path Execution

### Path A: Design Agent Integration
1. Execute Task 0: Detect Design Agent output and validate input
2. Execute Task 1: Load implementation tasks based on design documents
3. Execute Task 2: Project Setup with blueprint integration
4. Execute Task 3+: Implementation with full traceability to design specifications

### Path B: Direct User Input
1. Execute Task 0: Validate user documents and assess quality
2. Execute Task 1: Load implementation tasks based on available documentation
3. Execute Task 2: Project Setup based on available architecture guidance
4. Execute Task 3+: Implementation with adaptation to documentation limitations

## Quality Gate Enforcement

**Before Task 1 (Project Setup)**:
- Input source identified and validated
- Quality assessment completed (Path B only)
- Implementation plan generated and approved
- All reference documents accessible

**Before Task 2 (Implementation)**:
- Project structure established
- Development environment configured
- Task breakdown validated against available documentation

## Execution Rules

### Core Principles
1. **Generate Artifacts Only** - Never run deployment commands
2. **Build WITH User** - Collaborative, not autonomous
3. **Test Planning Only** - Document test requirements, don't generate test code
4. **Clear Handoff** - Create deploy-handoff.md for Deploy Agent

### Prohibited Commands
- ❌ `cdk deploy` - Never deploy
- ❌ `aws cloudformation deploy` - Never deploy
- ❌ `aws cloudformation create-stack` - Never deploy
- ✅ `cdk synth` - OK (generates templates only)

### Required Outputs
1. Complete source code in `generated/build/solution/`
2. CloudFormation templates (via `cdk synth`)
3. Documentation package (7 files minimum)
4. Test plan document (not test code)
5. Deploy handoff document (`.workflow-state/deploy-handoff.md`)

### Workflow Completion
- Status: "ready-for-deployment" in code-handoff.md
- All artifacts present and validated
- Deploy handoff document complete
- NO deployment performed

### Task Execution Rules
1. **Always start with Task 0** - Input validation and planning is mandatory
2. **Always execute Task 1** - Load implementation tasks based on documents
3. **Respect quality gates** - Do not proceed if quality thresholds not met
4. **Maintain traceability** - Link all implementation to source documentation
5. **Adapt to input quality** - Scale implementation approach to documentation depth
6. **Document gaps** - Clearly identify and handle documentation limitations