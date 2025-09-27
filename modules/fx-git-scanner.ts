/**
 * @file fx-git-scanner.ts
 * @description Git Repository Scanner for FXD
 * Provides comprehensive scanning and discovery of Git repositories
 */

import { FXCore } from "../fx.ts";

/**
 * Git repository information
 */
export interface GitRepository {
  id: string;
  path: string;
  name: string;
  remotes: GitRemote[];
  branches: GitBranch[];
  currentBranch: string;
  status: GitStatus;
  lastCommit: GitCommit;
  stats: GitStats;
  config: GitConfig;
  discovered: number;
  lastScan: number;
}

/**
 * Git remote information
 */
export interface GitRemote {
  name: string;
  url: string;
  type: "fetch" | "push";
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string;
  commit: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  isActive: boolean;
}

/**
 * Git status information
 */
export interface GitStatus {
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  conflicts: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

/**
 * Git file status
 */
export interface GitFileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unmerged";
  oldPath?: string; // For renames
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  author: GitAuthor;
  committer: GitAuthor;
  message: string;
  date: number;
  parents: string[];
}

/**
 * Git author/committer information
 */
export interface GitAuthor {
  name: string;
  email: string;
  date: number;
}

/**
 * Git repository statistics
 */
export interface GitStats {
  totalCommits: number;
  totalBranches: number;
  totalTags: number;
  totalFiles: number;
  repositorySize: number;
  contributors: GitContributor[];
  languages: Record<string, number>;
  activity: GitActivity[];
}

/**
 * Git contributor information
 */
export interface GitContributor {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: number;
  lastCommit: number;
}

/**
 * Git activity information
 */
export interface GitActivity {
  date: string; // YYYY-MM-DD
  commits: number;
  additions: number;
  deletions: number;
}

/**
 * Git configuration
 */
export interface GitConfig {
  userName?: string;
  userEmail?: string;
  remote?: {
    origin?: string;
  };
  branch?: {
    default?: string;
  };
  core?: {
    editor?: string;
    autocrlf?: boolean;
  };
}

/**
 * Scan options
 */
export interface ScanOptions {
  maxDepth?: number;
  includeSubmodules?: boolean;
  includeBareRepos?: boolean;
  followSymlinks?: boolean;
  skipHidden?: boolean;
  patterns?: {
    include?: string[];
    exclude?: string[];
  };
  parallel?: boolean;
  maxParallel?: number;
}

/**
 * Git Repository Scanner
 * Discovers and analyzes Git repositories in the filesystem
 */
export class GitScanner {
  private fx: FXCore;
  private repositories = new Map<string, GitRepository>();
  private scanInProgress = false;

  constructor(fx: FXCore) {
    this.fx = fx;
    this._initializeStorage();
  }

