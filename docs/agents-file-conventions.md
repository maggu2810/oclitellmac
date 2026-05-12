# AGENTS.md File Conventions

## Philosophy

Keep AGENTS.md files as minimal as possible to reduce per-message token costs in OpenCode AI conversations.

## Problem

Large AGENTS.md files (300-1000+ lines) are loaded as system reminders on every AI message, resulting in:
- 20k-30k+ tokens per message baseline cost
- $0.06-0.09 per message on Claude Sonnet (before any actual work)
- Accumulated cost over long sessions (50-100 messages = $3-9 just for context)

## Solution

Use OpenCode's `@filename` reference feature to load detailed documentation on-demand:

```markdown
When working on [feature X], read @docs/[relevant-doc].md
```

The AI will:
1. Read the minimal AGENTS.md (always loaded)
2. See the instruction
3. Call the Read tool on `docs/[relevant-doc].md` when needed
4. Load detailed context only when relevant to the current task

## Structure

### Root AGENTS.md (~80-100 lines)
- Project purpose (2-3 sentences)
- Critical constants only (API endpoints, cache paths)
- `@` reference instructions for everything else

### Plugin AGENTS.md (~40-60 lines each)
- Plugin purpose (2 sentences)
- Plugin type (server/TUI)
- `@` reference instructions to plugin docs/

### docs/ Directory
- Detailed implementation information
- API reference documentation
- Design decisions and rationale
- Testing guides
- File maps and responsibilities

## Cost Impact

The exact savings depend on your project size, but here's the general pattern:

### Before Restructuring (typical)
```
Large AGENTS.md files: 300-1000+ lines → 10-30k tokens per message
Multi-file projects: Often 50k+ tokens baseline
Cost on Claude Sonnet: $0.03-0.15 per message just for context
50-message session: $1.50-7.50+ just for AGENTS.md injection
```

### After Restructuring (typical)
```
Minimal AGENTS.md: 80-100 lines → 2-4k tokens baseline
On-demand docs: 5-10k tokens only when relevant to current task
Cost on Claude Sonnet: $0.006-0.012 baseline, $0.018-0.036 with docs loaded
50-message session: $0.30-1.80 (mixed usage)

Typical savings: 70-85% reduction in context costs
```

## Pattern

### Good Example
```markdown
## File Reading Instructions

When working on config generation or provider setup,
read @docs/architecture.md

When working with API endpoints or understanding request/response schemas,
reference @docs/api-reference.md

For understanding design decisions (no Azure AD, Result types, etc.),
consult @docs/design-decisions.md
```

### Anti-pattern
```markdown
## Architecture

[500 lines of implementation details here]

## API Reference

[300 lines of endpoint documentation here]
```

## Anti-patterns to Avoid

1. **Don't duplicate content** between AGENTS.md and docs/
   - Extract once, reference from AGENTS.md

2. **Don't include implementation details in AGENTS.md**
   - "How to implement X" belongs in docs/
   - AGENTS.md should only point to the right doc

3. **Don't create catch-all documentation files**
   - Split by concern: architecture.md, api-reference.md, testing.md
   - Easier for AI to find relevant information

4. **Don't forget to update @ references**
   - When adding new docs, add corresponding @ instruction
   - Keep AGENTS.md in sync with docs/ structure

## Maintenance

### Adding New Documentation
1. Create focused doc in `docs/` (e.g., `docs/caching-strategy.md`)
2. Add one-line @ reference in AGENTS.md:
   ```markdown
   When working on caching or performance optimization,
   read @docs/caching-strategy.md
   ```

### Refactoring Existing Content
1. Identify large sections in AGENTS.md (>50 lines)
2. Extract to focused doc in `docs/`
3. Replace with one-line @ reference
4. Verify AI can find content when needed

### Verifying Effectiveness
Monitor token usage in OpenCode:
- Check token count per message (shown in UI after compaction)
- Target: 3-8k baseline, 8-15k when working on specific features
- If consistently >15k, audit AGENTS.md for unnecessary inline content

## Further Reading

- OpenCode `@` reference documentation: https://opencode.ai/docs/rules/#referencing-external-files
- This convention file itself serves as meta-documentation for maintaining minimal AGENTS.md structures across projects
