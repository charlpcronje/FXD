#!/usr/bin/env python3
"""
FXD Agent Context Manager
Manages agent contexts, memory trimming, and inter-agent communication

Features:
- Backs up agent context every 5 minutes
- Trims context to stay under 200k tokens
- Loads relevant context from other agents when needed
- Maintains code annotation tracking
"""

import json
import time
import re
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import hashlib

@dataclass
class AgentContext:
    """Agent context metadata"""
    agent_name: str
    timestamp: str
    task_file: str
    current_tokens: int
    max_tokens: int = 200000
    messages: List[Dict] = None

    def __post_init__(self):
        if self.messages is None:
            self.messages = []

@dataclass
class CodeAnnotation:
    """Code annotation metadata"""
    file_path: str
    line_number: int
    agent_name: str
    timestamp: str
    task_ref: str
    notes: str = ""

class AgentContextManager:
    """Manages agent contexts and coordination"""

    def __init__(self, base_dir: str = "c:/dev/fxd"):
        self.base_dir = Path(base_dir)
        self.context_dir = self.base_dir / "agent-coordinator" / "contexts"
        self.backup_dir = self.base_dir / "agent-coordinator" / "backups"
        self.annotations_file = self.base_dir / "agent-coordinator" / "annotations.json"

        # Create directories
        self.context_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        # Load annotations index
        self.annotations = self._load_annotations()

        # Track agents
        self.agents: Dict[str, AgentContext] = {}

    def _load_annotations(self) -> Dict[str, List[CodeAnnotation]]:
        """Load code annotations index"""
        if self.annotations_file.exists():
            with open(self.annotations_file, 'r') as f:
                data = json.load(f)
                return {
                    file_path: [CodeAnnotation(**ann) for ann in anns]
                    for file_path, anns in data.items()
                }
        return {}

    def _save_annotations(self):
        """Save annotations index"""
        data = {
            file_path: [asdict(ann) for ann in anns]
            for file_path, anns in self.annotations.items()
        }
        with open(self.annotations_file, 'w') as f:
            json.dump(data, f, indent=2)

    def register_agent(self, agent_name: str, task_file: str):
        """Register a new agent"""
        context = AgentContext(
            agent_name=agent_name,
            timestamp=datetime.now().isoformat(),
            task_file=task_file,
            current_tokens=0
        )
        self.agents[agent_name] = context
        self._save_context(agent_name, context)
        print(f"✅ Registered agent: {agent_name}")

    def add_message(self, agent_name: str, role: str, content: str, tokens: int):
        """Add message to agent context"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent {agent_name} not registered")

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "tokens": tokens
        }

        context = self.agents[agent_name]
        context.messages.append(message)
        context.current_tokens += tokens

        # Check if trimming needed
        if context.current_tokens > context.max_tokens:
            self._trim_context(agent_name)

        self._save_context(agent_name, context)

    def _trim_context(self, agent_name: str):
        """Trim context to stay under limit"""
        context = self.agents[agent_name]

        print(f"⚠️  Agent {agent_name} at {context.current_tokens} tokens, trimming...")

        # Trim in chunks of 20k tokens
        target_tokens = context.max_tokens - 20000

        while context.current_tokens > target_tokens and len(context.messages) > 1:
            # Remove oldest non-system message
            removed = context.messages.pop(1)  # Keep index 0 (system message)
            context.current_tokens -= removed.get('tokens', 0)

        print(f"✅ Trimmed {agent_name} to {context.current_tokens} tokens")
        self._save_context(agent_name, context)

    def _save_context(self, agent_name: str, context: AgentContext):
        """Save agent context"""
        context_file = self.context_dir / f"{agent_name}.json"
        with open(context_file, 'w') as f:
            json.dump(asdict(context), f, indent=2)

    def load_context(self, agent_name: str) -> Optional[AgentContext]:
        """Load agent context"""
        context_file = self.context_dir / f"{agent_name}.json"
        if context_file.exists():
            with open(context_file, 'r') as f:
                data = json.load(f)
                return AgentContext(**data)
        return None

    def backup_all_contexts(self):
        """Backup all agent contexts (run every 5 minutes)"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_subdir = self.backup_dir / timestamp
        backup_subdir.mkdir(exist_ok=True)

        for context_file in self.context_dir.glob("*.json"):
            shutil.copy2(context_file, backup_subdir / context_file.name)

        # Also backup annotations
        if self.annotations_file.exists():
            shutil.copy2(self.annotations_file, backup_subdir / "annotations.json")

        print(f"💾 Backed up contexts to {backup_subdir}")

    def scan_code_annotations(self, file_path: str) -> List[CodeAnnotation]:
        """Scan a file for agent annotations"""
        annotations = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    # Match: // @agent: agent-name
                    if '@agent:' in line:
                        match = re.search(r'@agent:\s*(\S+)', line)
                        if match:
                            agent_name = match.group(1)

                            # Try to find timestamp, task, notes on nearby lines
                            timestamp = ""
                            task_ref = ""
                            notes = ""

                            # Look ahead a few lines
                            f.seek(0)
                            lines = f.readlines()
                            for i in range(line_num, min(line_num + 5, len(lines))):
                                if '@timestamp:' in lines[i]:
                                    timestamp = re.search(r'@timestamp:\s*(.+)', lines[i]).group(1).strip()
                                if '@task:' in lines[i]:
                                    task_ref = re.search(r'@task:\s*(.+)', lines[i]).group(1).strip()
                                if '@notes:' in lines[i]:
                                    notes = re.search(r'@notes:\s*(.+)', lines[i]).group(1).strip()

                            annotation = CodeAnnotation(
                                file_path=str(file_path),
                                line_number=line_num,
                                agent_name=agent_name,
                                timestamp=timestamp,
                                task_ref=task_ref,
                                notes=notes
                            )
                            annotations.append(annotation)

        except Exception as e:
            print(f"⚠️  Error scanning {file_path}: {e}")

        return annotations

    def update_annotations_index(self):
        """Scan all code files and update annotations index"""
        print("🔍 Scanning for code annotations...")

        # Scan TypeScript files
        for ts_file in self.base_dir.glob("**/*.ts"):
            # Skip node_modules, dist, etc.
            if any(skip in str(ts_file) for skip in ['node_modules', 'dist', '.git']):
                continue

            annotations = self.scan_code_annotations(ts_file)
            if annotations:
                self.annotations[str(ts_file)] = annotations

        self._save_annotations()
        print(f"✅ Found {sum(len(a) for a in self.annotations.values())} annotations")

    def get_relevant_context(self, agent_name: str, file_path: str) -> List[Dict]:
        """Get relevant context from other agents who worked on this file"""
        relevant = []

        if file_path in self.annotations:
            for ann in self.annotations[file_path]:
                if ann.agent_name != agent_name:  # Different agent
                    # Load that agent's context from that time
                    other_context = self.load_context(ann.agent_name)
                    if other_context:
                        # Find messages around that timestamp
                        for msg in other_context.messages:
                            if msg.get('timestamp', '').startswith(ann.timestamp[:10]):
                                relevant.append({
                                    'agent': ann.agent_name,
                                    'task': ann.task_ref,
                                    'message': msg,
                                    'notes': ann.notes
                                })

        return relevant

    def get_task_status(self, task_file: str) -> Dict:
        """Get status of a task from task file"""
        task_path = self.base_dir / "tasks" / task_file

        if not task_path.exists():
            return {"status": "not_found"}

        with open(task_path, 'r', encoding='utf-8') as f:
            content = f.read()

            # Count completed tasks
            total_tasks = len(re.findall(r'- \[ \]', content))
            completed = len(re.findall(r'- \[x\]', content))

            # Look for status markers
            status_match = re.search(r'\*\*Status:\*\*\s*([^|\n]+)', content)
            status = status_match.group(1).strip() if status_match else "Unknown"

            return {
                "file": task_file,
                "total_tasks": total_tasks,
                "completed": completed,
                "progress": f"{completed}/{total_tasks}",
                "status": status
            }

    def generate_status_report(self) -> str:
        """Generate overall status report"""
        report = []
        report.append("=" * 60)
        report.append("FXD AGENT STATUS REPORT")
        report.append(f"Generated: {datetime.now().isoformat()}")
        report.append("=" * 60)
        report.append("")

        # Agent status
        report.append("ACTIVE AGENTS:")
        for agent_name, context in self.agents.items():
            report.append(f"  {agent_name}")
            report.append(f"    Task: {context.task_file}")
            report.append(f"    Tokens: {context.current_tokens:,}/{context.max_tokens:,}")
            report.append(f"    Messages: {len(context.messages)}")
            report.append("")

        # Task progress (ASCII only to avoid encoding issues)
        report.append("TASK PROGRESS:")
        tasks_dir = self.base_dir / "tasks"
        if tasks_dir.exists():
            for task_file in tasks_dir.glob("*.md"):
                try:
                    status = self.get_task_status(task_file.name)
                    if status['status'] != 'not_found':
                        report.append(f"  {task_file.name}")
                        report.append(f"    Progress: {status['progress']}")
                        # Strip any unicode characters from status
                        status_str = status['status'].encode('ascii', 'ignore').decode('ascii')
                        report.append(f"    Status: {status_str}")
                        report.append("")
                except Exception as e:
                    report.append(f"  {task_file.name} - Error reading: {str(e)}")
                    report.append("")

        # Code annotations
        report.append("CODE ANNOTATIONS:")
        total_annotations = sum(len(a) for a in self.annotations.values())
        report.append(f"  Total: {total_annotations}")
        report.append(f"  Files: {len(self.annotations)}")
        report.append("")

        return "\n".join(report)

