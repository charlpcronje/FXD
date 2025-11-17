# Agent: examples
**Priority:** P1
**Time:** 4-6 hours
**Dependencies:** CRITICAL-PATH complete

---

## 🎯 Mission
Create 6 working, documented examples.

---

## 📋 File Ownership
**Exclusive:** `examples/**/*.ts`, `examples/**/*.md`

---

## 📋 Tasks

### D.1: Fix existing examples
**Time:** 30 min

```bash
examples/repo-js/demo.ts
examples/repo-js/seed.ts
```

Add imports using template.

### D.2-D.6: Create new examples
**Time:** 4-5 hours

Each example:
- Working code
- README.md
- Comments explaining each step

**Examples:**
- [ ] D.2: hello-world (30 min)
- [ ] D.3: snippet-management (1 hour)
- [ ] D.4: selector-demo (1 hour)
- [ ] D.5: reactive-groups (1 hour)
- [ ] D.6: import-export-workflow (1.5 hours)

### Template
```typescript
/**
 * Example: [Name]
 * @agent: agent-examples
 * @timestamp: [FILL]
 * @task: TRACK-D-EXAMPLES.md#D.[N]
 */

import { $$, $_$$, fx } from "../../fxn.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Example code with comments
console.log("Step 1: ...");
// ... code ...

console.log("Step 2: ...");
// ... code ...
```

---

## ✅ Success Criteria
- [ ] 6 examples working
- [ ] Each has README
- [ ] Can run: `deno run -A examples/[name]/demo.ts`
- [ ] Output is clear
