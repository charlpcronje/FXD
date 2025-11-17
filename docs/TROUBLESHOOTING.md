<!-- @agent: agent-docs -->
# FXD Troubleshooting Guide

**Common issues and solutions for FXD v0.1 Alpha**

---

## Quick Links

- [Installation Issues](#installation-issues)
- [Import Errors](#import-errors)
- [Runtime Errors](#runtime-errors)
- [CLI Issues](#cli-issues)
- [Performance Issues](#performance-issues)
- [Getting Help](#getting-help)

---

## Known Issues (v0.1 Alpha)

### Critical: Module Import Errors

**Status:** Expected in alpha, being fixed

**Error:**
```
TS2304 [ERROR]: Cannot find name '$$'
```

**Why:** Modules don't properly import from core framework

**When fixed:** v0.2 (1-2 weeks)

**Workaround:** None currently. Wait for v0.2 or help fix imports.

---

## Installation Issues

### 1. Deno Not Found

**Error:**
```bash
deno: command not found
```

**Solution:**
```bash
# Install Deno

# macOS/Linux
curl -fsSL https://deno.land/x/install/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Via package managers
brew install deno  # macOS
choco install deno # Windows
scoop install deno # Windows

# Verify
deno --version
```

### 2. Permission Denied

**Error:**
```bash
permission denied: fxd-cli.ts
```

**Solution:**
```bash
# Make executable (Unix)
chmod +x fxd-cli.ts

# Or run with deno
deno run -A fxd-cli.ts help
```

### 3. Module Not Found

**Error:**
```
error: Module not found "file:///path/to/module"
```

**Solution:**
```bash
# Check you're in the fxd directory
pwd  # Should show .../fxd

# Check files exist
ls fxn.ts  # Should exist
ls fx.ts   # Should exist

# Run from correct directory
cd /path/to/fxd
deno run -A fxd-cli.ts help
```

---

## Import Errors

### 1. Cannot Find Name '$$'

**Error:**
```
TS2304 [ERROR]: Cannot find name '$$'
  const node = $$(path).node();
               ^^
```

**Why:** Module doesn't import from core

**Status:** Known issue in alpha

**Temporary Fix:**
```typescript
// Add to top of broken module
import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy } from '../fxn.ts';

// Make available globally if needed
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
```

### 2. Circular Dependency

**Error:**
```
Circular dependency detected
```

**Solution:**
```typescript
// Bad: Mutual imports
// a.ts imports b.ts, b.ts imports a.ts

// Good: Import from core only
import { $$ } from './fxn.ts';
// Don't import other modules that import you
```

### 3. Type Errors

**Error:**
```
Type 'unknown' is not assignable to type 'FXNode'
```

**Solution:**
```typescript
// Add type assertion
const node = $$('path').node() as FXNode;

// Or use type parameter
const value = $$('path').val<string>();

// Or check types
const node = $$('path').node();
if (node) {
  // Now TypeScript knows it exists
}
```

---

## Runtime Errors

### 1. Address In Use (Port Conflict)

**Error:**
```
error: AddrInUse: Address already in use (os error 48)
```

**Why:** Port 8787 (or other) already in use

**Solution:**
```bash
# Find process using port
# macOS/Linux
lsof -i :8787

# Windows
netstat -ano | findstr :8787

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port in code
```

**Note:** This error actually means the server code works! It's trying to start.

### 2. Undefined Value Errors

**Error:**
```javascript
TypeError: Cannot read property 'name' of undefined
```

**Solution:**
```typescript
// Bad: No safety
const name = $$('user').val().name;

// Good: Use .get() with default
const user = $$('user').get({ name: 'Unknown' });
const name = user.name;

// Or check first
const user = $$('user').val();
if (user) {
  const name = user.name;
}

// Or use optional chaining
const name = $$('user').val()?.name;
```

### 3. Watch Function Not Firing

**Issue:** Watcher doesn't trigger on changes

**Causes & Solutions:**
```typescript
// 1. Watcher added after value set
$$('data').val(123);  // Value set
$$('data').watch(v => console.log(v));  // Too late!

// Fix: Add watcher first
$$('data').watch(v => console.log(v));
$$('data').val(123);  // Now triggers

// 2. Value hasn't actually changed
$$('data').val(100);
$$('data').val(100);  // Same value, no trigger

// Fix: Change the value
$$('data').val(101);  // Different value, triggers

// 3. Watcher was removed
const unwatch = $$('data').watch(v => console.log(v));
unwatch();  // Removed
$$('data').val(123);  // Won't trigger

// Fix: Don't call unwatch()
```

---

## CLI Issues

### 1. CLI Help Not Showing

**Error:**
```bash
deno run -A fxd-cli.ts help
# Nothing happens or error
```

**Solution:**
```bash
# Check CLI file exists
ls -la fxd-cli.ts

# Run with explicit path
deno run -A ./fxd-cli.ts help

# Check for syntax errors
deno check fxd-cli.ts
```

### 2. Disk Creation Fails

**Error:**
```
❌ Invalid disk name
```

**Solution:**
```bash
# Bad: Special characters
deno run -A fxd-cli.ts create "my project!"

# Good: Alphanumeric + hyphens/underscores
deno run -A fxd-cli.ts create my-project
deno run -A fxd-cli.ts create my_project
deno run -A fxd-cli.ts create MyProject123
```

### 3. Import Path Not Found

**Error:**
```
❌ Import failed
Error: No such file or directory
```

**Solution:**
```bash
# Check path exists
ls -la ./src  # Should show files

# Use absolute path
deno run -A fxd-cli.ts import /absolute/path/to/src

# Use correct relative path
deno run -A fxd-cli.ts import ./src  # From current dir
deno run -A fxd-cli.ts import ../src  # From parent dir
```

### 4. State Not Persisting

**Issue:** Disk state lost after CLI exit

**Check:**
```bash
# State file should exist
ls -la .fxd-state.json

# Check contents
cat .fxd-state.json
```

**Solution:**
```bash
# Make sure you're in the same directory
pwd

# State file is directory-specific
# Each directory has its own .fxd-state.json

# To share state, use same directory
cd /path/to/project
deno run -A fxd-cli.ts list  # Uses /path/to/project/.fxd-state.json
```

---

## Performance Issues

### 1. Slow Selector Queries

**Issue:** `$$('path').select('[...]')` is slow

**Solution:**
```typescript
// Bad: Broad selector
$$('root').select('[type="function"]')  // Searches everything

// Good: Narrow scope
$$('root.code.myModule').select('[type="function"]')  // Focused search

// Cache results
const funcs = $$('root.code').select('[type="function"]')
// Use 'funcs' multiple times
```

### 2. Too Many Watchers

**Issue:** App slows down over time

**Cause:** Watchers not cleaned up

**Solution:**
```typescript
// Bad: Never clean up
$$('data').watch(v => console.log(v))
$$('data').watch(v => console.log(v))
$$('data').watch(v => console.log(v))
// Hundreds of watchers accumulate

// Good: Clean up when done
const unwatch = $$('data').watch(v => console.log(v))

// When no longer needed
unwatch()

// Or in React/component
useEffect(() => {
  const unwatch = $$('data').watch(v => setData(v))
  return () => unwatch()  // Cleanup on unmount
}, [])
```

### 3. Large Data Updates

**Issue:** Updating large objects is slow

**Solution:**
```typescript
// Bad: Update entire object repeatedly
for (let i = 0; i < 1000; i++) {
  const obj = $$('data').val()
  obj.items.push(i)
  $$('data').val(obj)  // Triggers watchers 1000 times!
}

// Good: Batch updates
const obj = $$('data').val()
for (let i = 0; i < 1000; i++) {
  obj.items.push(i)
}
$$('data').val(obj)  // Triggers watchers once

// Or use debouncing
$$('data').group().debounce(100)
```

---

## Test Failures

### 1. Tests Won't Run

**Error:**
```bash
deno test
# Fails with import errors
```

**Why:** Test files need same import fixes as modules

**Status:** Being fixed in v0.2

**Workaround:**
```bash
# Wait for v0.2, or
# Help fix imports in test files
```

### 2. Assertion Failures

**Error:**
```
AssertionError: Values not equal
```

**Debug:**
```typescript
// Add logging
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

const result = someFunction();
console.log('Result:', result);  // See what you got
assertEquals(result, expected);

// Check types
console.log('Type:', typeof result);

// Deep compare
console.log('Deep:', JSON.stringify(result, null, 2));
```

---

## Common Mistakes

### 1. Forgetting to Import

```typescript
// Error: $$ is not defined
const value = $$('path').val()

// Fix: Import it
import { $$ } from './fxn.ts'
const value = $$('path').val()
```

### 2. Wrong Path Syntax

```typescript
// Bad: Using / instead of .
$$('users/alice/name')

// Good: Use dots
$$('users.alice.name')

// Bad: Leading dot
$$.('users.alice')

// Good: No leading dot
$$('users.alice')
```

### 3. Not Handling Undefined

```typescript
// Bad: Assume value exists
const age = $$('user.age').val() + 1  // Error if undefined

// Good: Provide default
const age = ($$('user.age').get(0)) + 1

// Or check first
const userAge = $$('user.age').val()
const age = userAge !== undefined ? userAge + 1 : 1
```

### 4. Mutation Without Update

```typescript
// Bad: Mutate without notifying
const obj = $$('data').val()
obj.count = 10
// Watchers don't fire!

// Good: Set the value
const obj = $$('data').val()
obj.count = 10
$$('data').val(obj)  // Triggers watchers

// Or
$$('data.count').val(10)  // Directly set property
```

---

## Browser Issues

### 1. CORS Errors

**Error:**
```
Access to fetch blocked by CORS policy
```

**Solution:**
```bash
# Run local server with CORS
deno run -A server/dev.ts

# Or configure CORS in your server
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST',
}
```

### 2. Module Loading Fails

**Error:**
```
Failed to load module script
```

**Solution:**
```html
<!-- Use type="module" -->
<script type="module" src="./fx.js"></script>

<!-- Import correctly -->
<script type="module">
  import { $$ } from './fx.js';
  // Now available
</script>
```

---

## Getting Help

### 1. Check Documentation

- **[Getting Started](GETTING-STARTED.md)** - Installation & basics
- **[API Reference](API-REFERENCE.md)** - Complete API
- **[CLI Guide](CLI-GUIDE.md)** - CLI commands
- **[Examples](EXAMPLES.md)** - Working examples
- **[Actual Status](ACTUAL-STATUS.md)** - Current state

### 2. Check Known Issues

- **Import errors:** Expected in v0.1, fixed in v0.2
- **Test failures:** Being fixed
- **Examples broken:** Need import fixes

### 3. Debug Yourself

```typescript
// Add logging
console.log('Value:', $$('path').val())
console.log('Node:', $$('path').node())
console.log('Type:', $$('path').type())

// Check existence
const node = $$('path').node()
console.log('Exists:', !!node)

// Inspect structure
console.log('Structure:', JSON.stringify($$('path').node(), null, 2))
```

### 4. Ask for Help

**Before asking:**
- [ ] Checked this guide
- [ ] Read relevant docs
- [ ] Tried debugging
- [ ] Know your FXD version (v0.1 alpha)

**When asking:**
```
1. FXD Version: v0.1 alpha
2. Deno Version: [run `deno --version`]
3. OS: [macOS/Windows/Linux]
4. Error Message: [exact error]
5. Code: [minimal reproduction]
6. What you tried: [steps taken]
```

**Where to ask:**
- GitHub Issues (for bugs)
- GitHub Discussions (for questions)
- Discord (if available)

---

## Reporting Bugs

### Good Bug Report

```markdown
**FXD Version:** v0.1 alpha
**Deno Version:** 1.x.x
**OS:** macOS 14.0

**Issue:** CLI import fails on directories

**Steps to Reproduce:**
1. `deno run -A fxd-cli.ts create test`
2. `deno run -A fxd-cli.ts import ./src`
3. Error occurs

**Expected:** Import all files in ./src
**Actual:** Error: [exact error message]

**Code:**
[minimal code that reproduces issue]

**Additional Context:**
- Directory has 10 JS files
- No subdirectories
- Permissions are correct (can read files)
```

### Bad Bug Report

```markdown
It doesn't work
```

(Please provide more details!)

---

## Debug Mode

### Enable Verbose Logging

```typescript
// In your code
import { $$ } from './fxn.ts'

// Enable debug (if available)
$$._debug = true

// Or add custom logging
const original = $$;
globalThis.$$ = new Proxy(original, {
  apply(target, thisArg, args) {
    console.log('$$() called with:', args)
    return target.apply(thisArg, args)
  }
})
```

### Trace Watchers

```typescript
// Log all watcher calls
$$('data').watch((newVal, oldVal) => {
  console.log('Watcher fired:', { newVal, oldVal })
  console.trace()  // Stack trace
})
```

---

## Still Stuck?

### Check Version

```bash
# Make sure you're on latest
git pull origin main

# Check what version you have
git log --oneline -1
```

### Clean Start

```bash
# Remove state
rm .fxd-state.json

# Clear Deno cache
deno cache --reload fxn.ts

# Try again
deno run -A fxd-cli.ts help
```

### Wait for v0.2

Many current issues are being fixed in v0.2 (1-2 weeks). Consider:
- Waiting for the fix
- Helping fix it (see `docs/IMMEDIATE-TODO.md`)
- Using workarounds above

---

## Summary Checklist

When something breaks:

- [ ] Check this troubleshooting guide
- [ ] Read error message carefully
- [ ] Check you're using correct syntax
- [ ] Verify imports are correct
- [ ] Add logging/debugging
- [ ] Check known issues (import errors in v0.1)
- [ ] Try clean start
- [ ] Ask for help with details

**Remember:** FXD v0.1 is alpha. Issues are expected and being fixed.

---

## Quick Fixes Reference

| Issue | Quick Fix |
|-------|-----------|
| `$$ not found` | Add `import { $$ } from './fxn.ts'` |
| `AddrInUse` | Different port or kill process |
| `Module not found` | Check you're in fxd directory |
| `Permission denied` | `chmod +x` or use `deno run` |
| Undefined value | Use `.get(default)` |
| Watcher not firing | Add watcher before setting value |
| Slow performance | Clean up watchers, narrow selectors |
| Tests fail | Wait for v0.2 import fixes |
| CLI not working | Check path, use absolute path |

---

<!-- @agent: agent-docs -->
<!-- Last updated: 2025-10-02 -->
