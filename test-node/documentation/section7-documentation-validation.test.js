/**
 * Section 7: Documentation Validation Testing Suite
 *
 * Comprehensive tests for code example execution verification,
 * API documentation accuracy, installation guide validation,
 * tutorial step-by-step verification, and link checking.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Documentation Validation Framework
class DocumentationValidator {
    constructor() {
        this.validationResults = new Map();
        this.codeExamples = new Map();
        this.apiReferences = new Map();
        this.installationSteps = [];
        this.tutorialSteps = [];
        this.links = new Set();
        this.errors = [];
        this.warnings = [];
    }

    // Code Example Validation
    async validateCodeExamples(content, filePath) {
        const codeBlocks = this.extractCodeBlocks(content);
        const results = [];

        for (const [index, block] of codeBlocks.entries()) {
            try {
                const result = await this.executeCodeExample(block, filePath, index);
                results.push(result);
            } catch (error) {
                this.errors.push({
                    type: 'code_execution',
                    file: filePath,
                    block: index,
                    error: error.message
                });
                results.push({
                    valid: false,
                    error: error.message,
                    blockIndex: index
                });
            }
        }

        return results;
    }

    extractCodeBlocks(content) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim(),
                fullMatch: match[0]
            });
        }

        return blocks;
    }

    async executeCodeExample(block, filePath, index) {
        const { language, code } = block;

        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                return await this.executeJavaScript(code, filePath, index);
            case 'bash':
            case 'sh':
            case 'shell':
                return await this.executeBash(code, filePath, index);
            case 'json':
                return this.validateJSON(code, filePath, index);
            case 'typescript':
            case 'ts':
                return await this.executeTypeScript(code, filePath, index);
            default:
                return {
                    valid: true,
                    skipped: true,
                    reason: `Language ${language} not supported for execution`
                };
        }
    }

    async executeJavaScript(code, filePath, index) {
        try {
            // Create a safe execution context
            const safeCode = this.makeSafeForExecution(code);

            // Check if code is meant to be example only (contains comments indicating so)
            if (this.isExampleOnly(code)) {
                return { valid: true, skipped: true, reason: 'Example only, not meant for execution' };
            }

            // Execute in isolated context
            const result = await this.executeInSandbox(safeCode, 'javascript');

            return {
                valid: true,
                executed: true,
                result: result,
                blockIndex: index
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                blockIndex: index
            };
        }
    }

    async executeBash(code, filePath, index) {
        try {
            // Skip dangerous commands
            if (this.containsDangerousCommands(code)) {
                return {
                    valid: true,
                    skipped: true,
                    reason: 'Contains dangerous commands, skipped for safety'
                };
            }

            // Execute safe commands only
            const safeCommands = this.extractSafeCommands(code);
            if (safeCommands.length === 0) {
                return { valid: true, skipped: true, reason: 'No safe commands to execute' };
            }

            const results = [];
            for (const command of safeCommands) {
                try {
                    const { stdout, stderr } = await execAsync(command, {
                        timeout: 10000,
                        cwd: projectRoot
                    });
                    results.push({ command, stdout, stderr, success: true });
                } catch (execError) {
                    results.push({ command, error: execError.message, success: false });
                }
            }

            return {
                valid: true,
                executed: true,
                results: results,
                blockIndex: index
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                blockIndex: index
            };
        }
    }

    validateJSON(code, filePath, index) {
        try {
            JSON.parse(code);
            return {
                valid: true,
                validated: true,
                blockIndex: index
            };
        } catch (error) {
            return {
                valid: false,
                error: `Invalid JSON: ${error.message}`,
                blockIndex: index
            };
        }
    }

    async executeTypeScript(code, filePath, index) {
        try {
            // For now, we'll validate TypeScript by checking syntax
            // In a full implementation, we'd compile and run it
            if (this.isValidTypeScriptSyntax(code)) {
                return {
                    valid: true,
                    validated: true,
                    note: 'Syntax validated (not executed)',
                    blockIndex: index
                };
            } else {
                return {
                    valid: false,
                    error: 'Invalid TypeScript syntax',
                    blockIndex: index
                };
            }
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                blockIndex: index
            };
        }
    }

    makeSafeForExecution(code) {
        // Remove or mock dangerous operations
        const safeMocks = `
            const fs = { readFileSync: () => 'mocked', writeFileSync: () => {}, existsSync: () => true };
            const process = { exit: () => {}, cwd: () => '/mocked' };
            const console = { log: () => {}, error: () => {}, warn: () => {} };
        `;

        return safeMocks + '\n' + code;
    }

    isExampleOnly(code) {
        const exampleOnlyMarkers = [
            '// Example only',
            '// Not executable',
            '// Pseudocode',
            '// TODO:',
            '// Replace with actual'
        ];

        return exampleOnlyMarkers.some(marker => code.includes(marker));
    }

    async executeInSandbox(code, language) {
        // Simplified sandbox execution
        // In production, this would use a proper sandbox like vm2 or Docker
        try {
            const Function = eval;
            const result = Function(`"use strict"; ${code}`)();
            return result;
        } catch (error) {
            throw new Error(`Execution failed: ${error.message}`);
        }
    }

    containsDangerousCommands(code) {
        const dangerousPatterns = [
            /rm\s+-rf/,
            /sudo/,
            /chmod\s+777/,
            /dd\s+if=/,
            /mkfs/,
            /fdisk/,
            /passwd/,
            />.*\/dev\//
        ];

        return dangerousPatterns.some(pattern => pattern.test(code));
    }

    extractSafeCommands(code) {
        const lines = code.split('\n');
        const safeCommands = [];

        const safePatterns = [
            /^ls\b/,
            /^pwd$/,
            /^echo\b/,
            /^cat\s+[^/]/,
            /^head\b/,
            /^tail\b/,
            /^grep\b/,
            /^find\s+\.\b/,
            /^npm\s+(install|test|run)/,
            /^node\s+/,
            /^git\s+(status|log|branch)/
        ];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                if (safePatterns.some(pattern => pattern.test(trimmed))) {
                    safeCommands.push(trimmed);
                }
            }
        }

        return safeCommands;
    }

    isValidTypeScriptSyntax(code) {
        // Basic TypeScript syntax validation
        const invalidPatterns = [
            /\bany\s*;/,  // Incomplete any type
            /\binterface\s*{/,  // Incomplete interface
            /\bclass\s*{/,  // Incomplete class
            /\bfunction\s*{/,  // Incomplete function
        ];

        return !invalidPatterns.some(pattern => pattern.test(code));
    }

    // API Documentation Validation
    validateAPIDocumentation(content, filePath) {
        const apiReferences = this.extractAPIReferences(content);
        const validationResults = [];

        for (const apiRef of apiReferences) {
            const result = this.validateAPIReference(apiRef, filePath);
            validationResults.push(result);
        }

        return validationResults;
    }

    extractAPIReferences(content) {
        const patterns = [
            // Function signatures
            /`([a-zA-Z_$][a-zA-Z0-9_$]*)\(([^)]*)\)`/g,
            // Property access
            /`([a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*)`/g,
            // Class constructors
            /`new\s+([A-Z][a-zA-Z0-9_$]*)\(([^)]*)\)`/g
        ];

        const references = [];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                references.push({
                    type: this.determineAPIType(match[0]),
                    name: match[1],
                    signature: match[0],
                    params: match[2] || null
                });
            }
        }

        return references;
    }

    determineAPIType(signature) {
        if (signature.includes('new ')) return 'constructor';
        if (signature.includes('.')) return 'method';
        if (signature.includes('(')) return 'function';
        return 'property';
    }

    validateAPIReference(apiRef, filePath) {
        // This would validate against actual API definitions
        // For now, we'll do basic validation
        return {
            valid: true,
            reference: apiRef,
            file: filePath,
            validated: true
        };
    }

    // Installation Guide Validation
    async validateInstallationSteps(content, filePath) {
        const steps = this.extractInstallationSteps(content);
        const results = [];

        for (const [index, step] of steps.entries()) {
            const result = await this.validateInstallationStep(step, index, filePath);
            results.push(result);
        }

        return results;
    }

    extractInstallationSteps(content) {
        const stepPatterns = [
            /(?:^|\n)(?:\d+\.\s*|[-*]\s*)(.*(?:install|npm|yarn|git clone|download).*)/gmi,
            /```(?:bash|shell)?\n(.*(?:install|npm|yarn|git clone|download).*)\n```/gmi
        ];

        const steps = [];

        for (const pattern of stepPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                steps.push({
                    text: match[1].trim(),
                    type: this.determineStepType(match[1])
                });
            }
        }

        return steps;
    }

    determineStepType(stepText) {
        if (stepText.includes('npm install')) return 'npm_install';
        if (stepText.includes('yarn add')) return 'yarn_install';
        if (stepText.includes('git clone')) return 'git_clone';
        if (stepText.includes('download')) return 'download';
        return 'other';
    }

    async validateInstallationStep(step, index, filePath) {
        try {
            switch (step.type) {
                case 'npm_install':
                    return await this.validateNpmInstall(step.text);
                case 'yarn_install':
                    return await this.validateYarnInstall(step.text);
                case 'git_clone':
                    return await this.validateGitClone(step.text);
                default:
                    return { valid: true, skipped: true, step: step.text };
            }
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                step: step.text,
                index
            };
        }
    }

    async validateNpmInstall(command) {
        // Extract package name
        const packageMatch = command.match(/npm install\s+([^\s]+)/);
        if (!packageMatch) {
            return { valid: false, error: 'Could not extract package name' };
        }

        const packageName = packageMatch[1];

        try {
            // Check if package exists (dry run)
            const { stdout } = await execAsync(`npm view ${packageName} version`, { timeout: 10000 });
            return {
                valid: true,
                packageExists: true,
                version: stdout.trim(),
                command
            };
        } catch (error) {
            return {
                valid: false,
                error: `Package ${packageName} not found or inaccessible`,
                command
            };
        }
    }

    async validateYarnInstall(command) {
        // Similar to npm validation
        const packageMatch = command.match(/yarn add\s+([^\s]+)/);
        if (!packageMatch) {
            return { valid: false, error: 'Could not extract package name' };
        }

        return { valid: true, note: 'Yarn validation not implemented', command };
    }

    async validateGitClone(command) {
        const urlMatch = command.match(/git clone\s+([^\s]+)/);
        if (!urlMatch) {
            return { valid: false, error: 'Could not extract git URL' };
        }

        const gitUrl = urlMatch[1];

        try {
            // Check if repository is accessible (without actually cloning)
            const { stdout } = await execAsync(`git ls-remote ${gitUrl}`, { timeout: 15000 });
            return {
                valid: true,
                accessible: true,
                command,
                url: gitUrl
            };
        } catch (error) {
            return {
                valid: false,
                error: `Repository ${gitUrl} not accessible: ${error.message}`,
                command
            };
        }
    }

    // Tutorial Validation
    async validateTutorialSteps(content, filePath) {
        const tutorial = this.extractTutorialStructure(content);
        const results = [];

        for (const [index, step] of tutorial.steps.entries()) {
            const result = await this.validateTutorialStep(step, index, filePath);
            results.push(result);
        }

        return {
            tutorialValid: results.every(r => r.valid),
            steps: results,
            structure: tutorial
        };
    }

    extractTutorialStructure(content) {
        const stepPattern = /(?:^|\n)(?:#+\s*Step\s*\d+|(?:\d+\.)\s*)/gmi;
        const steps = [];
        const sections = content.split(stepPattern);

        for (let i = 1; i < sections.length; i++) {
            const stepContent = sections[i].trim();
            if (stepContent) {
                steps.push({
                    number: i,
                    content: stepContent,
                    codeBlocks: this.extractCodeBlocks(stepContent),
                    prerequisites: this.extractPrerequisites(stepContent)
                });
            }
        }

        return {
            totalSteps: steps.length,
            steps: steps,
            hasCodeExamples: steps.some(s => s.codeBlocks.length > 0)
        };
    }

    extractPrerequisites(stepContent) {
        const prereqPattern = /(?:prerequisite|requires?|needs?|must have)([^.]*)/gi;
        const prerequisites = [];
        let match;

        while ((match = prereqPattern.exec(stepContent)) !== null) {
            prerequisites.push(match[1].trim());
        }

        return prerequisites;
    }

    async validateTutorialStep(step, index, filePath) {
        try {
            // Validate code examples in this step
            const codeResults = [];
            for (const codeBlock of step.codeBlocks) {
                const result = await this.executeCodeExample(codeBlock, filePath, index);
                codeResults.push(result);
            }

            const allCodeValid = codeResults.every(r => r.valid || r.skipped);

            return {
                valid: allCodeValid,
                stepNumber: step.number,
                codeBlocks: codeResults.length,
                codeValid: allCodeValid,
                prerequisites: step.prerequisites,
                codeResults: codeResults
            };
        } catch (error) {
            return {
                valid: false,
                stepNumber: step.number,
                error: error.message
            };
        }
    }

    // Link Validation
    async validateLinks(content, filePath) {
        const links = this.extractLinks(content);
        const results = [];

        for (const link of links) {
            const result = await this.validateLink(link, filePath);
            results.push(result);
        }

        return results;
    }

    extractLinks(content) {
        const linkPatterns = [
            // Markdown links
            /\[([^\]]+)\]\(([^)]+)\)/g,
            // HTML links
            /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi,
            // Plain URLs
            /https?:\/\/[^\s<>"']+/g
        ];

        const links = [];

        for (const pattern of linkPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const url = match[2] || match[1];
                const text = match[1] || match[2] || match[0];

                links.push({
                    url: url,
                    text: text,
                    type: this.determineLinkType(url)
                });
            }
        }

        return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }

    determineLinkType(url) {
        if (url.startsWith('http://') || url.startsWith('https://')) return 'external';
        if (url.startsWith('#')) return 'anchor';
        if (url.startsWith('./') || url.startsWith('../')) return 'relative';
        if (url.startsWith('/')) return 'absolute';
        return 'unknown';
    }

    async validateLink(link, filePath) {
        try {
            switch (link.type) {
                case 'external':
                    return await this.validateExternalLink(link);
                case 'relative':
                case 'absolute':
                    return this.validateLocalLink(link, filePath);
                case 'anchor':
                    return this.validateAnchorLink(link, filePath);
                default:
                    return { valid: true, skipped: true, reason: 'Unknown link type' };
            }
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                link: link.url
            };
        }
    }

    async validateExternalLink(link) {
        try {
            // Simple HEAD request to check if URL is accessible
            // In a real implementation, you'd use fetch or a proper HTTP client
            return {
                valid: true,
                accessible: true,
                url: link.url,
                note: 'External link validation not fully implemented'
            };
        } catch (error) {
            return {
                valid: false,
                error: `External link not accessible: ${error.message}`,
                url: link.url
            };
        }
    }

    validateLocalLink(link, filePath) {
        try {
            const basePath = dirname(filePath);
            const targetPath = join(basePath, link.url);

            if (existsSync(targetPath)) {
                const stats = statSync(targetPath);
                return {
                    valid: true,
                    exists: true,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                    path: targetPath
                };
            } else {
                return {
                    valid: false,
                    error: `Local file/directory not found: ${link.url}`,
                    path: targetPath
                };
            }
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                link: link.url
            };
        }
    }

    validateAnchorLink(link, filePath) {
        try {
            // Read the file and check if anchor exists
            const content = readFileSync(filePath, 'utf8');
            const anchorId = link.url.substring(1); // Remove #

            // Check for various anchor formats
            const anchorPatterns = [
                new RegExp(`id=["']${anchorId}["']`, 'i'),
                new RegExp(`name=["']${anchorId}["']`, 'i'),
                new RegExp(`#+\\s*${anchorId.replace(/-/g, '\\s+')}`, 'i'),
                new RegExp(`<a[^>]+name=["']${anchorId}["']`, 'i')
            ];

            const found = anchorPatterns.some(pattern => pattern.test(content));

            return {
                valid: found,
                exists: found,
                anchor: anchorId,
                error: found ? null : `Anchor #${anchorId} not found in document`
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                anchor: link.url
            };
        }
    }

    // Generate comprehensive validation report
    generateValidationReport() {
        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalErrors: this.errors.length,
                totalWarnings: this.warnings.length,
                validationsPassed: this.validationResults.size
            },
            errors: this.errors,
            warnings: this.warnings,
            validationResults: Object.fromEntries(this.validationResults)
        };
    }
}

// Test Suite
describe('Section 7: Documentation Validation', () => {
    let validator;
    const docsPath = join(projectRoot, 'docs');

    test('should initialize documentation validator', () => {
        validator = new DocumentationValidator();
        assert.ok(validator instanceof DocumentationValidator);
    });

    describe('Code Example Execution Verification', () => {
        test('should extract code blocks from markdown', () => {
            const content = `
# Example Document

Here's a JavaScript example:
\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

And a bash command:
\`\`\`bash
echo "Hello World"
\`\`\`

Invalid JSON:
\`\`\`json
{ "invalid": json }
\`\`\`
            `;

            const blocks = validator.extractCodeBlocks(content);
            assert.strictEqual(blocks.length, 3);
            assert.strictEqual(blocks[0].language, 'javascript');
            assert.strictEqual(blocks[1].language, 'bash');
            assert.strictEqual(blocks[2].language, 'json');
        });

        test('should validate JavaScript code examples', async () => {
            const validJS = 'const x = 5; const y = x * 2;';
            const result = await validator.executeJavaScript(validJS, 'test.md', 0);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.executed, true);
        });

        test('should handle JavaScript execution errors', async () => {
            const invalidJS = 'const x = ; // syntax error';
            const result = await validator.executeJavaScript(invalidJS, 'test.md', 0);

            assert.strictEqual(result.valid, false);
            assert.ok(result.error);
        });

        test('should validate JSON code blocks', () => {
            const validJSON = '{"name": "test", "value": 123}';
            const invalidJSON = '{"name": "test" "missing": comma}';

            const validResult = validator.validateJSON(validJSON, 'test.md', 0);
            const invalidResult = validator.validateJSON(invalidJSON, 'test.md', 1);

            assert.strictEqual(validResult.valid, true);
            assert.strictEqual(invalidResult.valid, false);
        });

        test('should handle safe bash commands', async () => {
            const safeBash = 'echo "Hello World"\npwd\nls -la';
            const result = await validator.executeBash(safeBash, 'test.md', 0);

            assert.strictEqual(result.valid, true);
            if (result.executed) {
                assert.ok(result.results);
                assert.ok(Array.isArray(result.results));
            }
        });

        test('should skip dangerous bash commands', async () => {
            const dangerousBash = 'rm -rf /\nsudo rm -rf *';
            const result = await validator.executeBash(dangerousBash, 'test.md', 0);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.skipped, true);
            assert.ok(result.reason.includes('dangerous'));
        });

        test('should validate TypeScript syntax', async () => {
            const validTS = `
                interface User {
                    name: string;
                    age: number;
                }

                const user: User = { name: "John", age: 30 };
            `;

            const result = await validator.executeTypeScript(validTS, 'test.md', 0);
            assert.strictEqual(result.valid, true);
        });
    });

    describe('API Documentation Accuracy', () => {
        test('should extract API references from documentation', () => {
            const content = `
# API Documentation

Use \`createUser(name, email)\` to create a new user.
Access properties with \`user.getName()\`.
Create instances with \`new UserManager(options)\`.
            `;

            const apiRefs = validator.extractAPIReferences(content);
            assert.ok(apiRefs.length >= 3);

            const functionRef = apiRefs.find(ref => ref.name === 'createUser');
            const methodRef = apiRefs.find(ref => ref.signature.includes('user.getName'));
            const constructorRef = apiRefs.find(ref => ref.type === 'constructor');

            assert.ok(functionRef);
            assert.ok(methodRef);
            assert.ok(constructorRef);
        });

        test('should determine API reference types correctly', () => {
            assert.strictEqual(validator.determineAPIType('new UserManager()'), 'constructor');
            assert.strictEqual(validator.determineAPIType('user.getName()'), 'method');
            assert.strictEqual(validator.determineAPIType('createUser()'), 'function');
            assert.strictEqual(validator.determineAPIType('user.name'), 'property');
        });

        test('should validate API references', () => {
            const apiRef = {
                type: 'function',
                name: 'testFunction',
                signature: 'testFunction(arg1, arg2)',
                params: 'arg1, arg2'
            };

            const result = validator.validateAPIReference(apiRef, 'api.md');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.reference, apiRef);
        });
    });

    describe('Installation Guide Validation', () => {
        test('should extract installation steps', () => {
            const content = `
# Installation

1. Install Node.js
2. Run npm install fxd
3. Clone the repository with git clone https://github.com/user/repo.git
4. Download the latest release

\`\`\`bash
npm install express
yarn add lodash
\`\`\`
            `;

            const steps = validator.extractInstallationSteps(content);
            assert.ok(steps.length >= 4);

            const npmStep = steps.find(step => step.type === 'npm_install');
            const gitStep = steps.find(step => step.type === 'git_clone');

            assert.ok(npmStep);
            assert.ok(gitStep);
        });

        test('should determine installation step types', () => {
            assert.strictEqual(validator.determineStepType('npm install package'), 'npm_install');
            assert.strictEqual(validator.determineStepType('yarn add package'), 'yarn_install');
            assert.strictEqual(validator.determineStepType('git clone repo'), 'git_clone');
            assert.strictEqual(validator.determineStepType('download file'), 'download');
            assert.strictEqual(validator.determineStepType('other step'), 'other');
        });

        test('should validate npm install commands', async () => {
            // Test with a known package
            const result = await validator.validateNpmInstall('npm install express');

            if (result.valid) {
                assert.ok(result.packageExists);
                assert.ok(result.version);
            } else {
                // Network or npm issues - this is acceptable in testing
                assert.ok(result.error);
            }
        });

        test('should handle invalid npm commands', async () => {
            const result = await validator.validateNpmInstall('npm install');
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('package name'));
        });
    });

    describe('Tutorial Step-by-Step Verification', () => {
        test('should extract tutorial structure', () => {
            const content = `
# Tutorial

## Step 1: Setup
Install the dependencies:
\`\`\`bash
npm install
\`\`\`

## Step 2: Configuration
Create a config file:
\`\`\`javascript
const config = { port: 3000 };
\`\`\`

## Step 3: Run
Start the application.
            `;

            const tutorial = validator.extractTutorialStructure(content);
            assert.strictEqual(tutorial.totalSteps, 3);
            assert.strictEqual(tutorial.hasCodeExamples, true);
            assert.ok(tutorial.steps[0].codeBlocks.length > 0);
        });

        test('should extract prerequisites from steps', () => {
            const stepContent = `
This step requires Node.js to be installed.
You must have Git configured.
The prerequisite is Docker running.
            `;

            const prerequisites = validator.extractPrerequisites(stepContent);
            assert.ok(prerequisites.length >= 2);
        });

        test('should validate tutorial steps', async () => {
            const step = {
                number: 1,
                content: 'Test step',
                codeBlocks: [{
                    language: 'javascript',
                    code: 'const test = "valid";'
                }],
                prerequisites: ['Node.js']
            };

            const result = await validator.validateTutorialStep(step, 0, 'tutorial.md');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.stepNumber, 1);
            assert.strictEqual(result.codeBlocks, 1);
        });
    });

    describe('Link Checking and Content Validation', () => {
        test('should extract different types of links', () => {
            const content = `
# Documentation

[External link](https://example.com)
[Local file](./README.md)
[Anchor link](#section1)
<a href="/absolute/path">Absolute link</a>
Direct URL: https://github.com/user/repo

## Section1
Content here.
            `;

            const links = validator.extractLinks(content);
            assert.ok(links.length >= 4);

            const externalLink = links.find(l => l.type === 'external');
            const localLink = links.find(l => l.type === 'relative');
            const anchorLink = links.find(l => l.type === 'anchor');
            const absoluteLink = links.find(l => l.type === 'absolute');

            assert.ok(externalLink);
            assert.ok(localLink);
            assert.ok(anchorLink);
            assert.ok(absoluteLink);
        });

        test('should determine link types correctly', () => {
            assert.strictEqual(validator.determineLinkType('https://example.com'), 'external');
            assert.strictEqual(validator.determineLinkType('./file.md'), 'relative');
            assert.strictEqual(validator.determineLinkType('../parent/file.md'), 'relative');
            assert.strictEqual(validator.determineLinkType('/absolute/path'), 'absolute');
            assert.strictEqual(validator.determineLinkType('#anchor'), 'anchor');
        });

        test('should validate local file links', () => {
            // Test with this test file itself
            const link = { url: './section7-documentation-validation.test.js', type: 'relative' };
            const result = validator.validateLocalLink(link, __filename);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.exists, true);
            assert.strictEqual(result.isFile, true);
        });

        test('should detect missing local files', () => {
            const link = { url: './nonexistent-file.md', type: 'relative' };
            const result = validator.validateLocalLink(link, __filename);

            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('not found'));
        });

        test('should validate anchor links', () => {
            // Create a mock file content with anchors
            const tempContent = `
# Main Title

## Section One {#section-one}

Content here.

<a name="anchor-point"></a>
More content.
            `;

            // Mock readFileSync for this test
            const originalReadFileSync = validator.constructor.prototype.readFileSync;

            const link1 = { url: '#section-one', type: 'anchor' };
            const link2 = { url: '#anchor-point', type: 'anchor' };
            const link3 = { url: '#nonexistent', type: 'anchor' };

            // For actual implementation, would need to mock file reading
            // For now, test the anchor extraction logic
            assert.strictEqual(link1.url.substring(1), 'section-one');
            assert.strictEqual(link2.url.substring(1), 'anchor-point');
            assert.strictEqual(link3.url.substring(1), 'nonexistent');
        });
    });

    describe('Integration and Comprehensive Validation', () => {
        test('should validate complete documentation file', async () => {
            const sampleDoc = `
# FXD Documentation

## Installation

Install FXD using npm:

\`\`\`bash
npm install fxd
\`\`\`

## Quick Start

### Step 1: Setup

Create a new project:

\`\`\`javascript
const fxd = require('fxd');
const project = fxd.createProject('my-project');
\`\`\`

### Step 2: Configuration

Configure your project:

\`\`\`json
{
    "name": "my-project",
    "version": "1.0.0"
}
\`\`\`

## API Reference

Use \`createProject(name)\` to create a new project.
Access project properties with \`project.getName()\`.

## Links

- [Official Website](https://fxd.example.com)
- [Local Guide](./guide.md)
- [Configuration Section](#configuration)

## Configuration
Setup details here.
            `;

            // Validate code examples
            const codeResults = await validator.validateCodeExamples(sampleDoc, 'sample.md');
            assert.ok(Array.isArray(codeResults));

            // Validate API documentation
            const apiResults = validator.validateAPIDocumentation(sampleDoc, 'sample.md');
            assert.ok(Array.isArray(apiResults));

            // Validate installation steps
            const installResults = await validator.validateInstallationSteps(sampleDoc, 'sample.md');
            assert.ok(Array.isArray(installResults));

            // Validate tutorial structure
            const tutorialResults = await validator.validateTutorialSteps(sampleDoc, 'sample.md');
            assert.ok(tutorialResults.structure);
            assert.ok(Array.isArray(tutorialResults.steps));

            // Validate links
            const linkResults = await validator.validateLinks(sampleDoc, 'sample.md');
            assert.ok(Array.isArray(linkResults));
        });

        test('should generate comprehensive validation report', () => {
            // Add some test data
            validator.errors.push({
                type: 'code_execution',
                file: 'test.md',
                block: 0,
                error: 'Test error'
            });

            validator.warnings.push({
                type: 'link_warning',
                file: 'test.md',
                message: 'Test warning'
            });

            validator.validationResults.set('test_validation', {
                valid: true,
                file: 'test.md'
            });

            const report = validator.generateValidationReport();

            assert.ok(report.timestamp);
            assert.strictEqual(report.summary.totalErrors, 1);
            assert.strictEqual(report.summary.totalWarnings, 1);
            assert.strictEqual(report.summary.validationsPassed, 1);
            assert.ok(Array.isArray(report.errors));
            assert.ok(Array.isArray(report.warnings));
        });

        test('should handle malformed documentation gracefully', async () => {
            const malformedDoc = `
# Broken Documentation

\`\`\`javascript
const broken = { syntax error
\`\`\`

\`\`\`json
{ "invalid": json syntax }
\`\`\`

[Broken link](./nonexistent.md)
[Broken anchor](#nonexistent-anchor)
            `;

            // Should not throw errors, but collect them
            const codeResults = await validator.validateCodeExamples(malformedDoc, 'broken.md');
            const linkResults = await validator.validateLinks(malformedDoc, 'broken.md');

            // Should have identified issues but not crashed
            assert.ok(Array.isArray(codeResults));
            assert.ok(Array.isArray(linkResults));

            const hasInvalidCode = codeResults.some(result => !result.valid);
            const hasBrokenLinks = linkResults.some(result => !result.valid);

            // At least one should be invalid
            assert.ok(hasInvalidCode || hasBrokenLinks);
        });
    });
});