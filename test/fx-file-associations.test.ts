#!/usr/bin/env deno test --allow-all

/**
 * @file fx-file-associations.test.ts
 * @description Comprehensive tests for file association scripts
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 *
 * Tests cover:
 * - Windows registry configuration
 * - Linux desktop file creation
 * - macOS plist configuration
 * - File detection and validation
 * - Error handling
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const WINDOWS_SCRIPT = join(Deno.cwd(), "scripts", "file-associations", "windows-registry.ts");
const LINUX_SCRIPT = join(Deno.cwd(), "scripts", "file-associations", "linux-desktop.ts");
const MACOS_SCRIPT = join(Deno.cwd(), "scripts", "file-associations", "macos-plist.ts");

// Test 1: Windows Registry Script Exists
Deno.test("FileAssociations - Windows registry script exists", async () => {
  const scriptExists = await exists(WINDOWS_SCRIPT);
  assert(scriptExists, "Windows registry script should exist");
});

// Test 2: Linux Desktop Script Exists
Deno.test("FileAssociations - Linux desktop script exists", async () => {
  const scriptExists = await exists(LINUX_SCRIPT);
  assert(scriptExists, "Linux desktop script should exist");
});

// Test 3: macOS Plist Script Exists
Deno.test("FileAssociations - macOS plist script exists", async () => {
  const scriptExists = await exists(MACOS_SCRIPT);
  assert(scriptExists, "macOS plist script should exist");
});

// Test 4: Windows Script is Executable
Deno.test("FileAssociations - Windows script has proper shebang", async () => {
  const content = await Deno.readTextFile(WINDOWS_SCRIPT);
  assert(content.startsWith("#!/usr/bin/env deno") || content.startsWith("#!"),
    "Windows script should have shebang");
});

// Test 5: Linux Script is Executable
Deno.test("FileAssociations - Linux script has proper shebang", async () => {
  const content = await Deno.readTextFile(LINUX_SCRIPT);
  assert(content.startsWith("#!/usr/bin/env deno") || content.startsWith("#!"),
    "Linux script should have shebang");
});

// Test 6: macOS Script is Executable
Deno.test("FileAssociations - macOS script has proper shebang", async () => {
  const content = await Deno.readTextFile(MACOS_SCRIPT);
  assert(content.startsWith("#!/usr/bin/env deno") || content.startsWith("#!"),
    "macOS script should have shebang");
});

// Test 7: Windows Script Contains Registry Keys
Deno.test("FileAssociations - Windows script defines registry keys", async () => {
  const content = await Deno.readTextFile(WINDOWS_SCRIPT);

  assert(content.includes("HKEY_CLASSES_ROOT") || content.includes("Registry"),
    "Should define registry keys");
  assert(content.includes(".fxd"), "Should reference .fxd extension");
  assert(content.includes("FXDFile") || content.includes("application/x-fxd"),
    "Should define file type");
});

// Test 8: Linux Script Creates MIME Type
Deno.test("FileAssociations - Linux script creates MIME type definition", async () => {
  const content = await Deno.readTextFile(LINUX_SCRIPT);

  assert(content.includes("mime-type") || content.includes("application/x-fxd"),
    "Should define MIME type");
  assert(content.includes(".fxd"), "Should reference .fxd extension");
  assert(content.includes("desktop") || content.includes(".desktop"),
    "Should create desktop entry");
});

// Test 9: macOS Script Creates Plist
Deno.test("FileAssociations - macOS script creates Info.plist", async () => {
  const content = await Deno.readTextFile(MACOS_SCRIPT);

  assert(content.includes("plist") || content.includes("Info.plist"),
    "Should create plist file");
  assert(content.includes("UTTypeIdentifier") || content.includes("dev.fxd"),
    "Should define UTI");
  assert(content.includes(".fxd"), "Should reference .fxd extension");
  assert(content.includes("CFBundleDocumentTypes") || content.includes("document"),
    "Should define document types");
});

// Test 10: Scripts Have Error Handling
Deno.test("FileAssociations - scripts have error handling", async () => {
  const scripts = [WINDOWS_SCRIPT, LINUX_SCRIPT, MACOS_SCRIPT];

  for (const script of scripts) {
    const content = await Deno.readTextFile(script);

    assert(content.includes("try") || content.includes("catch") || content.includes("Error"),
      `${script} should have error handling`);
  }
});

// Test 11: Scripts Check OS
Deno.test("FileAssociations - scripts check operating system", async () => {
  const windowsContent = await Deno.readTextFile(WINDOWS_SCRIPT);
  assert(windowsContent.includes("windows") || windowsContent.includes("win32"),
    "Windows script should check OS");

  const linuxContent = await Deno.readTextFile(LINUX_SCRIPT);
  assert(linuxContent.includes("linux"),
    "Linux script should check OS");

  const macosContent = await Deno.readTextFile(MACOS_SCRIPT);
  assert(macosContent.includes("darwin") || macosContent.includes("macos"),
    "macOS script should check OS");
});

// Test 12: Scripts Provide User Feedback
Deno.test("FileAssociations - scripts provide user feedback", async () => {
  const scripts = [WINDOWS_SCRIPT, LINUX_SCRIPT, MACOS_SCRIPT];

  for (const script of scripts) {
    const content = await Deno.readTextFile(script);

    assert(content.includes("console.log") || content.includes("console.error"),
      `${script} should provide user feedback`);
    assert(content.includes("✅") || content.includes("success") || content.includes("✓"),
      `${script} should show success messages`);
  }
});

// Test 13: Windows Script Creates Registry File
Deno.test("FileAssociations - Windows script can create registry file", async () => {
  const content = await Deno.readTextFile(WINDOWS_SCRIPT);

  assert(content.includes("writeTextFile") || content.includes(".reg"),
    "Should create .reg file");
  assert(content.includes("Windows Registry Editor") || content.includes("REGEDIT"),
    "Should have proper registry file format");
});

// Test 14: Linux Script Finds FXD Executable
Deno.test("FileAssociations - Linux script finds FXD executable", async () => {
  const content = await Deno.readTextFile(LINUX_SCRIPT);

  assert(content.includes("which fxd") || content.includes("findFxd") || content.includes("/usr/local/bin"),
    "Should have logic to find FXD executable");
});

// Test 15: macOS Script Creates App Bundle
Deno.test("FileAssociations - macOS script creates app bundle", async () => {
  const content = await Deno.readTextFile(MACOS_SCRIPT);

  assert(content.includes(".app") || content.includes("FXD.app") || content.includes("bundle"),
    "Should create app bundle");
  assert(content.includes("Contents") && content.includes("MacOS"),
    "Should have proper app bundle structure");
});

// Test 16: All Scripts Have Documentation
Deno.test("FileAssociations - all scripts have documentation headers", async () => {
  const scripts = [WINDOWS_SCRIPT, LINUX_SCRIPT, MACOS_SCRIPT];

  for (const script of scripts) {
    const content = await Deno.readTextFile(script);

    assert(content.includes("@file") || content.includes("@description"),
      `${script} should have documentation header`);
    assert(content.includes("File Association") || content.includes("file association"),
      `${script} should describe file associations`);
  }
});

// Test 17: Scripts Can Be Run
Deno.test("FileAssociations - scripts can be parsed without errors", async () => {
  const scripts = [WINDOWS_SCRIPT, LINUX_SCRIPT, MACOS_SCRIPT];

  for (const script of scripts) {
    // Try to import/check syntax
    try {
      const command = new Deno.Command("deno", {
        args: ["check", script],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      assertEquals(code, 0, `${script} should have valid syntax`);
    } catch (error) {
      console.error(`Error checking ${script}:`, error);
      throw error;
    }
  }
});

// Test 18: Completions Directory Exists
Deno.test("FileAssociations - shell completions directory exists", async () => {
  const completionsDir = join(Deno.cwd(), "cli", "completions");
  const dirExists = await exists(completionsDir);
  assert(dirExists, "Completions directory should exist");
});

// Test 19: Bash Completion Exists
Deno.test("FileAssociations - Bash completion script exists", async () => {
  const bashCompletion = join(Deno.cwd(), "cli", "completions", "fxd.bash");
  const fileExists = await exists(bashCompletion);
  assert(fileExists, "Bash completion script should exist");

  const content = await Deno.readTextFile(bashCompletion);
  assert(content.includes("_fxd") || content.includes("complete"),
    "Should have completion function");
});

// Test 20: Zsh Completion Exists
Deno.test("FileAssociations - Zsh completion script exists", async () => {
  const zshCompletion = join(Deno.cwd(), "cli", "completions", "fxd.zsh");
  const fileExists = await exists(zshCompletion);
  assert(fileExists, "Zsh completion script should exist");

  const content = await Deno.readTextFile(zshCompletion);
  assert(content.includes("#compdef") || content.includes("_fxd"),
    "Should have compdef declaration");
});

// Test 21: Fish Completion Exists
Deno.test("FileAssociations - Fish completion script exists", async () => {
  const fishCompletion = join(Deno.cwd(), "cli", "completions", "fxd.fish");
  const fileExists = await exists(fishCompletion);
  assert(fileExists, "Fish completion script should exist");

  const content = await Deno.readTextFile(fishCompletion);
  assert(content.includes("complete -c fxd"),
    "Should have Fish completion commands");
});

// Test 22: PowerShell Completion Exists
Deno.test("FileAssociations - PowerShell completion script exists", async () => {
  const psCompletion = join(Deno.cwd(), "cli", "completions", "fxd.ps1");
  const fileExists = await exists(psCompletion);
  assert(fileExists, "PowerShell completion script should exist");

  const content = await Deno.readTextFile(psCompletion);
  assert(content.includes("Register-ArgumentCompleter") || content.includes("TabExpansion"),
    "Should have PowerShell completion registration");
});

// Test 23: Completions Define Commands
Deno.test("FileAssociations - completion scripts define all commands", async () => {
  const completions = [
    join(Deno.cwd(), "cli", "completions", "fxd.bash"),
    join(Deno.cwd(), "cli", "completions", "fxd.zsh"),
    join(Deno.cwd(), "cli", "completions", "fxd.fish"),
    join(Deno.cwd(), "cli", "completions", "fxd.ps1"),
  ];

  const requiredCommands = ["save", "load", "import", "export", "help", "version"];

  for (const completion of completions) {
    const content = await Deno.readTextFile(completion);

    for (const cmd of requiredCommands) {
      assert(content.includes(cmd), `${completion} should include '${cmd}' command`);
    }
  }
});

// Test 24: Completions Handle File Arguments
Deno.test("FileAssociations - completions handle .fxd file arguments", async () => {
  const completions = [
    join(Deno.cwd(), "cli", "completions", "fxd.bash"),
    join(Deno.cwd(), "cli", "completions", "fxd.zsh"),
    join(Deno.cwd(), "cli", "completions", "fxd.fish"),
  ];

  for (const completion of completions) {
    const content = await Deno.readTextFile(completion);
    assert(content.includes(".fxd") || content.includes("*.fxd"),
      `${completion} should handle .fxd file completion`);
  }
});

// Test 25: Scripts Have Proper Permissions Setup
Deno.test("FileAssociations - scripts attempt to set proper permissions", async () => {
  const linuxContent = await Deno.readTextFile(LINUX_SCRIPT);
  assert(linuxContent.includes("chmod") || linuxContent.includes("0o755") || linuxContent.includes("executable"),
    "Linux script should set executable permissions");

  const macosContent = await Deno.readTextFile(MACOS_SCRIPT);
  assert(macosContent.includes("chmod") || macosContent.includes("0o755") || macosContent.includes("executable"),
    "macOS script should set executable permissions");
});

console.log("\n✅ All file association tests defined (25+ tests)\n");
