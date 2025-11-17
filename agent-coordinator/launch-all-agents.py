#!/usr/bin/env python3
"""
Launch all 10 FXD agents in separate Claude Code instances
"""

import subprocess
import time
import json
from pathlib import Path

# Agent configurations
AGENTS = [
    {
        "name": "agent-critical-path",
        "task_file": "CRITICAL-PATH.md",
        "priority": "P0-BLOCKING",
        "description": "Fix core exports (MUST complete first)",
        "prompt": """You are agent-critical-path working on the FXD project.

YOUR TASK FILE: tasks/CRITICAL-PATH.md

CRITICAL INSTRUCTIONS:
1. Read tasks/CRITICAL-PATH.md completely
2. Complete all tasks in order
3. Annotate ALL code you write:
   // @agent: agent-critical-path
   // @timestamp: [current-timestamp]
   // @task: CRITICAL-PATH.md#[task-number]

4. Update progress in task file after each task
5. When complete, create: tasks/.critical-path-complete

THIS IS THE CRITICAL PATH - ALL OTHER AGENTS ARE BLOCKED UNTIL YOU FINISH.

START BY:
1. Reading tasks/CRITICAL-PATH.md
2. Task 0.1: Verify core file (fxn.ts or fx.ts)
3. Task 0.2: Fix core exports

GO!"""
    },
    # Agents 1-9 launched AFTER Agent 0 completes
    {
        "name": "agent-test-infra",
        "task_file": "TRACK-A-TESTS.md",
        "priority": "P0",
        "depends_on": "agent-critical-path",
        "description": "Test infrastructure",
        "prompt": """You are agent-test-infra working on the FXD project.

YOUR TASK FILE: tasks/TRACK-A-TESTS.md

WAIT: Check tasks/.critical-path-complete exists before starting.

YOUR MISSION: Fix all test imports, create test infrastructure, get 15-20 tests passing.

ANNOTATE ALL CODE:
// @agent: agent-test-infra
// @timestamp: [timestamp]
// @task: TRACK-A-TESTS.md#A.[N]

FILES YOU OWN:
- test/*.test.ts (exclusive)
- test/helpers/ (exclusive)

START WITH: Task A.1 - Fix test file imports

GO!"""
    },
    {
        "name": "agent-modules-core",
        "task_file": "TRACK-B-MODULES.md",
        "section": "B1",
        "priority": "P0",
        "depends_on": "agent-critical-path",
        "description": "Core modules (snippets, views, parse)",
        "prompt": """You are agent-modules-core working on the FXD project.

YOUR TASK FILE: tasks/TRACK-B-MODULES.md (SECTION B1)

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Fix imports and integrate core modules.

FILES YOU OWN:
- modules/fx-snippets.ts
- modules/fx-view.ts
- modules/fx-parse.ts
- modules/fx-group-extras.ts

ANNOTATE: // @agent: agent-modules-core

USE IMPORT PATTERN FROM: tasks/IMPORT-FIX-INSTRUCTIONS.md

START WITH: Task B1.1 - Fix fx-snippets.ts

GO!"""
    },
    {
        "name": "agent-modules-persist",
        "task_file": "TRACK-B-MODULES.md",
        "section": "B2",
        "priority": "P0",
        "depends_on": "agent-critical-path",
        "description": "Persistence modules",
        "prompt": """You are agent-modules-persist working on the FXD project.

YOUR TASK FILE: tasks/TRACK-B-MODULES.md (SECTION B2)

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Fix imports in persistence modules.

FILES YOU OWN:
- modules/fx-persistence.ts
- modules/fx-snippet-persistence.ts
- modules/fx-view-persistence.ts
- modules/fx-metadata-persistence.ts

⚠️ COORDINATE with agent-persistence on fx-persistence.ts

ANNOTATE: // @agent: agent-modules-persist

START WITH: Task B2.1

GO!"""
    },
    {
        "name": "agent-modules-io",
        "task_file": "TRACK-B-MODULES.md",
        "section": "B3",
        "priority": "P0",
        "depends_on": "agent-critical-path",
        "description": "Import/Export modules",
        "prompt": """You are agent-modules-io working on the FXD project.

YOUR TASK FILE: tasks/TRACK-B-MODULES.md (SECTION B3)

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Implement import/export functionality.

FILES YOU OWN:
- modules/fx-import.ts
- modules/fx-export.ts

ANNOTATE: // @agent: agent-modules-io

START WITH: Task B3.1 - Fix fx-import.ts imports

GO!"""
    },
    {
        "name": "agent-cli",
        "task_file": "TRACK-C-CLI.md",
        "priority": "P1",
        "depends_on": "agent-critical-path",
        "description": "CLI implementation",
        "prompt": """You are agent-cli working on the FXD project.

YOUR TASK FILE: tasks/TRACK-C-CLI.md

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Implement all CLI commands.

FILE YOU OWN:
- fxd-cli.ts (exclusive)

ANNOTATE: // @agent: agent-cli

START WITH: Task C.1 - Implement create command

GO!"""
    },
    {
        "name": "agent-examples",
        "task_file": "TRACK-D-EXAMPLES.md",
        "priority": "P1",
        "depends_on": "agent-critical-path",
        "description": "Create working examples",
        "prompt": """You are agent-examples working on the FXD project.

YOUR TASK FILE: tasks/TRACK-D-EXAMPLES.md

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Create 6 working, documented examples.

FILES YOU OWN:
- examples/**/*.ts (exclusive)

ANNOTATE: // @agent: agent-examples

START WITH: Task D.1 - Fix existing examples

GO!"""
    },
    {
        "name": "agent-docs",
        "task_file": "TRACK-E-DOCS.md",
        "priority": "P2",
        "depends_on": "agent-critical-path",
        "description": "Documentation cleanup",
        "prompt": """You are agent-docs working on the FXD project.

YOUR TASK FILE: tasks/TRACK-E-DOCS.md

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Update documentation to match reality.

FILES YOU OWN:
- docs/**/*.md (exclusive)
- README.md (exclusive)

ANNOTATE: <!-- @agent: agent-docs -->

START WITH: Task E.1 - Update README.md

GO!"""
    },
    {
        "name": "agent-persistence",
        "task_file": "TRACK-F-PERSISTENCE.md",
        "priority": "P1",
        "depends_on": "agent-critical-path",
        "description": "SQLite persistence layer",
        "prompt": """You are agent-persistence working on the FXD project.

YOUR TASK FILE: tasks/TRACK-F-PERSISTENCE.md

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Create working SQLite persistence layer.

FILES YOU OWN:
- database/ (exclusive)
- schema.sql (exclusive)

⚠️ COORDINATE with agent-modules-persist on fx-persistence.ts

ANNOTATE: -- @agent: agent-persistence (in SQL)

START WITH: Task F.1 - Create schema

GO!"""
    },
    {
        "name": "agent-build",
        "task_file": "TRACK-G-BUILD.md",
        "priority": "P2",
        "depends_on": "agent-critical-path",
        "description": "Build & distribution",
        "prompt": """You are agent-build working on the FXD project.

YOUR TASK FILE: tasks/TRACK-G-BUILD.md

WAIT: Check tasks/.critical-path-complete exists.

YOUR MISSION: Create distributable executables and packages.

FILES YOU OWN:
- scripts/build-*.ts (exclusive)
- dist/ (exclusive)

ANNOTATE: // @agent: agent-build

START WITH: Task G.1 - Test existing executable

GO!"""
    }
]

