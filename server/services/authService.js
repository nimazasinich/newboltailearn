import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';
export class AuthService {
    constructor(database) {
        this.db = database;
    }
    /**
     * Authenticate user with username and password
     */
    async authenticate(credentials) {
        try {
            const user = this.db.prepare(`
        SELECT id, username, email, role, password_hash, created_at, last_login
        FROM users 
        WHERE username = ? OR email = ?
      `).get(credentials.username, credentials.username);
            if (!user) {
                return null;
            }
            // Verify password
            const isValidPassword = await bcrypt.compare(credentials.password, user.password_hash);
            if (!isValidPassword) {
                return null;
            }
            // Update last login
            this.db.prepare(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(user.id);
            // Generate JWT token
            const token = generateToken({
                id: user.id,
                username: user.username,
                role: user.role,
                email: user.email
            });
            // Return user without password hash
            const { password_hash, ...userWithoutPassword } = user;
            return {
                user: userWithoutPassword,
                token
            };
        }
        catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }
    /**
     * Register a new user
     */
    async register(userData) {
        try {
            // Check if user already exists
            const existingUser = this.db.prepare(`
        SELECT id FROM users 
        WHERE username = ? OR email = ?
      `).get(userData.username, userData.email);
            if (existingUser) {
                throw new Error('User already exists');
            }
            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(userData.password, saltRounds);
            // Insert new user
            const result = this.db.prepare(`
        INSERT INTO users (username, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userData.username, userData.email, passwordHash, userData.role || 'viewer');
            const userId = result.lastInsertRowid;
            // Get the created user
            const newUser = this.db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users 
        WHERE id = ?
      `).get(userId);
            // Generate JWT token
            const token = generateToken({
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
                email: newUser.email
            });
            return {
                user: newUser,
                token
            };
        }
        catch (error) {
            console.error('Registration error:', error);
            return null;
        }
    }
    /**
     * Get user by ID
     */
    getUserById(id) {
        try {
            const user = this.db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users 
        WHERE id = ?
      `).get(id);
            return user || null;
        }
        catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }
    /**
     * Update user profile
     */
    async updateUser(id, updates) {
        try {
            const fields = Object.keys(updates).filter(key => ['username', 'email', 'role'].includes(key));
            if (fields.length === 0) {
                return this.getUserById(id);
            }
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => updates[field]);
            this.db.prepare(`
        UPDATE users 
        SET ${setClause}
        WHERE id = ?
      `).run(...values, id);
            return this.getUserById(id);
        }
        catch (error) {
            console.error('Update user error:', error);
            return null;
        }
    }
    /**
     * Change user password
     */
    async changePassword(id, currentPassword, newPassword) {
        try {
            // Get current password hash
            const user = this.db.prepare(`
        SELECT password_hash FROM users WHERE id = ?
      `).get(id);
            if (!user) {
                return false;
            }
            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isValidPassword) {
                return false;
            }
            // Hash new password
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            // Update password
            this.db.prepare(`
        UPDATE users 
        SET password_hash = ?
        WHERE id = ?
      `).run(newPasswordHash, id);
            return true;
        }
        catch (error) {
            console.error('Change password error:', error);
            return false;
        }
    }
    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        try {
            return this.db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users 
        ORDER BY created_at DESC
      `).all();
        }
        catch (error) {
            console.error('Get all users error:', error);
            return [];
        }
    }
    /**
     * Delete user (admin only)
     */
    deleteUser(id) {
        try {
            const result = this.db.prepare(`
        DELETE FROM users WHERE id = ?
      `).run(id);
            return result.changes > 0;
        }
        catch (error) {
            console.error('Delete user error:', error);
            return false;
        }
    }
    /**
     * Validate user credentials
     */
    async validateUser(username, password) {
        try {
            const user = this.db.prepare(`
        SELECT id, username, email, role, password_hash, created_at, last_login
        FROM users 
        WHERE username = ? OR email = ?
      `).get(username, username);
            if (!user) {
                return null;
            }
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return null;
            }
            // Update last login
            this.updateLastLogin(user.id);
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                created_at: user.created_at,
                last_login: user.last_login
            };
        }
        catch (error) {
            console.error('Validate user error:', error);
            throw error;
        }
    }
    /**
     * Find user by username
     */
    async findUserByUsername(username) {
        try {
            const user = this.db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users 
        WHERE username = ?
      `).get(username);
            return user || null;
        }
        catch (error) {
            console.error('Find user by username error:', error);
            return null;
        }
    }
    /**
     * Find user by email
     */
    async findUserByEmail(email) {
        try {
            const user = this.db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users 
        WHERE email = ?
      `).get(email);
            return user || null;
        }
        catch (error) {
            console.error('Find user by email error:', error);
            return null;
        }
    }
    /**
     * Find user by ID
     */
    async findUserById(id) {
        return this.getUserById(id);
    }
    /**
     * Create new user
     */
    async createUser(userData) {
        const result = await this.register(userData);
        if (!result) {
            throw new Error('Failed to create user');
        }
        return result.user;
    }
    /**
     * Validate password for user
     */
    async validatePassword(username, password) {
        try {
            const user = this.db.prepare(`
        SELECT password_hash
        FROM users 
        WHERE username = ? OR email = ?
      `).get(username, username);
            if (!user) {
                return false;
            }
            return await bcrypt.compare(password, user.password_hash);
        }
        catch (error) {
            console.error('Validate password error:', error);
            return false;
        }
    }
    /**
     * Update user password
     */
    async updatePassword(userId, newPassword) {
        try {
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(newPassword, saltRounds);
            this.db.prepare(`
        UPDATE users 
        SET password_hash = ?
        WHERE id = ?
      `).run(passwordHash, userId);
        }
        catch (error) {
            console.error('Update password error:', error);
            throw error;
        }
    }
    /**
     * Update last login timestamp
     */
    updateLastLogin(userId) {
        try {
            this.db.prepare(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(userId);
        }
        catch (error) {
            console.error('Update last login error:', error);
        }
    }
}
