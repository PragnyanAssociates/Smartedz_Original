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
    enableKeepAlive: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';

// =====================================================================
//  MODULE REGISTRY (mirror in frontend/src/modules.js)
// =====================================================================
const DEFAULT_MODULES = [
    'Overview',
    'Manage Logins',
    'Timetable',
    'AcademicCalendar'
];

// =====================================================================
//  PLAN / SUBSCRIPTION HELPERS
// =====================================================================
const PLAN_DAYS = {
    '7 days':   7,
    '30 days':  30,
    '90 days':  90,
    '180 days': 180,
    '1 year':   365,
    '3 years':  365 * 3,
    'Full Time': null
};

function computePlanStatus(plan, startDateStr) {
    const days = PLAN_DAYS[plan];
    if (days === null || days === undefined) {
        return { planEndDate: null, daysLeft: null, expired: false };
    }
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return { planEndDate: null, daysLeft: null, expired: false };
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endMid = new Date(end); endMid.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((endMid - today) / (1000 * 60 * 60 * 24));
    return { planEndDate: end.toISOString().slice(0, 10), daysLeft, expired: daysLeft < 0 };
}

// Helper: does a role name look like a teacher role?
const isTeacherRoleName = (role) => role && role.toLowerCase().includes('teacher');

// Helper: sync teacher_subjects join table for one user (inside a connection)
async function syncTeacherSubjects(conn, userId, role, subjectIds) {
    // Always wipe the user's mapping first
    await conn.execute('DELETE FROM teacher_subjects WHERE teacher_id = ?', [userId]);
    // Only insert if user is a teacher AND we got an array
    if (!isTeacherRoleName(role) || !Array.isArray(subjectIds)) return;
    for (const sid of subjectIds) {
        if (!sid) continue;
        await conn.execute(
            'INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)',
            [userId, parseInt(sid, 10)]
        );
    }
}


