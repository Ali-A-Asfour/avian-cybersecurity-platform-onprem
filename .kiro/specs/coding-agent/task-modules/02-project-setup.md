# Task 2: Project Setup

Initialize project structure based on input source and available documentation.

## Before Starting

Check `.workflow-state/code-handoff.md` to understand:
- Input source (design-agent vs user-documents)
- Quality assessment results (for user-documents path)
- Current progress and avoid duplicating work

### Path A: Design Agent Integration
Check `.workflow-state/design-handoff.md` for:
- Blueprint vs custom approach decision
- Blueprint location (if applicable)

### Path B: User Documents
Check `.workflow-state/input-quality-assessment.md` for:
- Documentation gaps and assumptions
- Architecture guidance availability
- Implementation constraints

## Setup Steps

### Path A: Design Agent Integration

#### Blueprint Path (if using blueprint)
```bash
# Copy blueprint to solution folder
cp -r .workflow-state/reference-architectures/[blueprint-name]/* [PROJECT-NAME]-solution/
cd [PROJECT-NAME]-solution/
git init
```

#### Custom Development Path (if no blueprint)
```bash
# Create solution folder
mkdir [PROJECT-NAME]-solution
cd [PROJECT-NAME]-solution
git init

# Create structure per Design Agent architecture
mkdir -p src/{components,services,utils} infrastructure tests
```

### Path B: User Documents Integration

#### With Architecture Guidance
```bash
# Create solution folder
mkdir [PROJECT-NAME]-solution
cd [PROJECT-NAME]-solution
git init

# Create structure based on available architecture documentation
# Adapt structure based on technology stack identified in user documents
mkdir -p src tests docs

# Example for web application (adapt based on user docs)
mkdir -p src/{frontend,backend,shared} infrastructure
```

#### Limited Architecture Guidance
```bash
# Create basic solution folder
mkdir [PROJECT-NAME]-solution
cd [PROJECT-NAME]-solution
git init

# Create minimal structure - will evolve during implementation
mkdir -p src tests docs
echo "# Implementation will define structure based on requirements" > src/README.md
```

## After Completion

Update `.workflow-state/code-handoff.md`:
- Mark this task complete
- Document solution location
- Note any adaptations made for user documents path
- Record any assumptions or limitations encountered

### Path-Specific Notes

**Path A (Design Agent)**: Document blueprint usage and any customizations made
**Path B (User Documents)**: Document structure decisions and assumptions made due to documentation gaps

