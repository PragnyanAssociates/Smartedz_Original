// =====================================================================
//  SmartEdz ERP - Unified Backend (single file)
// =====================================================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';

// =====================================================================
//  MODULE REGISTRY (mirror in frontend/src/Screens/Modules.js)
// =====================================================================
const DEFAULT_MODULES = [
    'Overview',
    'Manage Logins',
    'Timetable',
    'Academic Calendar',
    'Attendance'
];

// =====================================================================
//  SYSTEM ROLES — These three are seeded for every school and cannot
//  be renamed or deleted by anyone (not even Super Admin from the UI).
//  Future modules (Attendance, Marks, etc.) can rely on these EXACT
//  names without worrying about case/plural variations.
//
//  IMPORTANT: must mirror SYSTEM_ROLES in RolesTab.jsx on the frontend.
// =====================================================================
const SYSTEM_ROLES = ['Super Admin', 'Student', 'Teacher'];
const isSystemRole = (name) => SYSTEM_ROLES.includes(name);

const PLAN_DAYS = {
    '7 days': 7, '30 days': 30, '90 days': 90, '180 days': 180,
    '1 year': 365, '3 years': 365 * 3, 'Full Time': null
};

function computePlanStatus(plan, startDateStr) {
    const days = PLAN_DAYS[plan];
    if (days === null || days === undefined) return { planEndDate: null, daysLeft: null, expired: false };
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return { planEndDate: null, daysLeft: null, expired: false };
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endMid = new Date(end); endMid.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((endMid - today) / (1000 * 60 * 60 * 24));
    return { planEndDate: end.toISOString().slice(0, 10), daysLeft, expired: daysLeft < 0 };
}

// We still keep flexible matching here so that any role whose name
// contains "teacher" (e.g. "Senior Teacher") syncs subjects too. The
// system role 'Teacher' is just the canonical default.
const isTeacherRoleName = (role) => role && role.toLowerCase().includes('teacher');

async function syncTeacherSubjects(conn, userId, role, subjectIds) {
    await conn.execute('DELETE FROM teacher_subjects WHERE teacher_id = ?', [userId]);
    if (!isTeacherRoleName(role) || !Array.isArray(subjectIds)) return;
    for (const sid of subjectIds) {
        if (!sid) continue;
        await conn.execute('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)', [userId, parseInt(sid, 10)]);
    }
}