def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="FXD Agent Context Manager")
    parser.add_argument('command', choices=['backup', 'scan', 'status', 'trim', 'daemon'])
    parser.add_argument('--agent', help='Agent name')
    parser.add_argument('--interval', type=int, default=300, help='Backup interval in seconds (default: 300)')

    args = parser.parse_args()

    manager = AgentContextManager()

    if args.command == 'backup':
        manager.backup_all_contexts()

    elif args.command == 'scan':
        manager.update_annotations_index()

    elif args.command == 'status':
        print(manager.generate_status_report())

    elif args.command == 'trim':
        if not args.agent:
            print("Error: --agent required for trim")
            return
        manager._trim_context(args.agent)

    elif args.command == 'daemon':
        print(f"🚀 Starting context manager daemon (interval: {args.interval}s)")
        print("Press Ctrl+C to stop")

        try:
            while True:
                manager.backup_all_contexts()
                manager.update_annotations_index()

                # Print status
                print(f"\n{datetime.now().isoformat()}")
                print(f"Agents: {len(manager.agents)}")
                print(f"Annotations: {sum(len(a) for a in manager.annotations.values())}")

                time.sleep(args.interval)

        except KeyboardInterrupt:
            print("\n\n👋 Daemon stopped")

if __name__ == '__main__':
    main()
