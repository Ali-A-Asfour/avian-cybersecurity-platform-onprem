---
inclusion: always
---

# APEX Blueprints Usage Workflow

## Overview

This document provides the **technical implementation workflow** for using APEX Blueprints during the coding phase. 

**Scope Separation:**
- **This Document**: Step-by-step technical workflow for copying, customizing, and deploying blueprints
- **Blueprint Strategy**: For evaluation criteria, decision frameworks, and when to use blueprints, see #[[file:../../blueprints/agentsmith-blueprints/agentsmith-blueprints.md]]

## Critical Pattern: Copy First, Customize Second

When implementing components that use APEX Blueprints, you MUST follow this workflow:

### Step 1: Copy the Entire Blueprint
```bash
# Copy from blueprints/ to project/
cp -r blueprints/[blueprint-name] project/[blueprint-name]
```

**Examples:**
- `cp -r blueprints/user_interface project/user_interface`
- `cp -r blueprints/gateway_api project/s3-gateway-api`
- `cp -r blueprints/agent project/media-agent`

### Step 2: Customize the Copy
- Make ALL changes in `project/[blueprint-name]/`
- NEVER modify files in `blueprints/` directly
- Blueprints stay pristine for reference

### Step 3: Document Customizations
Create a `CUSTOMIZATION.md` or similar file explaining:
- What was added
- What was modified
- Why changes were made
- How to integrate/deploy

## Blueprint Directory Structure

```
media-supply-chain-acquisition-agent-solution/
├── blueprints/              # PRISTINE - Never modify
│   ├── user_interface/
│   ├── gateway_api/
│   ├── agent/
│   └── identity/
└── project/                 # WORKING COPIES - Customize here
    ├── user_interface/      # Copied from blueprints/user_interface
    ├── s3-mcp-tool/        # Copied from blueprints/gateway_api
    ├── mediaconvert-mcp-tool/  # Copied from blueprints/gateway_api
    └── media-agent/         # Copied from blueprints/agent
```

## When to Copy a Blueprint

**Note:** For blueprint evaluation and selection guidance, refer to #[[file:../../blueprints/agentsmith-blueprints/agentsmith-blueprints.md]].

Copy a blueprint when you need to:
- Create a new UI component → Copy `user_interface`
- Create a new API/MCP tool → Copy `gateway_api`
- Create a new agent → Copy `agent`
- Set up authentication → Copy `identity`



## Workflow Examples

**UI Component:**
```bash
# Copy blueprint first
cp -r blueprints/user_interface project/user_interface
# Then customize in project/user_interface/
```

**MCP Tool:**
```bash
# Copy gateway_api blueprint
cp -r blueprints/gateway_api project/my-mcp-tool
# Then customize in project/my-mcp-tool/
```

## Verification Checklist

Before considering a blueprint-based task complete:
- [ ] Blueprint copied to `project/` folder
- [ ] All customizations made in `project/` copy
- [ ] `blueprints/` folder unchanged
- [ ] Customization documentation created
- [ ] Deploy scripts updated if needed
- [ ] Tests updated for customizations



## Common Mistakes to Avoid

❌ Modifying blueprints directly
❌ Creating components from scratch when blueprint exists
❌ Mixing blueprint and custom code in same directory
❌ Not documenting what was customized

✅ Copy entire blueprint first
✅ Customize in project/ folder
✅ Document all changes
✅ Keep blueprints pristine

## Related Documentation

- **Blueprint Strategy & Evaluation**: #[[file:../../blueprints/agentsmith-blueprints/agentsmith-blueprints.md]]