// =====================================================================
// === 1. AUTHENTICATION (accepts email OR username) ===================
// =====================================================================
app.post('/api/login', async (req, res) => {
    const identifier = req.body.identifier || req.body.email;
    const { password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT id, name, email, username, role, institutionId, status, profile_pic FROM users WHERE (email = ? OR username = ?) AND password = ?',
            [identifier, identifier, password]
        );
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const user = rows[0];
        if (user.status === 'inactive') return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });

        if (user.role !== 'Developer' && user.institutionId) {
            const [instRows] = await db.execute('SELECT usage_plan, plan_start_date FROM institutions WHERE id = ?', [user.institutionId]);
            if (instRows.length > 0) {
                const status = computePlanStatus(instRows[0].usage_plan, instRows[0].plan_start_date);
                if (status.expired) return res.status(403).json({ success: false, message: "Your institution's plan has expired." });
            }
        }

        const token = jwt.sign({ id: user.id, role: user.role, instId: user.institutionId }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            success: true, token,
            user: {
                id: user.id, name: user.name, email: user.email,
                username: user.username, role: user.role,
                institutionId: user.institutionId,
                profile_pic: user.profile_pic
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 2. DEVELOPER ENDPOINTS ==========================================
// =====================================================================
app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, username, role, institutionId, password FROM users');
        const decorated = insts.map(inst => ({ ...inst, ...computePlanStatus(inst.usage_plan, inst.plan_start_date) }));
        res.json({ institutions: decorated, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Onboard a new institution. Seeds ALL THREE system roles now. ---
app.post('/api/developer/onboard', async (req, res) => {
    const { name, type, logo, schoolKey, school_email, phone, usage_plan, plan_start_date,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const plan = PLAN_DAYS.hasOwnProperty(usage_plan) ? usage_plan : 'Full Time';
    const startDate = plan_start_date || new Date().toISOString().slice(0, 10);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, logo, schoolKey, school_email, phone, usage_plan, plan_start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, type, logo, schoolKey, school_email, phone, plan, startDate]
        );
        const instId = inst.insertId;

        // Create the Super Admin user account
        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, 'Super Admin', instId]
        );

        // Seed all 3 system roles. INSERT IGNORE is unnecessary because
        // the school is brand new, but cheap insurance against re-runs.
        for (const roleName of SYSTEM_ROLES) {
            await conn.execute(
                'INSERT IGNORE INTO roles (role_name, institutionId) VALUES (?, ?)',
                [roleName, instId]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, logo, school_email, phone, usage_plan, plan_start_date,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const plan = PLAN_DAYS.hasOwnProperty(usage_plan) ? usage_plan : 'Full Time';
    const startDate = plan_start_date || new Date().toISOString().slice(0, 10);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            'UPDATE institutions SET name = ?, type = ?, logo = ?, school_email = ?, phone = ?, usage_plan = ?, plan_start_date = ? WHERE id = ?',
            [name, type, logo, school_email, phone, plan, startDate, id]
        );
        await conn.execute(
            'UPDATE users SET name = ?, email = ?, password = ? WHERE institutionId = ? AND role = "Super Admin"',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );

        // Defensive: heal any pre-existing school that's missing system roles
        for (const roleName of SYSTEM_ROLES) {
            await conn.execute(
                'INSERT IGNORE INTO roles (role_name, institutionId) VALUES (?, ?)',
                [roleName, id]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/developer/institution/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM institutions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 3. SUPER ADMIN — School Aggregate Data ==========================
//          Also returns the systemRoles array so the frontend can lock
//          them without having to maintain its own list.
// =====================================================================
app.get('/api/admin/data/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [users]    = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const [classes]  = await db.execute('SELECT * FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const [years]    = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? ORDER BY startDate DESC', [instId]);
        const [roles]    = await db.execute('SELECT * FROM roles WHERE institutionId = ? ORDER BY role_name', [instId]);
        const [inst]     = await db.execute('SELECT * FROM institutions WHERE id = ?', [instId]);
        const [subjects] = await db.execute('SELECT * FROM subjects WHERE institutionId = ? ORDER BY name', [instId]);
        const [tsRows] = await db.execute(
            `SELECT ts.teacher_id, ts.subject_id FROM teacher_subjects ts
               JOIN users u ON u.id = ts.teacher_id WHERE u.institutionId = ?`, [instId]);
        const teacherSubjects = {};
        tsRows.forEach(r => {
            if (!teacherSubjects[r.teacher_id]) teacherSubjects[r.teacher_id] = [];
            teacherSubjects[r.teacher_id].push(r.subject_id);
        });
        const institution = inst[0] ? { ...inst[0], ...computePlanStatus(inst[0].usage_plan, inst[0].plan_start_date) } : null;
        res.json({
            users, classes, academicYears: years, roles, subjects,
            teacherSubjects, modules: DEFAULT_MODULES, institution,
            systemRoles: SYSTEM_ROLES
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 4. USERS — Full CRUD ============================================
// =====================================================================
app.post('/api/admin/users', async (req, res) => {
    const { name, email, username, password, role, institutionId, modules,
            phone_no, roll_no, admission_no, class_id, section, status,
            dob, gender, address, profile_pic, subject_ids } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO users
              (name, email, username, password, role, institutionId, modules,
               phone_no, roll_no, admission_no, class_id, section, status,
               dob, gender, address, profile_pic)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, username || null, password, role, institutionId, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active',
             dob || null, gender || null, address || null, profile_pic || null]
        );
        await syncTeacherSubjects(conn, result.insertId, role, subject_ids);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'Email or username already exists in this school.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, username, password, role, modules,
            phone_no, roll_no, admission_no, class_id, section, status,
            dob, gender, address, profile_pic, subject_ids } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            `UPDATE users SET
                name=?, email=?, username=?, password=?, role=?, modules=?,
                phone_no=?, roll_no=?, admission_no=?, class_id=?, section=?, status=?,
                dob=?, gender=?, address=?, profile_pic=?
              WHERE id=?`,
            [name, email, username || null, password, role, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active',
             dob || null, gender || null, address || null, profile_pic || null, id]
        );
        await syncTeacherSubjects(conn, parseInt(id, 10), role, subject_ids);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'Email or username already exists in this school.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 5. ROLES — system roles cannot be renamed or deleted ============
// =====================================================================
app.post('/api/admin/roles', async (req, res) => {
    const { role_name, institutionId } = req.body;
    const trimmed = (role_name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Role name is required.' });
    // Disallow creating a duplicate of any system role name (case-sensitive
    // unique key handles same-case; we also block trivial collisions).
    try {
        await db.execute('INSERT INTO roles (role_name, institutionId) VALUES (?, ?)', [trimmed, institutionId]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A role with that name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { role_name, institutionId } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [existing] = await conn.execute('SELECT role_name FROM roles WHERE id = ?', [id]);
        if (existing.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Role not found' });
        }
        const oldName = existing[0].role_name;

        // System role guard
        if (isSystemRole(oldName)) {
            await conn.rollback();
            return res.status(400).json({ error: `The system role "${oldName}" cannot be renamed.` });
        }
        // Also block renaming into a system role name
        if (isSystemRole(role_name)) {
            await conn.rollback();
            return res.status(400).json({ error: `"${role_name}" is a reserved system role name.` });
        }

        await conn.execute('UPDATE roles SET role_name = ? WHERE id = ?', [role_name, id]);
        await conn.execute('UPDATE users SET role = ? WHERE role = ? AND institutionId = ?', [role_name, oldName, institutionId]);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A role with that name already exists.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/admin/roles/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT role_name FROM roles WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        if (isSystemRole(rows[0].role_name)) {
            return res.status(400).json({ error: `The system role "${rows[0].role_name}" cannot be deleted.` });
        }
        await db.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 6. PERMISSIONS ==================================================
// =====================================================================
app.get('/api/admin/permissions/:roleId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM permissions WHERE role_id = ?', [req.params.roleId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/permissions', async (req, res) => {
    const { role_id, permissions } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM permissions WHERE role_id = ?', [role_id]);
        for (const p of permissions) {
            await conn.execute(
                'INSERT INTO permissions (role_id, module_name, can_read, can_edit, can_delete, is_hidden) VALUES (?, ?, ?, ?, ?, ?)',
                [role_id, p.module_name, p.can_read ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0, p.is_hidden ? 1 : 0]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.get('/api/admin/my-permissions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT p.module_name, p.can_read, p.can_edit, p.can_delete, p.is_hidden
               FROM users u
               JOIN roles r ON r.role_name = u.role AND r.institutionId = u.institutionId
               JOIN permissions p ON p.role_id = r.id
              WHERE u.id = ?`,
            [userId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 7. ACADEMIC YEARS ===============================================
// =====================================================================
app.post('/api/admin/academics', async (req, res) => {
    const { name, startDate, endDate, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO academic_years (name, startDate, endDate, isActive, institutionId) VALUES (?, ?, ?, 0, ?)',
            [name, startDate, endDate, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/academics/:id', async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;
    try {
        await db.execute('UPDATE academic_years SET name=?, startDate=?, endDate=? WHERE id=?', [name, startDate, endDate, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

app.delete('/api/admin/academics/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM academic_years WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 8. CLASSES ======================================================
// =====================================================================
app.post('/api/admin/classes', async (req, res) => {
    const { className, section, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)', [className, section || null, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/classes/bulk', async (req, res) => {
    const { className, sections, institutionId } = req.body;
    if (!className || !institutionId || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ error: 'className, institutionId and a non-empty sections array are required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const created = [], skipped = [];
        for (const rawSection of sections) {
            const section = (rawSection === null || rawSection === undefined || rawSection === '') ? null : String(rawSection).trim();
            try {
                await conn.execute('INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)', [className, section, institutionId]);
                created.push(section ?? '(no section)');
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) skipped.push(section ?? '(no section)');
                else throw err;
            }
        }
        await conn.commit();
        res.json({ success: true, created: created.length, createdSections: created, skipped });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/admin/classes/:id', async (req, res) => {
    const { id } = req.params;
    const { className, section } = req.body;
    try {
        await db.execute('UPDATE classes SET className=?, section=? WHERE id=?', [className, section || null, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ error: 'No students supplied' });
    try {
        const placeholders = studentIds.map(() => '?').join(',');
        await db.execute(`UPDATE users SET class_id = ?, section = ? WHERE id IN (${placeholders})`, [targetClassId, targetSection || null, ...studentIds]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 10. HEALTH CHECK ================================================
// =====================================================================
app.get('/', (req, res) => res.json({ status: 'ok', service: 'SmartEdz ERP', time: new Date().toISOString() }));


// =====================================================================
// === 11. TIMETABLE ===================================================
// =====================================================================
async function resolveYearId(instId, requestedYearId) {
    if (requestedYearId) return parseInt(requestedYearId, 10);
    const [rows] = await db.execute('SELECT id FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
    return rows[0]?.id || null;
}

app.get('/api/admin/timetable/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const yearId = await resolveYearId(instId, req.query.yearId);
        if (!yearId) {
            return res.json({
                academic_year_id: null, days: [], periods: [], entries: [],
                classes: [], teachers: [], subjects: [], teacherSubjects: {},
                message: 'No active academic year. Create one first under Academics.'
            });
        }
        const [days]     = await db.execute('SELECT * FROM timetable_days WHERE institutionId = ? AND academic_year_id = ? ORDER BY day_index', [instId, yearId]);
        const [periods]  = await db.execute('SELECT * FROM timetable_periods WHERE institutionId = ? AND academic_year_id = ? ORDER BY period_index', [instId, yearId]);
        const [entries]  = await db.execute('SELECT * FROM timetable_entries WHERE institutionId = ? AND academic_year_id = ?', [instId, yearId]);
        const [classes]  = await db.execute('SELECT * FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const [teachers] = await db.execute("SELECT id, name, email FROM users WHERE institutionId = ? AND LOWER(role) LIKE '%teacher%'", [instId]);
        const [subjects] = await db.execute('SELECT * FROM subjects WHERE institutionId = ? ORDER BY name', [instId]);
        const [tsRows] = await db.execute(
            `SELECT ts.teacher_id, ts.subject_id FROM teacher_subjects ts
               JOIN users u ON u.id = ts.teacher_id WHERE u.institutionId = ?`, [instId]);
        const teacherSubjects = {};
        tsRows.forEach(r => {
            if (!teacherSubjects[r.teacher_id]) teacherSubjects[r.teacher_id] = [];
            teacherSubjects[r.teacher_id].push(r.subject_id);
        });
        res.json({ academic_year_id: yearId, days, periods, entries, classes, teachers, subjects, teacherSubjects });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/timetable/days', async (req, res) => {
    const { institutionId, days } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_days WHERE institutionId = ? AND academic_year_id = ?', [institutionId, yearId]);
        for (const d of days) {
            await conn.execute('INSERT INTO timetable_days (institutionId, academic_year_id, day_index, day_name, is_working) VALUES (?, ?, ?, ?, ?)',
                [institutionId, yearId, d.day_index, d.day_name, d.is_working ? 1 : 0]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.post('/api/admin/timetable/periods', async (req, res) => {
    const { institutionId, periods } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_periods WHERE institutionId = ? AND academic_year_id = ?', [institutionId, yearId]);
        for (const p of periods) {
            await conn.execute('INSERT INTO timetable_periods (institutionId, academic_year_id, period_index, name, start_time, end_time, is_break) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [institutionId, yearId, p.period_index, p.name, p.start_time, p.end_time, p.is_break ? 1 : 0]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.post('/api/admin/timetable/entry', async (req, res) => {
    const { institutionId, class_id, day_id, period_id, subject_id, teacher_id, room_no } = req.body;
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) return res.status(400).json({ error: 'No academic year. Create one first.' });
        if (!subject_id && !teacher_id && !room_no) {
            await db.execute('DELETE FROM timetable_entries WHERE class_id = ? AND day_id = ? AND period_id = ?', [class_id, day_id, period_id]);
            return res.json({ success: true, cleared: true });
        }
        await db.execute(
            `INSERT INTO timetable_entries (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id), teacher_id = VALUES(teacher_id), room_no = VALUES(room_no)`,
            [institutionId, yearId, class_id, day_id, period_id, subject_id || null, teacher_id || null, room_no || null]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/timetable/entries/bulk', async (req, res) => {
    const { institutionId, class_id, entries } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_entries WHERE class_id = ? AND academic_year_id = ?', [class_id, yearId]);
        for (const e of entries) {
            if (!e.subject_id && !e.teacher_id && !e.room_no) continue;
            await conn.execute(
                `INSERT INTO timetable_entries (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [institutionId, yearId, class_id, e.day_id, e.period_id, e.subject_id || null, e.teacher_id || null, e.room_no || null]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// =====================================================================
// === 12. SUBJECTS ====================================================
// =====================================================================
app.post('/api/admin/subjects', async (req, res) => {
    const { name, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO subjects (name, institutionId) VALUES (?, ?)', [name, institutionId]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) return res.status(400).json({ error: 'A subject with this name already exists.' });
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/subjects/:id', async (req, res) => {
    try {
        await db.execute('UPDATE subjects SET name = ? WHERE id = ?', [req.body.name, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/subjects/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM subjects WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 13. ACADEMIC CALENDAR ===========================================
// =====================================================================
app.get('/api/admin/calendar/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM calendar_events WHERE institutionId = ? ORDER BY event_date ASC', [req.params.instId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/calendar', async (req, res) => {
    const { institutionId, name, event_date, time, description, type, adminId } = req.body;
    try {
        await db.execute('INSERT INTO calendar_events (institutionId, name, event_date, time, description, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [institutionId, name, event_date, time || null, description || null, type, adminId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/calendar/:id', async (req, res) => {
    const { name, event_date, time, description, type } = req.body;
    try {
        await db.execute('UPDATE calendar_events SET name=?, event_date=?, time=?, description=?, type=? WHERE id=?',
            [name, event_date, time || null, description || null, type, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/calendar/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM calendar_events WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 14. PROFILE — self-edit (locks password + role) =================
// =====================================================================
app.get('/api/profile/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, name, email, username, role, institutionId, phone_no, roll_no, admission_no,
                    class_id, section, status, dob, gender, address, profile_pic
               FROM users WHERE id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, username, phone_no, dob, gender, address, profile_pic } = req.body;
    try {
        await db.execute(
            `UPDATE users SET
                name = ?, email = ?, username = ?, phone_no = ?,
                dob = ?, gender = ?, address = ?, profile_pic = ?
              WHERE id = ?`,
            [name || null, email || null, username || null, phone_no || null,
             dob || null, gender || null, address || null, profile_pic || null, id]
        );
        const [rows] = await db.execute(
            `SELECT id, name, email, username, role, institutionId, phone_no, dob, gender, address, profile_pic
               FROM users WHERE id = ?`, [id]);
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'Email or username is already taken.' });
        }
        res.status(500).json({ error: err.message });
    }
});



// =====================================================================
// === 15. ATTENDANCE ==================================================
//   One row per user per day. Tracks marker + last editor.
//   Granularity: daily (no period/subject linkage).
//   Status codes: P (Present), A (Absent), L (Late).
// =====================================================================

// --- 15.1 Roster for marking ---------------------------------------
//   GET /api/admin/attendance/roster/:instId?category=students|teachers|other&date=YYYY-MM-DD&class_id=<id>
//   Returns the list of users in that category along with each user's
//   current status for the given date (or null if not marked yet).
app.get('/api/admin/attendance/roster/:instId', async (req, res) => {
    const { instId } = req.params;
    const { category = 'students', date, class_id } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
 
    try {
        // ---- Build the WHERE clause for users ------------------------
        let where = 'u.institutionId = ?';
        const params = [parseInt(instId, 10)];
 
        if (category === 'students') {
            // Match 'Student', 'student', ' Student ' — trim + lower for safety
            where += " AND LOWER(TRIM(u.role)) = 'student'";
            if (class_id) {
                where += ' AND u.class_id = ?';
                params.push(parseInt(class_id, 10));
            }
        } else if (category === 'teachers') {
            where += " AND LOWER(TRIM(u.role)) LIKE '%teacher%'";
        } else if (category === 'other') {
            where += " AND LOWER(TRIM(u.role)) NOT LIKE '%teacher%' "
                  +  " AND LOWER(TRIM(u.role)) NOT IN ('student','super admin','developer')";
        }
        // Status filter — accept active and also rows where status is NULL
        // (legacy users created before status column was non-null)
        where += " AND (u.status IS NULL OR LOWER(TRIM(u.status)) = 'active')";
 
        // ---- Query 1: Users ------------------------------------------
        const userSql = `
            SELECT u.id, u.name, u.username, u.role, u.profile_pic,
                   u.roll_no, u.class_id, u.section, u.status
              FROM users u
             WHERE ${where}
             ORDER BY u.name`;
 
        const [users] = await db.execute(userSql, params);
 
        // ---- Query 2: Attendance for those users on the given date ---
        // If this fails (e.g. table missing), we keep going.
        const attMap = {};
        let attendanceWarning = null;
        if (users.length > 0) {
            try {
                const ids = users.map(u => u.id);
                const placeholders = ids.map(() => '?').join(',');
                const attSql = `
                    SELECT a.user_id, a.status, a.marked_by, a.marked_at,
                           a.updated_by, a.updated_at,
                           mb.name AS marked_by_name, mb.role AS marked_by_role,
                           ub.name AS updated_by_name, ub.role AS updated_by_role
                      FROM attendance a
                      LEFT JOIN users mb ON mb.id = a.marked_by
                      LEFT JOIN users ub ON ub.id = a.updated_by
                     WHERE a.user_id IN (${placeholders}) AND a.attendance_date = ?`;
                const [att] = await db.execute(attSql, [...ids, targetDate]);
                att.forEach(r => { attMap[r.user_id] = r; });
            } catch (attErr) {
                console.warn('[attendance roster] attendance lookup failed:', attErr.message);
                attendanceWarning = attErr.message;
            }
        }
 
        // ---- Merge user + attendance --------------------------------
        const merged = users.map(u => ({ ...u, ...(attMap[u.id] || {}) }));
 
        // Diagnostic log so backend console tells us what happened
        console.log(`[attendance roster] inst=${instId} category=${category} class_id=${class_id || '—'} date=${targetDate} → ${merged.length} users`);
 
        res.json({
            date: targetDate,
            users: merged,
            count: merged.length,
            warning: attendanceWarning
        });
    } catch (err) {
        // Real DB error — surface it instead of hiding behind an empty list
        console.error('[attendance roster] FATAL:', err);
        res.status(500).json({ error: err.message, users: [] });
    }
});



// --- 15.2 Bulk mark / update attendance ----------------------------
//   POST /api/admin/attendance/mark
//   Body: { institutionId, date, actor_id, entries: [{user_id, status}] }
//   Upserts each row. If row exists → updates status, updated_by, updated_at.
//   If row doesn't exist → inserts with marked_by, marked_at.
app.post('/api/admin/attendance/mark', async (req, res) => {
    const { institutionId, date, actor_id, entries } = req.body;
    if (!institutionId || !date || !actor_id || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'institutionId, date, actor_id and entries[] are required.' });
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.user_id || !['P', 'A', 'L'].includes(e.status)) continue;

            // Does a row already exist?
            const [exists] = await conn.execute(
                'SELECT id FROM attendance WHERE user_id = ? AND attendance_date = ?',
                [e.user_id, date]
            );

            if (exists.length === 0) {
                // First time this user gets attendance for this date
                await conn.execute(
                    `INSERT INTO attendance
                       (institutionId, user_id, attendance_date, status, marked_by, marked_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [institutionId, e.user_id, date, e.status, actor_id, now]
                );
            } else {
                // Row exists — record the edit
                await conn.execute(
                    `UPDATE attendance
                        SET status = ?, updated_by = ?, updated_at = ?
                      WHERE user_id = ? AND attendance_date = ?`,
                    [e.status, actor_id, now, e.user_id, date]
                );
            }
        }
        await conn.commit();
        res.json({ success: true, count: entries.length });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 15.3 History for one user -------------------------------------
//   GET /api/admin/attendance/history/:userId?from=YYYY-MM-DD&to=YYYY-MM-DD
//   Returns each row in the range along with summary stats.
app.get('/api/admin/attendance/history/:userId', async (req, res) => {
    const { userId } = req.params;
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required.' });
    try {
        const [rows] = await db.execute(
            `SELECT a.id, a.attendance_date, a.status,
                    a.marked_by, a.marked_at, a.updated_by, a.updated_at,
                    mb.name AS marked_by_name, mb.role AS marked_by_role,
                    ub.name AS updated_by_name, ub.role AS updated_by_role
               FROM attendance a
               LEFT JOIN users mb ON mb.id = a.marked_by
               LEFT JOIN users ub ON ub.id = a.updated_by
              WHERE a.user_id = ? AND a.attendance_date BETWEEN ? AND ?
              ORDER BY a.attendance_date DESC`,
            [userId, from, to]
        );
        const summary = {
            total:   rows.length,
            present: rows.filter(r => r.status === 'P').length,
            absent:  rows.filter(r => r.status === 'A').length,
            late:    rows.filter(r => r.status === 'L').length
        };
        summary.percentage = summary.total > 0
            ? (((summary.present + summary.late) / summary.total) * 100).toFixed(1)
            : '0.0';
        res.json({ rows, summary });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 15.4 Teacher's marking scope ----------------------------------
//   GET /api/admin/attendance/teacher-classes/:teacherId
//   Returns the set of distinct classes this teacher is timetabled into.
//   Frontend uses this to scope the class dropdown.
app.get('/api/admin/attendance/teacher-classes/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT c.id, c.className, c.section
               FROM timetable_entries te
               JOIN classes c ON c.id = te.class_id
              WHERE te.teacher_id = ?
              ORDER BY c.className, c.section`,
            [teacherId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`));