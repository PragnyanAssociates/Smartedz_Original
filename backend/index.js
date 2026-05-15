require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
// Set limit to 50mb to handle Base64 Logo uploads
app.use(express.json({ limit: '50mb' }));

// Railway Database Connection
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';

// ==========================================================
// --- 1. AUTHENTICATION (Plain Text Passwords) ---
// ==========================================================

app.post('/api/login', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND password = ? AND role = ?',
            [email, password, role]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or role selection' });
        }
        
        const user = rows[0];
        const token = jwt.sign(
            { id: user.id, role: user.role, instId: user.institutionId }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true, 
            token, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                institutionId: user.institutionId
            } 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================================
// --- 2. DEVELOPER ENDPOINTS (System Management) ---
// ==========================================================

// GET all Institutions and Users for Dev Dashboard
app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, role, institutionId, password FROM users');
        res.json({ institutions: insts, users });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ONBOARD: Create Institution + Initial Super Admin (Transaction)
app.post('/api/developer/onboard', async (req, res) => {
    const { name, type, logo, schoolKey, school_email, phone, superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert Institution
        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, logo, schoolKey, school_email, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [name, type, logo, schoolKey, school_email, phone]
        );
        
        const instId = inst.insertId;

        // 2. Insert Super Admin User linked to that Institution
        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, 'Super Admin', instId]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { 
        conn.release(); 
    }
});

// UPDATE: Full Institution Profile + Admin Profile (Transaction)
app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, logo, school_email, phone, superAdminName, superAdminEmail, superAdminPassword } = req.body;
    
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Update Institution Table
        await conn.execute(
            'UPDATE institutions SET name = ?, type = ?, logo = ?, school_email = ?, phone = ? WHERE id = ?',
            [name, type, logo, school_email, phone, id]
        );

        // 2. Update the Super Admin details in Users Table
        await conn.execute(
            'UPDATE users SET name = ?, email = ?, password = ? WHERE institutionId = ? AND role = "Super Admin"',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// DELETE: Remove Institution (And Users via Cascade)
app.delete('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM institutions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================================
// --- 3. SUPER ADMIN ENDPOINTS (School Internal) ---
// ==========================================================

// GET School Specific Data (Users, Classes, Years, Roles)
app.get('/api/admin/data/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const [classes] = await db.execute('SELECT * FROM classes WHERE institutionId = ?', [instId]);
        const [years] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ?', [instId]);
        const [roles] = await db.execute('SELECT * FROM roles WHERE institutionId = ?', [instId]);
        const [inst] = await db.execute('SELECT * FROM institutions WHERE id = ?', [instId]);
        
        res.json({ 
            users, 
            classes, 
            academicYears: years, 
            roles,
            institution: inst[0] 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ADD New Internal User (Enhanced with student fields)
app.post('/api/admin/users', async (req, res) => {
    const { name, email, password, role, institutionId, modules, phone_no, roll_no, admission_no, class_id, section, status } = req.body;
    try {
        await db.execute(
            `INSERT INTO users (name, email, password, role, institutionId, modules, phone_no, roll_no, admission_no, class_id, section, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, password, role, institutionId, modules, phone_no, roll_no, admission_no, class_id, section, status || 'active']
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// --- CLASS & SECTION MANAGEMENT ---

app.post('/api/admin/classes', async (req, res) => {
    const { className, section, institutionId } = req.body;
    try {
        await db.execute(
            'INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)',
            [className, section, institutionId]
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/api/admin/classes/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM classes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ACADEMIC YEAR MANAGEMENT ---

app.post('/api/admin/academics', async (req, res) => {
    const { name, startDate, endDate, institutionId } = req.body;
    try {
        await db.execute(
            'INSERT INTO academic_years (name, startDate, endDate, isActive, institutionId) VALUES (?, ?, ?, 0, ?)',
            [name, startDate, endDate, institutionId]
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/admin/academics/set-active/:id', async (req, res) => {
    const { id } = req.params;
    const { institutionId } = req.body;
    try {
        // Reset all to inactive for this school first
        await db.execute('UPDATE academic_years SET isActive = 0 WHERE institutionId = ?', [institutionId]);
        // Set the chosen one to active
        await db.execute('UPDATE academic_years SET isActive = 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROLE & PERMISSION MANAGEMENT ---

app.post('/api/admin/roles', async (req, res) => {
    const { role_name, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO roles (role_name, institutionId) VALUES (?, ?)', [role_name, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/permissions/:roleId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM permissions WHERE role_id = ?', [req.params.roleId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/permissions', async (req, res) => {
    const { role_id, permissions } = req.body; // permissions is an array of objects
    try {
        // Clean existing permissions for this role first
        await db.execute('DELETE FROM permissions WHERE role_id = ?', [role_id]);
        
        for (const p of permissions) {
            await db.execute(
                'INSERT INTO permissions (role_id, module_name, can_read, can_edit, can_delete, is_hidden) VALUES (?, ?, ?, ?, ?, ?)',
                [role_id, p.module_name, p.can_read, p.can_edit, p.can_delete, p.is_hidden]
            );
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STUDENT PROMOTION ENGINE ---

app.post('/api/admin/promote', async (req, res) => {
    const { studentIds, targetClassId, targetSection } = req.body;
    try {
        // studentIds should be an array [1, 2, 3]
        const placeholders = studentIds.map(() => '?').join(',');
        const query = `UPDATE users SET class_id = ?, section = ? WHERE id IN (${placeholders})`;
        await db.execute(query, [targetClassId, targetSection, ...studentIds]);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================================
// --- START SERVER ---
// ==========================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`));