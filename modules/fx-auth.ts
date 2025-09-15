/**
 * FX Authentication & Authorization Framework
 * JWT-based auth with role-based access control
 */

import { FXCore } from '../fx.ts';
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

// User and authentication types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  createdAt: number;
  lastLoginAt?: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface AuthToken {
  access: string;
  refresh: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName: string;
  inviteCode?: string;
}

export interface TokenPayload {
  sub: string; // user ID
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

// Permission and role types
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string; // e.g., 'snippets', 'views', 'collaboration'
  action: string;   // e.g., 'read', 'write', 'delete', 'admin'
  scope?: string;   // Optional scope limitation
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: number;
}

// Session management
export interface Session {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: number;
  lastAccessAt: number;
  expiresAt: number;
  isActive: boolean;
  ipAddress: string;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  isMobile: boolean;
}

// OAuth and SSO
export interface OAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  enabled: boolean;
}

export interface SSOConfig {
  enabled: boolean;
  providers: OAuthProvider[];
  defaultRole: string;
  autoCreateUsers: boolean;
  domainWhitelist?: string[];
}

// Main authentication manager
export class FXAuthManager {
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private roles = new Map<string, Role>();
  private permissions = new Map<string, Permission>();
  private jwtSecret: CryptoKey;
  private refreshTokens = new Set<string>();
  
  constructor(
    private fx: typeof FXCore,
    private secretKey?: string
  ) {
    this.initializeAuth();
  }
  
  private async initializeAuth(): Promise<void> {
    // Generate or load JWT secret
    this.jwtSecret = await this.getOrCreateJWTSecret();
    
    // Setup default roles and permissions
    await this.setupDefaultRoles();
    
    // Load existing users from FX storage
    await this.loadUsersFromFX();
    
    console.log('🔐 FX Auth Manager initialized');
  }
  
  private async getOrCreateJWTSecret(): Promise<CryptoKey> {
    let secret = this.secretKey;
    
    if (!secret) {
      // Try to load from FX storage
      secret = await this.fx('auth.jwtSecret').val();
      
      if (!secret) {
        // Generate new secret
        const key = await crypto.subtle.generateKey(
          { name: 'HMAC', hash: 'SHA-256' },
          true,
          ['sign', 'verify']
        );
        
        // Export and store
        const exported = await crypto.subtle.exportKey('raw', key);
        const base64Secret = btoa(String.fromCharCode(...new Uint8Array(exported)));
        this.fx('auth.jwtSecret').val(base64Secret);
        
        return key;
      }
    }
    
    // Import existing secret
    const secretBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  
  private async setupDefaultRoles(): Promise<void> {
    const defaultPermissions: Permission[] = [
      // Snippet permissions
      { id: 'snippets:read', name: 'Read Snippets', description: 'View snippets', resource: 'snippets', action: 'read' },
      { id: 'snippets:write', name: 'Write Snippets', description: 'Create/edit snippets', resource: 'snippets', action: 'write' },
      { id: 'snippets:delete', name: 'Delete Snippets', description: 'Delete snippets', resource: 'snippets', action: 'delete' },
      
      // View permissions
      { id: 'views:read', name: 'Read Views', description: 'View file views', resource: 'views', action: 'read' },
      { id: 'views:write', name: 'Write Views', description: 'Create/edit views', resource: 'views', action: 'write' },
      
      // Collaboration permissions
      { id: 'collaboration:join', name: 'Join Sessions', description: 'Join collaborative editing sessions', resource: 'collaboration', action: 'join' },
      { id: 'collaboration:create', name: 'Create Sessions', description: 'Create collaborative sessions', resource: 'collaboration', action: 'create' },
      
      // Admin permissions
      { id: 'admin:users', name: 'User Management', description: 'Manage users', resource: 'admin', action: 'users' },
      { id: 'admin:roles', name: 'Role Management', description: 'Manage roles', resource: 'admin', action: 'roles' },
      { id: 'admin:system', name: 'System Administration', description: 'System administration', resource: 'admin', action: 'system' }
    ];
    
    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }
    
    const defaultRoles: Role[] = [
      {
        id: 'guest',
        name: 'Guest',
        description: 'Read-only access',
        permissions: ['snippets:read', 'views:read'],
        isSystemRole: true,
        createdAt: Date.now()
      },
      {
        id: 'user',
        name: 'User',
        description: 'Standard user access',
        permissions: ['snippets:read', 'snippets:write', 'views:read', 'views:write', 'collaboration:join'],
        isSystemRole: true,
        createdAt: Date.now()
      },
      {
        id: 'collaborator',
        name: 'Collaborator',
        description: 'Full collaboration access',
        permissions: ['snippets:read', 'snippets:write', 'views:read', 'views:write', 'collaboration:join', 'collaboration:create'],
        isSystemRole: true,
        createdAt: Date.now()
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: Object.keys(this.permissions),
        isSystemRole: true,
        createdAt: Date.now()
      }
    ];
    
    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }
  
