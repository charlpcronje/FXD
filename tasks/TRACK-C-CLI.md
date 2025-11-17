# Agent: cli
**Priority:** P1
**Time:** 6-8 hours
**Dependencies:** CRITICAL-PATH complete
**Soft Dependency:** Track B modules (can stub initially)

---

## 🎯 Mission
Implement all CLI commands to make them actually work.

---

## 📋 File Ownership
**Exclusive:** `fxd-cli.ts`

---

## 📋 Tasks

### C.1: Implement create command
**Time:** 1 hour

```typescript
// @agent: agent-cli
// @timestamp: [FILL]
// @task: TRACK-C-CLI.md#C.1

async createDisk(args: any): Promise<void> {
  const name = args._[1];
  if (!name) {
    console.error('❌ Disk name required');
    return;
  }

  const path = args.path || './';
  const projectPath = `${path}/${name}`;

  // Create directory
  await Deno.mkdir(projectPath, { recursive: true });
  await Deno.mkdir(`${projectPath}/.fxd`, { recursive: true });

  // Create config
  const config = {
    name,
    created: Date.now(),
    version: '0.1.0'
  };

  await Deno.writeTextFile(
    `${projectPath}/.fxd/config.json`,
    JSON.stringify(config, null, 2)
  );

  console.log(`✅ Created project: ${projectPath}`);
}
```

### C.2-C.6: Implement remaining commands
**Time:** 4-5 hours

- [ ] C.2: import command (1 hour)
- [ ] C.3: list command (45 min)
- [ ] C.4: export command (1 hour)
- [ ] C.5: run command (1 hour)
- [ ] C.6: visualize command (stub - 15 min)

### C.7: Error handling
**Time:** 1 hour

Add proper error messages, validation, help text.

### C.8: Progress indicators
**Time:** 1 hour

Add spinners/progress bars for long operations.

---

## ✅ Success Criteria
- [ ] All 6 commands functional
- [ ] Good error messages
- [ ] Help text clear
- [ ] Commands tested manually