  /**
   * Scan for Git repositories in a directory
   */
  async scan(searchPath: string, options: ScanOptions = {}): Promise<GitRepository[]> {
    if (this.scanInProgress) {
      throw new Error("Scan already in progress");
    }

    const scanOptions: Required<ScanOptions> = {
      maxDepth: options.maxDepth ?? 10,
      includeSubmodules: options.includeSubmodules ?? true,
      includeBareRepos: options.includeBareRepos ?? true,
      followSymlinks: options.followSymlinks ?? false,
      skipHidden: options.skipHidden ?? true,
      patterns: {
        include: options.patterns?.include ?? [],
        exclude: options.patterns?.exclude ?? [
          'node_modules',
          '.cache',
          '.tmp',
          'build',
          'dist',
          'out'
        ]
      },
      parallel: options.parallel ?? true,
      maxParallel: options.maxParallel ?? 5
    };

    this.scanInProgress = true;
    const startTime = Date.now();

    try {
      console.log(`🔍 Starting Git repository scan in: ${searchPath}`);
      console.log(`📊 Options:`, scanOptions);

      const foundPaths = await this._findGitRepositories(searchPath, scanOptions);
      console.log(`📂 Found ${foundPaths.length} Git repositories`);

      const repositories: GitRepository[] = [];

      if (scanOptions.parallel) {
        // Process repositories in parallel batches
        const batches = this._createBatches(foundPaths, scanOptions.maxParallel);

        for (const batch of batches) {
          const batchResults = await Promise.all(
            batch.map(path => this._analyzeRepository(path).catch(error => {
              console.warn(`⚠️ Failed to analyze repository at ${path}:`, error.message);
              return null;
            }))
          );

          repositories.push(...batchResults.filter(repo => repo !== null) as GitRepository[]);
        }
      } else {
        // Process repositories sequentially
        for (const path of foundPaths) {
          try {
            const repo = await this._analyzeRepository(path);
            repositories.push(repo);
          } catch (error) {
            console.warn(`⚠️ Failed to analyze repository at ${path}:`, error.message);
          }
        }
      }

      // Store results
      for (const repo of repositories) {
        this.repositories.set(repo.id, repo);
        this.fx.proxy(`git.repositories.${repo.id}`).val(repo);
      }

      // Update scan metadata
      this.fx.proxy("git.scan.lastScan").val(Date.now());
      this.fx.proxy("git.scan.lastScanPath").val(searchPath);
      this.fx.proxy("git.scan.repositoriesFound").val(repositories.length);
      this.fx.proxy("git.scan.scanDuration").val(Date.now() - startTime);

      console.log(`✅ Scan completed in ${Date.now() - startTime}ms`);
      console.log(`📊 Analyzed ${repositories.length} repositories`);

      return repositories;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Get repository by ID
   */
  getRepository(id: string): GitRepository | null {
    return this.repositories.get(id) || null;
  }

  /**
   * Get repository by path
   */
  getRepositoryByPath(path: string): GitRepository | null {
    for (const repo of this.repositories.values()) {
      if (repo.path === path) {
        return repo;
      }
    }
    return null;
  }

  /**
   * List all discovered repositories
   */
  listRepositories(): GitRepository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Refresh repository information
   */
  async refreshRepository(id: string): Promise<GitRepository | null> {
    const repo = this.repositories.get(id);
    if (!repo) {
      return null;
    }

    try {
      console.log(`🔄 Refreshing repository: ${repo.name}`);
      const refreshed = await this._analyzeRepository(repo.path);

      this.repositories.set(id, refreshed);
      this.fx.proxy(`git.repositories.${id}`).val(refreshed);

      return refreshed;
    } catch (error) {
      console.error(`❌ Failed to refresh repository ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Remove repository from tracking
   */
  removeRepository(id: string): boolean {
    const removed = this.repositories.delete(id);
    if (removed) {
      this.fx.proxy(`git.repositories.${id}`).val(undefined);
    }
    return removed;
  }

  /**
   * Search repositories by name, path, or remote URL
   */
  searchRepositories(query: string): GitRepository[] {
    const normalizedQuery = query.toLowerCase();

    return this.listRepositories().filter(repo => {
      return repo.name.toLowerCase().includes(normalizedQuery) ||
             repo.path.toLowerCase().includes(normalizedQuery) ||
             repo.remotes.some(remote =>
               remote.url.toLowerCase().includes(normalizedQuery)
             );
    });
  }

  /**
   * Get scan statistics
   */
  getScanStats(): any {
    const repos = this.listRepositories();
    const lastScan = this.fx.proxy("git.scan.lastScan").val();

    return {
      totalRepositories: repos.length,
      lastScan: lastScan ? new Date(lastScan) : null,
      lastScanPath: this.fx.proxy("git.scan.lastScanPath").val(),
      scanDuration: this.fx.proxy("git.scan.scanDuration").val(),
      repositoriesByStatus: this._groupRepositoriesByStatus(repos),
      repositoriesByRemote: this._groupRepositoriesByRemote(repos),
      totalCommits: repos.reduce((sum, repo) => sum + repo.stats.totalCommits, 0),
      totalContributors: this._getUniqueContributors(repos).length,
      languageDistribution: this._aggregateLanguages(repos)
    };
  }

  // Private methods

  /**
   * Initialize storage structures
   */
  private _initializeStorage(): void {
    if (!this.fx.proxy("git").val()) {
      this.fx.proxy("git").val({
        repositories: {},
        scan: {
          lastScan: null,
          lastScanPath: null,
          repositoriesFound: 0,
          scanDuration: 0
        },
        sync: {
          lastSync: null,
          conflicts: [],
          status: "idle"
        }
      });
    }
  }

  /**
   * Find Git repositories recursively
   */
  private async _findGitRepositories(
    searchPath: string,
    options: Required<ScanOptions>,
    currentDepth = 0
  ): Promise<string[]> {
    const repositories: string[] = [];

    if (currentDepth > options.maxDepth) {
      return repositories;
    }

    try {
      // Check if current directory is a Git repository
      const gitDir = `${searchPath}/.git`;

      try {
        const gitStat = await Deno.stat(gitDir);
        if (gitStat.isDirectory || gitStat.isFile) {
          // This is a Git repository
          repositories.push(searchPath);

          // Don't scan inside Git repositories unless looking for submodules
          if (!options.includeSubmodules) {
            return repositories;
          }
        }
      } catch {
        // Not a Git repository, continue scanning subdirectories
      }

      // Scan subdirectories
      try {
        for await (const entry of Deno.readDir(searchPath)) {
          if (!entry.isDirectory) continue;

          // Skip hidden directories if configured
          if (options.skipHidden && entry.name.startsWith('.')) {
            continue;
          }

          // Check exclude patterns
          if (this._shouldExclude(entry.name, options.patterns.exclude)) {
            continue;
          }

          // Check include patterns (if any)
          if (options.patterns.include.length > 0 &&
              !this._shouldInclude(entry.name, options.patterns.include)) {
            continue;
          }

          const subdirPath = `${searchPath}/${entry.name}`;

          // Handle symlinks
          if (!options.followSymlinks) {
            try {
              const stat = await Deno.lstat(subdirPath);
              if (stat.isSymlink) {
                continue;
              }
            } catch {
              continue;
            }
          }

          // Recursively scan subdirectory
          const subRepos = await this._findGitRepositories(
            subdirPath,
            options,
            currentDepth + 1
          );
          repositories.push(...subRepos);
        }
      } catch (error) {
        console.warn(`⚠️ Cannot read directory ${searchPath}:`, error.message);
      }

    } catch (error) {
      console.warn(`⚠️ Error scanning ${searchPath}:`, error.message);
    }

    return repositories;
  }

  /**
   * Analyze a Git repository
   */
  private async _analyzeRepository(repoPath: string): Promise<GitRepository> {
    const repoId = this._generateRepoId(repoPath);
    const repoName = repoPath.split('/').pop() || repoPath.split('\\').pop() || 'unknown';

    console.log(`📊 Analyzing repository: ${repoName}`);

    // Get basic repository information
    const remotes = await this._getRemotes(repoPath);
    const branches = await this._getBranches(repoPath);
    const currentBranch = await this._getCurrentBranch(repoPath);
    const status = await this._getStatus(repoPath);
    const lastCommit = await this._getLastCommit(repoPath);
    const stats = await this._getStats(repoPath);
    const config = await this._getConfig(repoPath);

    const repository: GitRepository = {
      id: repoId,
      path: repoPath,
      name: repoName,
      remotes,
      branches,
      currentBranch,
      status,
      lastCommit,
      stats,
      config,
      discovered: Date.now(),
      lastScan: Date.now()
    };

    return repository;
  }

  /**
   * Get Git remotes
   */
  private async _getRemotes(repoPath: string): Promise<GitRemote[]> {
    try {
      const process = new Deno.Command("git", {
        args: ["remote", "-v"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) {
        return [];
      }

      const output = new TextDecoder().decode(stdout);
      const remotes: GitRemote[] = [];

      for (const line of output.split('\n')) {
        const match = line.match(/^(\w+)\s+(.+?)\s+\((\w+)\)$/);
        if (match) {
          const [, name, url, type] = match;
          remotes.push({
            name,
            url,
            type: type as "fetch" | "push"
          });
        }
      }

      return remotes;
    } catch (error) {
      console.warn(`Failed to get remotes for ${repoPath}:`, error.message);
      return [];
    }
  }

  /**
   * Get Git branches
   */
  private async _getBranches(repoPath: string): Promise<GitBranch[]> {
    try {
      const process = new Deno.Command("git", {
        args: ["branch", "-vv", "--all"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) {
        return [];
      }

      const output = new TextDecoder().decode(stdout);
      const branches: GitBranch[] = [];

      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('remotes/origin/HEAD')) continue;

        const isActive = trimmed.startsWith('*');
        const cleanLine = trimmed.replace(/^\*?\s*/, '');

        const parts = cleanLine.split(/\s+/);
        if (parts.length < 2) continue;

        const name = parts[0];
        const commit = parts[1];

        // Parse upstream information
        const upstreamMatch = cleanLine.match(/\[([^\]]+)\]/);
        let upstream: string | undefined;
        let ahead: number | undefined;
        let behind: number | undefined;

        if (upstreamMatch) {
          const upstreamInfo = upstreamMatch[1];

          // Extract upstream branch name
          const upstreamName = upstreamInfo.split(':')[0];
          if (upstreamName) {
            upstream = upstreamName;
          }

          // Extract ahead/behind counts
          const aheadMatch = upstreamInfo.match(/ahead (\d+)/);
          const behindMatch = upstreamInfo.match(/behind (\d+)/);

          if (aheadMatch) ahead = parseInt(aheadMatch[1]);
          if (behindMatch) behind = parseInt(behindMatch[1]);
        }

        branches.push({
          name,
          commit,
          upstream,
          ahead,
          behind,
          isActive
        });
      }

      return branches;
    } catch (error) {
      console.warn(`Failed to get branches for ${repoPath}:`, error.message);
      return [];
    }
  }

  /**
   * Get current branch
   */
  private async _getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const process = new Deno.Command("git", {
        args: ["rev-parse", "--abbrev-ref", "HEAD"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) {
        return "unknown";
      }

      return new TextDecoder().decode(stdout).trim();
    } catch (error) {
      console.warn(`Failed to get current branch for ${repoPath}:`, error.message);
      return "unknown";
    }
  }

  /**
   * Get Git status
   */
  private async _getStatus(repoPath: string): Promise<GitStatus> {
    try {
      const process = new Deno.Command("git", {
        args: ["status", "--porcelain=v1", "-b"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) {
        return {
          staged: [],
          unstaged: [],
          untracked: [],
          conflicts: [],
          ahead: 0,
          behind: 0,
          clean: true
        };
      }

      const output = new TextDecoder().decode(stdout);
      const lines = output.split('\n').filter(line => line.trim());

      const staged: GitFileStatus[] = [];
      const unstaged: GitFileStatus[] = [];
      const untracked: string[] = [];
      const conflicts: string[] = [];
      let ahead = 0;
      let behind = 0;

      for (const line of lines) {
        if (line.startsWith('##')) {
          // Branch status line
          const aheadMatch = line.match(/ahead (\d+)/);
          const behindMatch = line.match(/behind (\d+)/);

          if (aheadMatch) ahead = parseInt(aheadMatch[1]);
          if (behindMatch) behind = parseInt(behindMatch[1]);
          continue;
        }

        const statusCode = line.substring(0, 2);
        const path = line.substring(3);

        // Handle conflicts
        if (statusCode.includes('U') || statusCode === 'AA' || statusCode === 'DD') {
          conflicts.push(path);
          continue;
        }

        // Handle untracked files
        if (statusCode === '??') {
          untracked.push(path);
          continue;
        }

        // Handle staged changes
        if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          staged.push({
            path,
            status: this._parseFileStatus(statusCode[0])
          });
        }

        // Handle unstaged changes
        if (statusCode[1] !== ' ' && statusCode[1] !== '?') {
          unstaged.push({
            path,
            status: this._parseFileStatus(statusCode[1])
          });
        }
      }

      return {
        staged,
        unstaged,
        untracked,
        conflicts,
        ahead,
        behind,
        clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0
      };
    } catch (error) {
      console.warn(`Failed to get status for ${repoPath}:`, error.message);
      return {
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
        ahead: 0,
        behind: 0,
        clean: true
      };
    }
  }

  /**
   * Get last commit information
   */
  private async _getLastCommit(repoPath: string): Promise<GitCommit> {
    try {
      const process = new Deno.Command("git", {
        args: [
          "log", "-1",
          "--pretty=format:%H|%h|%an|%ae|%at|%cn|%ce|%ct|%s|%P"
        ],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) {
        throw new Error("No commits found");
      }

      const output = new TextDecoder().decode(stdout).trim();
      const parts = output.split('|');

      if (parts.length < 9) {
        throw new Error("Invalid commit format");
      }

      return {
        hash: parts[0],
        shortHash: parts[1],
        author: {
          name: parts[2],
          email: parts[3],
          date: parseInt(parts[4]) * 1000
        },
        committer: {
          name: parts[5],
          email: parts[6],
          date: parseInt(parts[7]) * 1000
        },
        message: parts[8],
        date: parseInt(parts[7]) * 1000,
        parents: parts[9] ? parts[9].split(' ') : []
      };
    } catch (error) {
      console.warn(`Failed to get last commit for ${repoPath}:`, error.message);
      // Return empty commit
      return {
        hash: "",
        shortHash: "",
        author: { name: "", email: "", date: 0 },
        committer: { name: "", email: "", date: 0 },
        message: "",
        date: 0,
        parents: []
      };
    }
  }

  /**
   * Get repository statistics
   */
  private async _getStats(repoPath: string): Promise<GitStats> {
    const stats: GitStats = {
      totalCommits: 0,
      totalBranches: 0,
      totalTags: 0,
      totalFiles: 0,
      repositorySize: 0,
      contributors: [],
      languages: {},
      activity: []
    };

    try {
      // Get commit count
      stats.totalCommits = await this._getCommitCount(repoPath);

      // Get branch count
      stats.totalBranches = await this._getBranchCount(repoPath);

      // Get tag count
      stats.totalTags = await this._getTagCount(repoPath);

      // Get file count
      stats.totalFiles = await this._getFileCount(repoPath);

      // Get repository size
      stats.repositorySize = await this._getRepositorySize(repoPath);

      // Get simplified stats (contributors, languages, activity would require more complex Git operations)
      // These could be implemented as separate async operations for detailed analysis

    } catch (error) {
      console.warn(`Failed to get complete stats for ${repoPath}:`, error.message);
    }

    return stats;
  }

  /**
   * Get Git configuration
   */
  private async _getConfig(repoPath: string): Promise<GitConfig> {
    const config: GitConfig = {};

    try {
      // Get user.name
      config.userName = await this._getConfigValue(repoPath, "user.name");

      // Get user.email
      config.userEmail = await this._getConfigValue(repoPath, "user.email");

      // Get remote.origin.url
      const originUrl = await this._getConfigValue(repoPath, "remote.origin.url");
      if (originUrl) {
        config.remote = { origin: originUrl };
      }

    } catch (error) {
      console.warn(`Failed to get config for ${repoPath}:`, error.message);
    }

    return config;
  }

  // Helper methods

  private _generateRepoId(path: string): string {
    // Create a unique ID based on the path
    const normalized = path.replace(/\\/g, '/');
    return `repo_${normalized.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }

  private _shouldExclude(name: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  private _shouldInclude(name: string, includePatterns: string[]): boolean {
    return includePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  private _createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private _parseFileStatus(statusChar: string): GitFileStatus['status'] {
    switch (statusChar) {
      case 'A': return 'added';
      case 'M': return 'modified';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      case 'C': return 'copied';
      case 'U': return 'unmerged';
      default: return 'modified';
    }
  }

  private async _getCommitCount(repoPath: string): Promise<number> {
    try {
      const process = new Deno.Command("git", {
        args: ["rev-list", "--count", "HEAD"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return 0;

      return parseInt(new TextDecoder().decode(stdout).trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async _getBranchCount(repoPath: string): Promise<number> {
    try {
      const process = new Deno.Command("git", {
        args: ["branch", "-a"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return 0;

      const output = new TextDecoder().decode(stdout);
      return output.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  private async _getTagCount(repoPath: string): Promise<number> {
    try {
      const process = new Deno.Command("git", {
        args: ["tag"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return 0;

      const output = new TextDecoder().decode(stdout);
      return output.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  private async _getFileCount(repoPath: string): Promise<number> {
    try {
      const process = new Deno.Command("git", {
        args: ["ls-files"],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return 0;

      const output = new TextDecoder().decode(stdout);
      return output.split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  private async _getRepositorySize(repoPath: string): Promise<number> {
    try {
      const gitDir = `${repoPath}/.git`;
      const process = new Deno.Command("du", {
        args: ["-s", gitDir],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return 0;

      const output = new TextDecoder().decode(stdout);
      const sizeKB = parseInt(output.split('\t')[0]) || 0;
      return sizeKB * 1024; // Convert to bytes
    } catch {
      return 0;
    }
  }

  private async _getConfigValue(repoPath: string, key: string): Promise<string | undefined> {
    try {
      const process = new Deno.Command("git", {
        args: ["config", "--get", key],
        cwd: repoPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await process.output();

      if (code !== 0) return undefined;

      return new TextDecoder().decode(stdout).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private _groupRepositoriesByStatus(repos: GitRepository[]): Record<string, number> {
    const groups: Record<string, number> = {
      clean: 0,
      modified: 0,
      staged: 0,
      conflicts: 0,
      untracked: 0
    };

    for (const repo of repos) {
      if (repo.status.conflicts.length > 0) {
        groups.conflicts++;
      } else if (repo.status.staged.length > 0) {
        groups.staged++;
      } else if (repo.status.unstaged.length > 0) {
        groups.modified++;
      } else if (repo.status.untracked.length > 0) {
        groups.untracked++;
      } else {
        groups.clean++;
      }
    }

    return groups;
  }

  private _groupRepositoriesByRemote(repos: GitRepository[]): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const repo of repos) {
      const originRemote = repo.remotes.find(r => r.name === 'origin');
      if (originRemote) {
        const host = this._extractHost(originRemote.url);
        groups[host] = (groups[host] || 0) + 1;
      } else {
        groups['local'] = (groups['local'] || 0) + 1;
      }
    }

    return groups;
  }

  private _extractHost(url: string): string {
    try {
      if (url.startsWith('git@')) {
        return url.split('@')[1].split(':')[0];
      } else {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
      }
    } catch {
      return 'unknown';
    }
  }

  private _getUniqueContributors(repos: GitRepository[]): GitContributor[] {
    const contributorMap = new Map<string, GitContributor>();

    for (const repo of repos) {
      for (const contributor of repo.stats.contributors) {
        const key = `${contributor.name}:${contributor.email}`;
        const existing = contributorMap.get(key);

        if (existing) {
          existing.commits += contributor.commits;
          existing.additions += contributor.additions;
          existing.deletions += contributor.deletions;
          existing.firstCommit = Math.min(existing.firstCommit, contributor.firstCommit);
          existing.lastCommit = Math.max(existing.lastCommit, contributor.lastCommit);
        } else {
          contributorMap.set(key, { ...contributor });
        }
      }
    }

    return Array.from(contributorMap.values());
  }

  private _aggregateLanguages(repos: GitRepository[]): Record<string, number> {
    const languages: Record<string, number> = {};

    for (const repo of repos) {
      for (const [language, count] of Object.entries(repo.stats.languages)) {
        languages[language] = (languages[language] || 0) + count;
      }
    }

    return languages;
  }
}

/**
 * Factory function to create Git scanner
 */
export function createGitScanner(fx: FXCore): GitScanner {
  return new GitScanner(fx);
}