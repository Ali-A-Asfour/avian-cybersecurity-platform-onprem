---
inclusion: always
---

# Task Execution Best Practice

## Task Status Updates

You must always keep the `code-handoff.md` task and subtasks status up to date.  Update the the status before and after finishing a task or a subtask.

## Read Reference Documents Before Coding

Each task in `code-handoff.md` has a `referenceDocuments` array. You MUST read ALL of them before starting implementation of that task.

**Why:** Requirements, architecture, and design decisions are in those documents. Skipping them leads to incorrect implementations.

**Pattern:**
```
1. Read code-handoff.md → identify current task
2. Mark current task or subtask status as "current"
2. Read ALL documents in referenceDocuments array for that current task
3. Review implementationNotes
4. Execute the task
5. Update the current task or subtask status as "complete"
```