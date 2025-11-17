# Track B: Module Integration (Multi-Agent)

**Agents:**
- agent-modules-core (B1)
- agent-modules-persist (B2)
- agent-modules-io (B3)
- agent-modules-integration (B4)

**Priority:** P0
**Dependencies:** CRITICAL-PATH complete
**Can Start:** After .critical-path-complete signal

---

## B1: Core Modules (agent-modules-core)
**Time:** 3-4 hours

### Files
- `modules/fx-snippets.ts`
- `modules/fx-view.ts`
- `modules/fx-parse.ts`
- `modules/fx-group-extras.ts`

### Tasks
- [x] B1.1: Fix fx-snippets.ts imports + test (45 min) - DONE by agent-critical-path
- [x] B1.2: Fix fx-view.ts imports + test (45 min) - DONE
- [x] B1.3: Fix fx-parse.ts imports + test (45 min) - DONE
- [x] B1.4: Fix fx-group-extras.ts imports + test (45 min) - DONE
- [x] B1.5: Verify all compile (15 min) - DONE
- [ ] B1.6: Run module tests (30 min) - PENDING (no tests exist yet)

### Pattern
```typescript
// @agent: agent-modules-core
// @timestamp: [FILL]
// @task: TRACK-B-MODULES.md#B1.[N]

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy } from '../fxn.ts';

// Module code...
```

---

## B2: Persistence Modules (agent-modules-persist)
**Time:** 2-3 hours

### Files
- `modules/fx-persistence.ts`
- `modules/fx-snippet-persistence.ts`
- `modules/fx-view-persistence.ts`
- `modules/fx-metadata-persistence.ts`

### Tasks
- [ ] B2.1: Fix fx-persistence.ts imports (30 min)
- [ ] B2.2: Fix fx-snippet-persistence.ts imports (30 min)
- [ ] B2.3: Fix fx-view-persistence.ts imports (30 min)
- [ ] B2.4: Fix fx-metadata-persistence.ts imports (30 min)
- [ ] B2.5: Verify all compile (15 min)

### Note
These modules may not be fully functional yet - just fix imports and ensure they compile.

---

## B3: IO Modules (agent-modules-io)
**Time:** 3-4 hours

### Files
- `modules/fx-import.ts`
- `modules/fx-export.ts`

### Tasks
- [x] B3.1: Fix fx-import.ts imports (30 min)
- [x] B3.2: Implement basic import functionality (1-1.5 hours)
- [x] B3.3: Fix fx-export.ts imports (30 min)
- [x] B3.4: Implement basic export functionality (1-1.5 hours)
- [x] B3.5: Test import/export roundtrip (30 min)

### Deliverable
Basic import/export working for JavaScript files.

---

## B4: Integration Layer (agent-modules-integration)
**Time:** 2-3 hours
**Dependencies:** B1, B2, B3 complete

### File (NEW)
- `modules/fx-core.ts`

### Tasks
- [ ] B4.1: Create fx-core.ts (1 hour)
- [ ] B4.2: Export unified API (1 hour)
- [ ] B4.3: Test integration (1 hour)

### Implementation
```typescript
/**
 * FXD Core Integration
 * @agent: agent-modules-integration
 * @timestamp: [FILL]
 * @task: TRACK-B-MODULES.md#B4
 */

import { fx, $$, $_$$ } from '../fxn.ts';
import { createSnippet } from './fx-snippets.ts';
import { renderView } from './fx-view.ts';
import { parsePatches } from './fx-parse.ts';

export const FXD = {
  core: fx,
  $: $$,
  $_: $_$$,

  snippets: {
    create: createSnippet,
    // ... more
  },

  views: {
    render: renderView,
    // ... more
  },

  parse: {
    patches: parsePatches,
  }
};

export default FXD;
```

---

## 📊 Progress

### B1: Core Modules (agent-modules-core)
- [x] fx-snippets.ts
- [x] fx-view.ts
- [x] fx-parse.ts
- [x] fx-group-extras.ts
**Status:** ✅ COMPLETE

### B2: Persist Modules (agent-modules-persist)
- [ ] fx-persistence.ts
- [ ] fx-snippet-persistence.ts
- [ ] fx-view-persistence.ts
- [ ] fx-metadata-persistence.ts
**Status:** ⬜

### B3: IO Modules (agent-modules-io)
- [x] fx-import.ts
- [x] fx-export.ts
**Status:** ✅ COMPLETE

### B4: Integration (agent-modules-integration)
- [ ] fx-core.ts created
- [ ] Unified API exported
- [ ] Integration tested
**Status:** ⬜

---

## ✅ Success Criteria
- [ ] All module files compile
- [ ] Core modules tested
- [ ] IO modules functional
- [ ] fx-core.ts provides unified API
- [ ] No import errors
