// =====================================================================
//  SmartEdz ERP - Unified Backend (single file)
//  Sections:
//   1. AUTHENTICATION
//   2. DEVELOPER ENDPOINTS
//   3. SUPER ADMIN — School Aggregate Data
//   4. USERS — Full CRUD
//   5. ROLES — Full CRUD
//   6. PERMISSIONS
//   7. ACADEMIC YEARS — Full CRUD
//   8. CLASSES — Full CRUD (single + bulk-create)
//   9. STUDENT PROMOTION
//  10. HEALTH CHECK
// =====================================================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 50mb for Base64 logo uploads

// ---------------------------------------------------------------------
//  DATABASE POOL (Railway)
// ---------------------------------------------------------------------
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';

// Modules available in the Permissions matrix.
// Add new ERP modules here and they appear automatically.
const DEFAULT_MODULES = [
    'Dashboard', 'Users', 'Roles', 'Permissions', 'Classes',
    'Academic Years', 'Attendance', 'Timetable', 'Fees',
    'Examinations', 'Library', 'Transport', 'Reports', 'Communication'
];


// =====================================================================
// === 1. AUTHENTICATION ===============================================
// =====================================================================
// Login uses email + password only. The user's role comes from the DB,
// so Developer / Super Admin / Teacher / Student all use the same form.
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND password = ?',
            [email, password]
        );
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const user = rows[0];
        if (user.status === 'inactive') {
            return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact your administrator.' });
        }
        const token = jwt.sign(
            { id: user.id, role: user.role, instId: user.institutionId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({
            success: true, token,
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


// =====================================================================
// === 2. DEVELOPER ENDPOINTS ==========================================
// =====================================================================

// --- 2.1 Read all institutions + users
app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, role, institutionId, password FROM users');
        res.json({ institutions: insts, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2.2 Onboard a new institution + initial Super Admin
app.post('/api/developer/onboard', async (req, res) => {
    const { name, type, logo, schoolKey, school_email, phone,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, logo, schoolKey, school_email, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [name, type, logo, schoolKey, school_email, phone]
        );
        const instId = inst.insertId;

        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, 'Super Admin', instId]
        );

        // Seed Super Admin role row so it shows up in Roles screen
        await conn.execute(
            'INSERT INTO roles (role_name, institutionId) VALUES (?, ?)',
            ['Super Admin', instId]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 2.3 Update institution + linked Super Admin
app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, logo, school_email, phone,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            'UPDATE institutions SET name = ?, type = ?, logo = ?, school_email = ?, phone = ? WHERE id = ?',
            [name, type, logo, school_email, phone, id]
        );
        await conn.execute(
            'UPDATE users SET name = ?, email = ?, password = ? WHERE institutionId = ? AND role = "Super Admin"',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 2.4 Delete institution (cascade clears all data)
app.delete('/api/developer/institution/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM institutions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 3. SUPER ADMIN — School Aggregate Data ==========================
// =====================================================================
// One endpoint returns everything Manage Login needs.
app.get('/api/admin/data/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [users]   = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const [classes] = await db.execute('SELECT * FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const [years]   = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? ORDER BY startDate DESC', [instId]);
        const [roles]   = await db.execute('SELECT * FROM roles WHERE institutionId = ? ORDER BY role_name', [instId]);
        const [inst]    = await db.execute('SELECT * FROM institutions WHERE id = ?', [instId]);
        res.json({
            users, classes,
            academicYears: years,
            roles,
            modules: DEFAULT_MODULES,
            institution: inst[0]
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 4. USERS — Full CRUD ============================================
// =====================================================================

// --- 4.1 Create
app.post('/api/admin/users', async (req, res) => {
    const { name, email, password, role, institutionId, modules,
            phone_no, roll_no, admission_no, class_id, section, status } = req.body;
    try {
        await db.execute(
            `INSERT INTO users (name, email, password, role, institutionId, modules,
                                phone_no, roll_no, admission_no, class_id, section, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, password, role, institutionId, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4.2 Update
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, modules,
            phone_no, roll_no, admission_no, class_id, section, status } = req.body;
    try {
        await db.execute(
            `UPDATE users
                SET name=?, email=?, password=?, role=?, modules=?,
                    phone_no=?, roll_no=?, admission_no=?, class_id=?, section=?, status=?
              WHERE id=?`,
            [name, email, password, role, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active', id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4.3 Delete
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 5. ROLES — Full CRUD ============================================
// =====================================================================
// "Super Admin" is system-protected and cannot be renamed or deleted.

// --- 5.1 Create
app.post('/api/admin/roles', async (req, res) => {
    const { role_name, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO roles (role_name, institutionId) VALUES (?, ?)',
            [role_name, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5.2 Rename (and propagate to all users holding the old name)
app.put('/api/admin/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { role_name, institutionId } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [existing] = await conn.execute('SELECT role_name FROM roles WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Role not found');
        const oldName = existing[0].role_name;
        if (oldName === 'Super Admin') {
            await conn.rollback();
            return res.status(400).json({ error: 'The system role "Super Admin" cannot be renamed.' });
        }
        await conn.execute('UPDATE roles SET role_name = ? WHERE id = ?', [role_name, id]);
        await conn.execute(
            'UPDATE users SET role = ? WHERE role = ? AND institutionId = ?',
            [role_name, oldName, institutionId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 5.3 Delete
app.delete('/api/admin/roles/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT role_name FROM roles WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        if (rows[0].role_name === 'Super Admin') {
            return res.status(400).json({ error: 'The system role "Super Admin" cannot be deleted.' });
        }
        await db.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 6. PERMISSIONS ==================================================
// =====================================================================

// --- 6.1 Read permissions for one role
app.get('/api/admin/permissions/:roleId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM permissions WHERE role_id = ?', [req.params.roleId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6.2 Bulk-replace all permissions for a role
app.post('/api/admin/permissions', async (req, res) => {
    const { role_id, permissions } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM permissions WHERE role_id = ?', [role_id]);
        for (const p of permissions) {
            await conn.execute(
                'INSERT INTO permissions (role_id, module_name, can_read, can_edit, can_delete, is_hidden) VALUES (?, ?, ?, ?, ?, ?)',
                [role_id, p.module_name,
                 p.can_read ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0, p.is_hidden ? 1 : 0]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// =====================================================================
// === 7. ACADEMIC YEARS — Full CRUD ===================================
// =====================================================================

// --- 7.1 Create
app.post('/api/admin/academics', async (req, res) => {
    const { name, startDate, endDate, institutionId } = req.body;
    try {
        await db.execute(
            'INSERT INTO academic_years (name, startDate, endDate, isActive, institutionId) VALUES (?, ?, ?, 0, ?)',
            [name, startDate, endDate, institutionId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7.2 Update
app.put('/api/admin/academics/:id', async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;
    try {
        await db.execute(
            'UPDATE academic_years SET name=?, startDate=?, endDate=? WHERE id=?',
            [name, startDate, endDate, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7.3 Set a year active (deactivates the rest)
app.put('/api/admin/academics/set-active/:id', async (req, res) => {
    const { id } = req.params;
    const { institutionId } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('UPDATE academic_years SET isActive = 0 WHERE institutionId = ?', [institutionId]);
        await conn.execute('UPDATE academic_years SET isActive = 1 WHERE id = ?', [id]);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 7.4 Delete
app.delete('/api/admin/academics/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM academic_years WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 8. CLASSES — Full CRUD ==========================================
// =====================================================================

// --- 8.1 Create (single row — kept for backward compatibility)
app.post('/api/admin/classes', async (req, res) => {
    const { className, section, institutionId } = req.body;
    try {
        await db.execute(
            'INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)',
            [className, section || null, institutionId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 8.1b Bulk-create: one class with many sections at once
// Body: { className: 'Class 5', sections: ['A','B','C'], institutionId: 1 }
// To create a class with NO sections, pass sections: [null]
app.post('/api/admin/classes/bulk', async (req, res) => {
    const { className, sections, institutionId } = req.body;
    if (!className || !institutionId || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ error: 'className, institutionId and a non-empty sections array are required.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const created = [];
        const skipped = [];

        for (const rawSection of sections) {
            // Normalize: trim non-null strings, keep null as null
            const section = (rawSection === null || rawSection === undefined || rawSection === '')
                ? null
                : String(rawSection).trim();

            try {
                await conn.execute(
                    'INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)',
                    [className, section, institutionId]
                );
                created.push(section ?? '(no section)');
            } catch (err) {
                // ER_DUP_ENTRY = 1062 — class+section already exists for this institution
                if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                    skipped.push(section ?? '(no section)');
                } else {
                    throw err;   // anything else is a real error → rollback
                }
            }
        }

        await conn.commit();
        res.json({ success: true, created: created.length, createdSections: created, skipped });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- 8.2 Update
app.put('/api/admin/classes/:id', async (req, res) => {
    const { id } = req.params;
    const { className, section } = req.body;
    try {
        await db.execute('UPDATE classes SET className=?, section=? WHERE id=?',
            [className, section || null, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 8.3 Delete
app.delete('/api/admin/classes/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM classes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 9. STUDENT PROMOTION ============================================
// =====================================================================
app.post('/api/admin/promote', async (req, res) => {
    const { studentIds, targetClassId, targetSection } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: 'No students supplied' });
    }
    try {
        const placeholders = studentIds.map(() => '?').join(',');
        const query = `UPDATE users SET class_id = ?, section = ? WHERE id IN (${placeholders})`;
        await db.execute(query, [targetClassId, targetSection || null, ...studentIds]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 10. HEALTH CHECK ================================================
// =====================================================================
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'SmartEdz ERP', time: new Date().toISOString() });
});


// =====================================================================
// === SERVER BOOT =====================================================
// =====================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`));