  private async loadUsersFromFX(): Promise<void> {
    const usersData = await this.fx('auth.users').val() || {};
    
    for (const [id, userData] of Object.entries(usersData)) {
      this.users.set(id, userData as User);
    }
  }
  
  // Authentication methods
  async register(data: RegisterData): Promise<User> {
    // Validate input
    if (this.getUserByUsername(data.username)) {
      throw new Error('Username already exists');
    }
    
    if (this.getUserByEmail(data.email)) {
      throw new Error('Email already exists');
    }
    
    // Hash password
    const passwordHash = await this.hashPassword(data.password);
    
    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      roles: ['user'], // Default role
      permissions: this.getPermissionsForRoles(['user']),
      createdAt: Date.now(),
      isActive: true,
      metadata: {
        passwordHash,
        inviteCode: data.inviteCode
      }
    };
    
    // Store user
    this.users.set(user.id, user);
    this.fx(`auth.users.${user.id}`).val(user);
    
    console.log(`✅ User registered: ${user.username}`);
    return user;
  }
  
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthToken }> {
    const user = this.getUserByUsername(credentials.username);
    
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }
    
    // Verify password
    const isValid = await this.verifyPassword(
      credentials.password,
      user.metadata?.passwordHash
    );
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    // Update last login
    user.lastLoginAt = Date.now();
    this.users.set(user.id, user);
    this.fx(`auth.users.${user.id}`).val(user);
    
    // Generate tokens
    const tokens = await this.generateTokens(user);
    
    console.log(`✅ User logged in: ${user.username}`);
    return { user, tokens };
  }
  
  async logout(token: string): Promise<void> {
    try {
      const payload = await this.verifyToken(token);
      this.refreshTokens.delete(token);
      
      // Remove active sessions
      const userSessions = Array.from(this.sessions.values())
        .filter(s => s.userId === payload.sub);
      
      for (const session of userSessions) {
        this.sessions.delete(session.id);
      }
      
      console.log(`✅ User logged out: ${payload.username}`);
      
    } catch (error) {
      // Token might be invalid, but that's okay for logout
      console.log('Logout with invalid token');
    }
  }
  
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    if (!this.refreshTokens.has(refreshToken)) {
      throw new Error('Invalid refresh token');
    }
    
    const payload = await this.verifyToken(refreshToken);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    const user = this.users.get(payload.sub);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }
    
    // Remove old refresh token
    this.refreshTokens.delete(refreshToken);
    
    // Generate new tokens
    return await this.generateTokens(user);
  }
  
  // Token management
  private async generateTokens(user: User): Promise<AuthToken> {
    const now = Date.now();
    const accessExpiry = now + (15 * 60 * 1000); // 15 minutes
    const refreshExpiry = now + (7 * 24 * 60 * 60 * 1000); // 7 days
    
    const accessPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      iat: getNumericDate(now),
      exp: getNumericDate(accessExpiry),
      type: 'access'
    };
    
    const refreshPayload: TokenPayload = {
      ...accessPayload,
      exp: getNumericDate(refreshExpiry),
      type: 'refresh'
    };
    
    const accessToken = await create(
      { alg: 'HS256', typ: 'JWT' },
      accessPayload,
      this.jwtSecret
    );
    
    const refreshToken = await create(
      { alg: 'HS256', typ: 'JWT' },
      refreshPayload,
      this.jwtSecret
    );
    
    // Store refresh token
    this.refreshTokens.add(refreshToken);
    
    return {
      access: accessToken,
      refresh: refreshToken,
      expiresAt: accessExpiry,
      tokenType: 'Bearer'
    };
  }
  
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await verify(token, this.jwtSecret) as TokenPayload;
      
      // Check if user still exists and is active
      const user = this.users.get(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      return payload;
      
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
  
  // Authorization methods
  async authorize(token: string, resource: string, action: string, scope?: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      return this.checkPermission(payload, resource, action, scope);
      
    } catch (error) {
      return false;
    }
  }
  
  private checkPermission(
    payload: TokenPayload,
    resource: string,
    action: string,
    scope?: string
  ): boolean {
    const requiredPermission = `${resource}:${action}`;
    
    // Check if user has the specific permission
    if (payload.permissions.includes(requiredPermission)) {
      return true;
    }
    
    // Check for admin permissions
    if (payload.permissions.includes('admin:system')) {
      return true;
    }
    
    // Check for resource admin permissions
    if (payload.permissions.includes(`admin:${resource}`)) {
      return true;
    }
    
    return false;
  }
  
  // User management
  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  
  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    this.fx(`auth.users.${userId}`).val(updatedUser);
    
    return updatedUser;
  }
  
  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Soft delete - mark as inactive
    user.isActive = false;
    this.users.set(userId, user);
    this.fx(`auth.users.${userId}`).val(user);
  }
  
  // Role and permission management
  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    
    if (!user.roles.includes(roleId)) {
      user.roles.push(roleId);
      user.permissions = this.getPermissionsForRoles(user.roles);
      
      this.users.set(userId, user);
      this.fx(`auth.users.${userId}`).val(user);
    }
  }
  
  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const index = user.roles.indexOf(roleId);
    if (index > -1) {
      user.roles.splice(index, 1);
      user.permissions = this.getPermissionsForRoles(user.roles);
      
      this.users.set(userId, user);
      this.fx(`auth.users.${userId}`).val(user);
    }
  }
  
  private getPermissionsForRoles(roleIds: string[]): string[] {
    const permissions = new Set<string>();
    
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (role) {
        for (const permission of role.permissions) {
          permissions.add(permission);
        }
      }
    }
    
    return Array.from(permissions);
  }
  
  // Password utilities
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }
  
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashPassword(password);
    return computedHash === hash;
  }
  
  // Session management
  createSession(userId: string, deviceInfo: DeviceInfo, ipAddress: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      deviceInfo,
      createdAt: Date.now(),
      lastAccessAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
      ipAddress
    };
    
    this.sessions.set(session.id, session);
    return session;
  }
  
  getActiveSessions(userId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId && s.isActive && s.expiresAt > Date.now());
  }
  
  revokeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.set(sessionId, session);
    }
  }
  
  // Public API
  getUsers(): User[] {
    return Array.from(this.users.values());
  }
  
  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }
  
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }
}

// Middleware for HTTP authentication
export function createAuthMiddleware(authManager: FXAuthManager) {
  return async (req: Request): Promise<{ user?: User; authorized: boolean }> => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return { authorized: false };
    }
    
    const token = authHeader.slice(7);
    
    try {
      const payload = await authManager.verifyToken(token);
      const user = authManager['users'].get(payload.sub);
      
      return { user, authorized: true };
      
    } catch (error) {
      return { authorized: false };
    }
  };
}

// Helper function to create auth manager
export function createAuthManager(fx: typeof FXCore, secretKey?: string): FXAuthManager {
  return new FXAuthManager(fx, secretKey);
}