def launch_agent(agent_config):
    """Launch a Claude Code instance for an agent"""
    print(f"\n{'='*60}")
    print(f"Launching: {agent_config['name']}")
    print(f"Task: {agent_config['task_file']}")
    print(f"Priority: {agent_config['priority']}")
    print(f"Description: {agent_config['description']}")
    print('='*60)

    # Create instruction file for agent
    agent_dir = Path("c:/dev/fxd/agent-coordinator/agents")
    agent_dir.mkdir(exist_ok=True)

    instruction_file = agent_dir / f"{agent_config['name']}-instructions.txt"
    with open(instruction_file, 'w', encoding='utf-8') as f:
        f.write(agent_config['prompt'])

    print(f"[OK] Instructions written to: {instruction_file}")
    print(f"\nTo launch this agent manually:")
    print(f"  claude code c:/dev/fxd")
    print(f"  Then paste the prompt from: {instruction_file}")
    print()

    return instruction_file

def main():
    print("FXD Multi-Agent Launch System")
    print("="*60)

    base_dir = Path("c:/dev/fxd")
    signal_file = base_dir / "tasks" / ".critical-path-complete"

    # Phase 1: Launch Agent 0 (Critical Path)
    print("\nPHASE 1: CRITICAL PATH (Agent 0)")
    print("This agent MUST complete before others can start.\n")

    agent_0 = AGENTS[0]
    instruction_file_0 = launch_agent(agent_0)

    print("WAITING FOR AGENT 0 TO COMPLETE...")
    print(f"   Looking for signal file: {signal_file}")
    print("\n   Agent 0 should create this file when done.")
    print("   Once created, run this script again with --phase2")

    # Check if signal exists
    if signal_file.exists():
        print("\n[OK] SIGNAL FILE EXISTS! Agent 0 has completed!")
        print("   Ready to launch Phase 2 (Agents 1-9)")
        print("\n   Run: python launch-all-agents.py --phase2")
    else:
        print("\n[WAIT] Signal file not found yet.")
        print("   Agent 0 is still working (or hasn't started)")

    # Save agent instructions for Phase 2
    phase2_file = base_dir / "agent-coordinator" / "phase2-agents.json"
    with open(phase2_file, 'w') as f:
        json.dump(AGENTS[1:], f, indent=2)

    print(f"\nPhase 2 agent configs saved to: {phase2_file}")

def launch_phase2():
    """Launch all Phase 2 agents (1-9) in parallel"""
    base_dir = Path("c:/dev/fxd")
    signal_file = base_dir / "tasks" / ".critical-path-complete"

    if not signal_file.exists():
        print("[ERROR] Cannot launch Phase 2")
        print(f"   Signal file not found: {signal_file}")
        print("   Agent 0 must complete first!")
        return

    print("\nPHASE 2: PARALLEL AGENTS (1-9)")
    print("="*60)
    print("Launching all 9 agents simultaneously...\n")

    for agent in AGENTS[1:]:
        instruction_file = launch_agent(agent)
        time.sleep(0.5)  # Small delay between launches

    print("\n[OK] ALL AGENT INSTRUCTIONS GENERATED")
    print("\nTo launch each agent:")
    print("  1. Open 9 Claude Code instances")
    print("  2. Load c:/dev/fxd in each")
    print("  3. Paste the prompt from each agent's instruction file")
    print("\nInstruction files are in: c:/dev/fxd/agent-coordinator/agents/")

if __name__ == '__main__':
    import sys

    if '--phase2' in sys.argv:
        launch_phase2()
    else:
        main()