// =====================================================================
// === 1. AUTHENTICATION ===============================================
// =====================================================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND password = ?',
            [email, password]
        );
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });
        const user = rows[0];
        if (user.status === 'inactive') return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact your administrator.' });

        if (user.role !== 'Developer' && user.institutionId) {
            const [instRows] = await db.execute('SELECT usage_plan, plan_start_date FROM institutions WHERE id = ?', [user.institutionId]);
            if (instRows.length > 0) {
                const status = computePlanStatus(instRows[0].usage_plan, instRows[0].plan_start_date);
                if (status.expired) return res.status(403).json({ success: false, message: 'Your institution\'s plan has expired. Please contact SmartEdz to renew.' });
            }
        }

        const token = jwt.sign({ id: user.id, role: user.role, instId: user.institutionId }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            success: true, token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 2. DEVELOPER ENDPOINTS ==========================================
// =====================================================================
app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, role, institutionId, password FROM users');
        const decorated = insts.map(inst => ({ ...inst, ...computePlanStatus(inst.usage_plan, inst.plan_start_date) }));
        res.json({ institutions: decorated, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, 'Super Admin', instId]
        );
        await conn.execute('INSERT INTO roles (role_name, institutionId) VALUES (?, ?)', ['Super Admin', instId]);
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
// =====================================================================
// Now also returns subjects + teacherSubjects mapping for the User form.
app.get('/api/admin/data/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [users]    = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const [classes]  = await db.execute('SELECT * FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const [years]    = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? ORDER BY startDate DESC', [instId]);
        const [roles]    = await db.execute('SELECT * FROM roles WHERE institutionId = ? ORDER BY role_name', [instId]);
        const [inst]     = await db.execute('SELECT * FROM institutions WHERE id = ?', [instId]);
        const [subjects] = await db.execute('SELECT * FROM subjects WHERE institutionId = ? ORDER BY name', [instId]);

        // teacher_id → [subject_id, subject_id, ...]
        const [tsRows] = await db.execute(
            `SELECT ts.teacher_id, ts.subject_id
               FROM teacher_subjects ts
               JOIN users u ON u.id = ts.teacher_id
              WHERE u.institutionId = ?`,
            [instId]
        );
        const teacherSubjects = {};
        tsRows.forEach(r => {
            if (!teacherSubjects[r.teacher_id]) teacherSubjects[r.teacher_id] = [];
            teacherSubjects[r.teacher_id].push(r.subject_id);
        });

        const institution = inst[0] ? { ...inst[0], ...computePlanStatus(inst[0].usage_plan, inst[0].plan_start_date) } : null;
        res.json({
            users, classes, academicYears: years, roles, subjects,
            teacherSubjects,
            modules: DEFAULT_MODULES,
            institution
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 4. USERS — Full CRUD (with teacher_subjects sync) ===============
// =====================================================================

// --- 4.1 Create
app.post('/api/admin/users', async (req, res) => {
    const { name, email, password, role, institutionId, modules,
            phone_no, roll_no, admission_no, class_id, section, status,
            subject_ids } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO users (name, email, password, role, institutionId, modules, phone_no, roll_no, admission_no, class_id, section, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, password, role, institutionId, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active']
        );
        await syncTeacherSubjects(conn, result.insertId, role, subject_ids);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 4.2 Update
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, modules,
            phone_no, roll_no, admission_no, class_id, section, status,
            subject_ids } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            `UPDATE users SET name=?, email=?, password=?, role=?, modules=?,
                    phone_no=?, roll_no=?, admission_no=?, class_id=?, section=?, status=? WHERE id=?`,
            [name, email, password, role, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active', id]
        );
        await syncTeacherSubjects(conn, parseInt(id, 10), role, subject_ids);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 4.3 Delete
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        // teacher_subjects rows cascade-delete via FK
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 5. ROLES — Full CRUD ============================================
// =====================================================================
app.post('/api/admin/roles', async (req, res) => {
    const { role_name, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO roles (role_name, institutionId) VALUES (?, ?)', [role_name, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        await conn.execute('UPDATE users SET role = ? WHERE role = ? AND institutionId = ?', [role_name, oldName, institutionId]);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/admin/roles/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT role_name FROM roles WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        if (rows[0].role_name === 'Super Admin') return res.status(400).json({ error: 'The system role "Super Admin" cannot be deleted.' });
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
// === 7. ACADEMIC YEARS — Full CRUD ===================================
// =====================================================================
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
// === 8. CLASSES — Full CRUD ==========================================
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
        await db.execute(
            `UPDATE users SET class_id = ?, section = ? WHERE id IN (${placeholders})`,
            [targetClassId, targetSection || null, ...studentIds]
        );
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
    const [rows] = await db.execute(
        'SELECT id FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1',
        [instId]
    );
    return rows[0]?.id || null;
}

// --- 11.1 Read everything timetable-related, including teacher→subject map
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

        // Build teacher_id → [subject_id, ...] map so the cell dropdown can
        // filter to "teachers who teach this subject".
        const [tsRows] = await db.execute(
            `SELECT ts.teacher_id, ts.subject_id
               FROM teacher_subjects ts
               JOIN users u ON u.id = ts.teacher_id
              WHERE u.institutionId = ?`,
            [instId]
        );
        const teacherSubjects = {};
        tsRows.forEach(r => {
            if (!teacherSubjects[r.teacher_id]) teacherSubjects[r.teacher_id] = [];
            teacherSubjects[r.teacher_id].push(r.subject_id);
        });

        res.json({ academic_year_id: yearId, days, periods, entries, classes, teachers, subjects, teacherSubjects });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 11.2 Bulk-replace working days
app.post('/api/admin/timetable/days', async (req, res) => {
    const { institutionId, days } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_days WHERE institutionId = ? AND academic_year_id = ?', [institutionId, yearId]);
        for (const d of days) {
            await conn.execute(
                'INSERT INTO timetable_days (institutionId, academic_year_id, day_index, day_name, is_working) VALUES (?, ?, ?, ?, ?)',
                [institutionId, yearId, d.day_index, d.day_name, d.is_working ? 1 : 0]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 11.3 Bulk-replace periods (cascade-clears entries too)
app.post('/api/admin/timetable/periods', async (req, res) => {
    const { institutionId, periods } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_periods WHERE institutionId = ? AND academic_year_id = ?', [institutionId, yearId]);
        for (const p of periods) {
            await conn.execute(
                'INSERT INTO timetable_periods (institutionId, academic_year_id, period_index, name, start_time, end_time, is_break) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [institutionId, yearId, p.period_index, p.name, p.start_time, p.end_time, p.is_break ? 1 : 0]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 11.4 Upsert a single cell
app.post('/api/admin/timetable/entry', async (req, res) => {
    const { institutionId, class_id, day_id, period_id, subject_id, teacher_id, room_no } = req.body;
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) return res.status(400).json({ error: 'No academic year. Create one first.' });

        if (!subject_id && !teacher_id && !room_no) {
            await db.execute(
                'DELETE FROM timetable_entries WHERE class_id = ? AND day_id = ? AND period_id = ?',
                [class_id, day_id, period_id]
            );
            return res.json({ success: true, cleared: true });
        }
        await db.execute(
            `INSERT INTO timetable_entries
                (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                subject_id = VALUES(subject_id),
                teacher_id = VALUES(teacher_id),
                room_no    = VALUES(room_no)`,
            [institutionId, yearId, class_id, day_id, period_id, subject_id || null, teacher_id || null, room_no || null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 11.5 Bulk save all cells for one class
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
                `INSERT INTO timetable_entries
                    (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [institutionId, yearId, class_id, e.day_id, e.period_id,
                 e.subject_id || null, e.teacher_id || null, e.room_no || null]
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
// === 12. SUBJECTS — Full CRUD ========================================
// =====================================================================
app.post('/api/admin/subjects', async (req, res) => {
    const { name, institutionId } = req.body;
    try {
        await db.execute('INSERT INTO subjects (name, institutionId) VALUES (?, ?)', [name, institutionId]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A subject with this name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/subjects/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        await db.execute('UPDATE subjects SET name = ? WHERE id = ?', [name, id]);
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

// Get all events for an institution
app.get('/api/admin/calendar/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM calendar_events WHERE institutionId = ? ORDER BY event_date ASC',
            [req.params.instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create event
app.post('/api/admin/calendar', async (req, res) => {
    const { institutionId, name, event_date, time, description, type, adminId } = req.body;
    try {
        await db.execute(
            'INSERT INTO calendar_events (institutionId, name, event_date, time, description, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [institutionId, name, event_date, time || null, description || null, type, adminId]
        );
        res.json({ success: true, message: 'Event created successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update event
app.put('/api/admin/calendar/:id', async (req, res) => {
    const { name, event_date, time, description, type } = req.body;
    try {
        await db.execute(
            'UPDATE calendar_events SET name=?, event_date=?, time=?, description=?, type=? WHERE id=?',
            [name, event_date, time || null, description || null, type, req.params.id]
        );
        res.json({ success: true, message: 'Event updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete event
app.delete('/api/admin/calendar/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM calendar_events WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Event deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
// === SERVER BOOT =====================================================
// =====================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`));