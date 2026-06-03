// =====================================================================
//  SmartEdz ERP - Unified Backend (single file)
// =====================================================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';
// =====================================================================
// SECURITY MIDDLEWARE: Verify JWT Token
// =====================================================================

// =====================================================================
//  MODULE REGISTRY (mirror in frontend/src/Screens/Modules.js)
// =====================================================================
const DEFAULT_MODULES = [
    'Overview',
    'Manage Logins',
    'Timetable',
    'Academic Calendar',
    'Attendance',
    'Exams',
    'Reports',
    'Performance',
    'Directory',
    'Gallery',
    'Homework',
    'Meals',
    'PTM',
    'OnlineClasses',
    'DigitalLabs',
    'PreAdmissions',
    'StudyMaterials',
    'Syllabus',
    'GroupChat',
    'Alumni',
    'LessonPlan'
    
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
 
        // NEW — subject → [classIds] map
        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
        const subjectClasses = {};
        scRows.forEach(r => {
            if (!subjectClasses[r.subject_id]) subjectClasses[r.subject_id] = [];
            subjectClasses[r.subject_id].push(r.class_id);
        });
 
        const institution = inst[0] ? { ...inst[0], ...computePlanStatus(inst[0].usage_plan, inst[0].plan_start_date) } : null;
        res.json({
            users, classes, academicYears: years, roles, subjects,
            teacherSubjects, subjectClasses, modules: DEFAULT_MODULES, institution,
            systemRoles: SYSTEM_ROLES
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 4. USERS — Full CRUD ============================================
// =====================================================================

function _todayISO() {
    return new Date().toISOString().slice(0, 10);
}

// Is this string a real, parseable date?
function _isValidDate(s) {
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
}

// Synchronous format / range validation. Returns an error string, or
// null when everything is fine.
function validateUserData(body) {
    const {
        role, phone_no, aadhar_no, pen_no, tc_number,
        joining_date,
        school_joined_date, school_joined_grade
    } = body;

    const today = _todayISO();
    const isStaff = role === 'Super Admin' || (role || '').toLowerCase().includes('teacher');

    // --- Phone: exactly 10 digits, numbers only, cannot start with 0 ---
    if (phone_no && !/^[1-9][0-9]{9}$/.test(String(phone_no))) {
        return 'Phone number must be exactly 10 digits (numbers only) and cannot start with 0.';
    }

    // --- Aadhaar: exactly 12 digits, numbers only ----------------------
    if (aadhar_no && !/^[0-9]{12}$/.test(String(aadhar_no))) {
        return 'Aadhaar number must be exactly 12 digits (numbers only).';
    }

    // --- PEN: alphanumeric, 6-20 chars ---------------------------------
    if (pen_no && !/^[A-Za-z0-9]{6,20}$/.test(String(pen_no))) {
        return 'PEN number must be 6-20 characters, letters and numbers only.';
    }

    // --- TC number: alphanumeric, 5-20 chars ---------------------------
    if (tc_number && !/^[A-Za-z0-9]{5,20}$/.test(String(tc_number))) {
        return 'TC number must be 5-20 characters, letters and numbers only.';
    }

    // --- Staff joining date: valid, not in the future ------------------
    if (isStaff && joining_date) {
        if (!_isValidDate(joining_date)) return 'Joining date is not a valid date.';
        if (joining_date > today)        return 'Joining date cannot be in the future.';
    }

    // --- Student school joined grade: whole number 1-12 ----------------
    if (school_joined_grade !== '' && school_joined_grade != null) {
        const g = parseInt(school_joined_grade, 10);
        if (isNaN(g) || g < 1 || g > 12) {
            return 'School joined grade must be a whole number between 1 and 12.';
        }
    }

    // --- Student school joined date: valid, not in the future ----------
    if (school_joined_date) {
        if (!_isValidDate(school_joined_date)) return 'School joined date is not a valid date.';
        if (school_joined_date > today)        return 'School joined date cannot be in the future.';
    }

    return null;
}

// Is `value` already used by ANOTHER user in the same school?
// `column` is always a hard-coded name from our own code (never user
// input), so interpolating it here is safe.
async function _isFieldTaken(conn, instId, column, value, excludeId) {
    if (!value) return false;
    const [rows] = await conn.execute(
        `SELECT id FROM users WHERE institutionId = ? AND ${column} = ? AND id <> ?`,
        [instId, value, excludeId || 0]
    );
    return rows.length > 0;
}

// Roll No, PEN No and TC No must each be unique within the school.
// Returns an error string, or null when all are free.
async function checkUserUniqueness(conn, instId, body, excludeId) {
    const checks = [
        ['roll_no',   body.roll_no,   'Roll number'],
        ['pen_no',    body.pen_no,    'PEN number'],
        ['tc_number', body.tc_number, 'TC number'],
    ];
    for (const [col, val, label] of checks) {
        if (val && await _isFieldTaken(conn, instId, col, val, excludeId)) {
            return `${label} "${val}" is already used by another user in this school.`;
        }
    }
    return null;
}


// ---------------------------------------------------------------------
//  4.1  Create user
// ---------------------------------------------------------------------
app.post('/api/admin/users', async (req, res) => {
    const body = req.body;
    const {
        name, email, username, password, role, institutionId, modules,
        phone_no, roll_no, admission_no, class_id, section, status,
        dob, gender, address, profile_pic, subject_ids,
        // staff
        aadhar_no, joining_date, prev_salary, present_salary, experience,
        // student
        pen_no, parent_name, admission_date,
        school_joined_date, school_joined_grade, tc_number
    } = body;

    // 1) Format / range validation (fast, no DB needed)
    const vErr = validateUserData(body);
    if (vErr) return res.status(400).json({ error: vErr });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 2) Uniqueness (roll / PEN / TC) within this school
        const uErr = await checkUserUniqueness(conn, institutionId, body, 0);
        if (uErr) { await conn.rollback(); return res.status(400).json({ error: uErr }); }

        // 3) Insert
        const [result] = await conn.execute(
            `INSERT INTO users
              (name, email, username, password, role, institutionId, modules,
               phone_no, roll_no, admission_no, class_id, section, status,
               dob, gender, address, profile_pic,
               aadhar_no, joining_date, prev_salary, present_salary, experience,
               pen_no, parent_name, admission_date,
               school_joined_date, school_joined_grade, tc_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, username || null, password, role, institutionId, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active',
             dob || null, gender || null, address || null, profile_pic || null,
             // staff
             aadhar_no || null, joining_date || null,
             prev_salary || null, present_salary || null, experience || null,
             // student
             pen_no || null, parent_name || null, admission_date || null,
             school_joined_date || null,
             school_joined_grade ? parseInt(school_joined_grade, 10) : null,
             tc_number || null]
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


// ---------------------------------------------------------------------
//  4.2  Update user
// ---------------------------------------------------------------------
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const {
        name, email, username, password, role, modules,
        phone_no, roll_no, admission_no, class_id, section, status,
        dob, gender, address, profile_pic, subject_ids,
        // staff
        aadhar_no, joining_date, prev_salary, present_salary, experience,
        // student
        pen_no, parent_name, admission_date,
        school_joined_date, school_joined_grade, tc_number
    } = body;

    // 1) Format / range validation
    const vErr = validateUserData(body);
    if (vErr) return res.status(400).json({ error: vErr });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 2) Find this user's school so uniqueness is scoped correctly
        const [owner] = await conn.execute('SELECT institutionId FROM users WHERE id = ?', [id]);
        if (owner.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'User not found.' }); }
        const instId = owner[0].institutionId;

        // 3) Uniqueness (excluding this same user)
        const uErr = await checkUserUniqueness(conn, instId, body, parseInt(id, 10));
        if (uErr) { await conn.rollback(); return res.status(400).json({ error: uErr }); }

        // 4) Update
        await conn.execute(
            `UPDATE users SET
                name=?, email=?, username=?, password=?, role=?, modules=?,
                phone_no=?, roll_no=?, admission_no=?, class_id=?, section=?, status=?,
                dob=?, gender=?, address=?, profile_pic=?,
                aadhar_no=?, joining_date=?, prev_salary=?, present_salary=?, experience=?,
                pen_no=?, parent_name=?, admission_date=?,
                school_joined_date=?, school_joined_grade=?, tc_number=?
              WHERE id=?`,
            [name, email, username || null, password, role, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active',
             dob || null, gender || null, address || null, profile_pic || null,
             // staff
             aadhar_no || null, joining_date || null,
             prev_salary || null, present_salary || null, experience || null,
             // student
             pen_no || null, parent_name || null, admission_date || null,
             school_joined_date || null,
             school_joined_grade ? parseInt(school_joined_grade, 10) : null,
             tc_number || null,
             id]
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
//
//  PASTE THIS BLOCK BACK IN between Section 4 (Users, ends at the
//  "4.3 Delete user" route) and Section 6 (Permissions).
//
//  It was accidentally removed when the Section 4 (Users) block was
//  replaced earlier, which is why "Failed to save role" was happening
//  (the POST /api/admin/roles route no longer existed).
//
//  The three system roles — Super Admin, Teacher, Student — are fixed
//  for every institution: they cannot be renamed or deleted, and no new
//  role may reuse their names. Every OTHER role can be freely added,
//  renamed, deleted, and given module permissions.
//
//  Uses SYSTEM_ROLES / isSystemRole already defined at the top of the
//  file, so no extra setup is needed.
// =====================================================================

// --- 5.1 Create a custom role ----------------------------------------
app.post('/api/admin/roles', async (req, res) => {
    const { role_name, institutionId } = req.body;
    const trimmed = (role_name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Role name is required.' });
    if (!institutionId) return res.status(400).json({ error: 'institutionId is required.' });

    // Block creating a duplicate of any reserved system role name
    if (isSystemRole(trimmed)) {
        return res.status(400).json({ error: `"${trimmed}" is a reserved system role name.` });
    }

    try {
        await db.execute(
            'INSERT INTO roles (role_name, institutionId) VALUES (?, ?)',
            [trimmed, institutionId]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A role with that name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- 5.2 Rename a role (system roles blocked) ------------------------
app.put('/api/admin/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { role_name, institutionId } = req.body;
    const trimmed = (role_name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Role name is required.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.execute('SELECT role_name FROM roles WHERE id = ?', [id]);
        if (existing.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Role not found' });
        }
        const oldName = existing[0].role_name;

        // Cannot rename a system role
        if (isSystemRole(oldName)) {
            await conn.rollback();
            return res.status(400).json({ error: `The system role "${oldName}" cannot be renamed.` });
        }
        // Cannot rename INTO a reserved system role name
        if (isSystemRole(trimmed)) {
            await conn.rollback();
            return res.status(400).json({ error: `"${trimmed}" is a reserved system role name.` });
        }

        await conn.execute('UPDATE roles SET role_name = ? WHERE id = ?', [trimmed, id]);
        // Keep users in sync with the new role name
        await conn.execute(
            'UPDATE users SET role = ? WHERE role = ? AND institutionId = ?',
            [trimmed, oldName, institutionId]
        );

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

// --- 5.3 Delete a role (system roles blocked) ------------------------
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
    const { name, institutionId, class_ids } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            'INSERT INTO subjects (name, institutionId) VALUES (?, ?)',
            [name, institutionId]
        );
        const subjectId = result.insertId;
        if (Array.isArray(class_ids)) {
            for (const cid of class_ids) {
                if (!cid) continue;
                await conn.execute(
                    'INSERT IGNORE INTO subject_classes (subject_id, class_id) VALUES (?, ?)',
                    [subjectId, parseInt(cid, 10)]
                );
            }
        }
        await conn.commit();
        res.json({ success: true, id: subjectId });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A subject with this name already exists.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/admin/subjects/:id', async (req, res) => {
    const { name, class_ids } = req.body;
    const subjectId = parseInt(req.params.id, 10);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('UPDATE subjects SET name = ? WHERE id = ?', [name, subjectId]);
        // Re-sync class links wholesale when class_ids is supplied
        if (Array.isArray(class_ids)) {
            await conn.execute('DELETE FROM subject_classes WHERE subject_id = ?', [subjectId]);
            for (const cid of class_ids) {
                if (!cid) continue;
                await conn.execute(
                    'INSERT IGNORE INTO subject_classes (subject_id, class_id) VALUES (?, ?)',
                    [subjectId, parseInt(cid, 10)]
                );
            }
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'A subject with this name already exists.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


app.delete('/api/admin/subjects/:id', async (req, res) => {
    try {
        // subject_classes rows cascade-delete via FK
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
// === 16. EXAMS & EXAM SCHEDULES =======================================
//
//   Two related features:
//     • exam_schedules: printable exam timetables (date/subject/time/room)
//     • online_exams:   actual assessments students attempt in-browser
// =====================================================================

// Helper — does a JSON column have content? schedule_data comes back as
// a string or already-parsed array depending on MySQL version/driver.
const parseJsonSafe = (val, fallback = []) => {
    if (val === null || val === undefined) return fallback;
    if (Array.isArray(val) || typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const nowSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');


// =====================================================================
// === 16.A EXAM SCHEDULES =============================================
// =====================================================================

// --- 16.A.1 List all schedules for a school -----------------------
//   GET /api/admin/exam-schedules/:instId
app.get('/api/admin/exam-schedules/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT s.*, c.className, u.name AS created_by_name
               FROM exam_schedules s
               LEFT JOIN classes c ON c.id = s.class_id
               LEFT JOIN users u ON u.id = s.created_by
              WHERE s.institutionId = ?
              ORDER BY s.created_at DESC`,
            [req.params.instId]
        );
        const decorated = rows.map(r => ({
            ...r,
            schedule_data: parseJsonSafe(r.schedule_data, [])
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.A.2 List schedules visible to a student -------------------
//   GET /api/admin/exam-schedules/student/:studentId
//   Returns schedules where (class_id = student.class_id OR class_id IS NULL)
//   AND (section = student.section OR section IS NULL).
app.get('/api/admin/exam-schedules/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id, section FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        const { institutionId, class_id, section } = u[0];

        const [rows] = await db.execute(
            `SELECT s.*, c.className, usr.name AS created_by_name
               FROM exam_schedules s
               LEFT JOIN classes c   ON c.id = s.class_id
               LEFT JOIN users usr   ON usr.id = s.created_by
              WHERE s.institutionId = ?
                AND (s.class_id IS NULL OR s.class_id = ?)
                AND (s.section  IS NULL OR s.section = ?)
              ORDER BY s.created_at DESC`,
            [institutionId, class_id || 0, section || '']
        );
        const decorated = rows.map(r => ({
            ...r,
            schedule_data: parseJsonSafe(r.schedule_data, [])
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.A.3 Get single schedule -----------------------------------
app.get('/api/admin/exam-schedules/single/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT s.*, c.className, u.name AS created_by_name
               FROM exam_schedules s
               LEFT JOIN classes c ON c.id = s.class_id
               LEFT JOIN users u ON u.id = s.created_by
              WHERE s.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
        const r = rows[0];
        res.json({ ...r, schedule_data: parseJsonSafe(r.schedule_data, []) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.A.4 Create schedule ---------------------------------------
//   class_id = null means "All classes"
//   section  = null means "all sections in the class"
app.post('/api/admin/exam-schedules', async (req, res) => {
    const {
        institutionId, title, subtitle, exam_type,
        class_id, section, schedule_data, created_by
    } = req.body;
    if (!institutionId || !title) return res.status(400).json({ error: 'institutionId and title required.' });
    try {
        const [result] = await db.execute(
            `INSERT INTO exam_schedules
               (institutionId, title, subtitle, exam_type, class_id, section, schedule_data, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, subtitle || null, exam_type || 'Internal',
             class_id || null, section || null, JSON.stringify(schedule_data || []), created_by || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.A.5 Update schedule ---------------------------------------
app.put('/api/admin/exam-schedules/:id', async (req, res) => {
    const { title, subtitle, exam_type, class_id, section, schedule_data } = req.body;
    try {
        await db.execute(
            `UPDATE exam_schedules
                SET title = ?, subtitle = ?, exam_type = ?, class_id = ?, section = ?, schedule_data = ?
              WHERE id = ?`,
            [title, subtitle || null, exam_type || 'Internal',
             class_id || null, section || null, JSON.stringify(schedule_data || []), req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.A.6 Delete schedule ---------------------------------------
app.delete('/api/admin/exam-schedules/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM exam_schedules WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 16.B ONLINE EXAMS ===============================================
// =====================================================================

// --- 16.B.1 List exams created by/visible to a teacher ------------
//   GET /api/admin/exams/teacher/:teacherId?instId=...
//   Super Admin gets ALL exams in the school; teachers get only their own.
app.get('/api/admin/exams/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [users] = await db.execute('SELECT id, role, institutionId FROM users WHERE id = ?', [teacherId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        let sql, params;
        if (isAdmin) {
            sql = `SELECT e.*, c.className, sub.name AS subject_name, u.name AS created_by_name,
                          (SELECT COUNT(*) FROM online_exam_attempts a WHERE a.exam_id = e.id) AS submission_count,
                          (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count
                     FROM online_exams e
                     LEFT JOIN classes c   ON c.id = e.class_id
                     LEFT JOIN subjects sub ON sub.id = e.subject_id
                     LEFT JOIN users u     ON u.id = e.created_by
                    WHERE e.institutionId = ?
                    ORDER BY e.created_at DESC`;
            params = [me.institutionId];
        } else {
            sql = `SELECT e.*, c.className, sub.name AS subject_name, u.name AS created_by_name,
                          (SELECT COUNT(*) FROM online_exam_attempts a WHERE a.exam_id = e.id) AS submission_count,
                          (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count
                     FROM online_exams e
                     LEFT JOIN classes c   ON c.id = e.class_id
                     LEFT JOIN subjects sub ON sub.id = e.subject_id
                     LEFT JOIN users u     ON u.id = e.created_by
                    WHERE e.created_by = ?
                    ORDER BY e.created_at DESC`;
            params = [teacherId];
        }
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.B.2 List exams for a student to take ----------------------
//   GET /api/admin/exams/student/:studentId
//   Returns exams where the student's class+section match, with attempt status.
app.get('/api/admin/exams/student/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [u] = await db.execute('SELECT institutionId, class_id, section FROM users WHERE id = ?', [studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        const { institutionId, class_id, section } = u[0];

        const [rows] = await db.execute(
            `SELECT e.id AS exam_id, e.title, e.description, e.time_limit_mins, e.total_marks,
                    e.class_id, e.section, e.status AS exam_status,
                    c.className, sub.name AS subject_name,
                    (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count,
                    a.id AS attempt_id, a.status AS attempt_status, a.final_score, a.submitted_at
               FROM online_exams e
               LEFT JOIN classes c    ON c.id = e.class_id
               LEFT JOIN subjects sub ON sub.id = e.subject_id
               LEFT JOIN online_exam_attempts a ON a.exam_id = e.id AND a.student_id = ?
              WHERE e.institutionId = ?
                AND e.class_id = ?
                AND (e.section IS NULL OR e.section = ?)
                AND e.status = 'published'
              ORDER BY e.created_at DESC`,
            [studentId, institutionId, class_id || 0, section || '']
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.B.3 Get single exam (with questions, for editor or preview)
app.get('/api/admin/exams/:examId', async (req, res) => {
    try {
        const [exam] = await db.execute(
            `SELECT e.*, c.className, sub.name AS subject_name, u.name AS created_by_name
               FROM online_exams e
               LEFT JOIN classes c   ON c.id = e.class_id
               LEFT JOIN subjects sub ON sub.id = e.subject_id
               LEFT JOIN users u     ON u.id = e.created_by
              WHERE e.id = ?`,
            [req.params.examId]
        );
        if (exam.length === 0) return res.status(404).json({ error: 'Exam not found' });

        const [questions] = await db.execute(
            'SELECT * FROM online_exam_questions WHERE exam_id = ? ORDER BY question_order, id',
            [req.params.examId]
        );
        const qList = questions.map(q => ({ ...q, options: parseJsonSafe(q.options, null) }));
        res.json({ ...exam[0], questions: qList });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.B.4 Create or update exam --------------------------------
//   Body: { institutionId, title, description, class_id, section, subject_id,
//           time_limit_mins, status, created_by, questions: [...] }
app.post('/api/admin/exams', async (req, res) => {
    const {
        institutionId, title, description, class_id, section, subject_id,
        time_limit_mins, status, created_by, questions = []
    } = req.body;
    if (!institutionId || !title || !class_id || !created_by) {
        return res.status(400).json({ error: 'institutionId, title, class_id and created_by are required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const totalMarks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        const [result] = await conn.execute(
            `INSERT INTO online_exams
              (institutionId, title, description, class_id, section, subject_id,
               time_limit_mins, total_marks, created_by, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, description || null, class_id, section || null,
             subject_id || null, parseInt(time_limit_mins, 10) || 0, totalMarks,
             created_by, status || 'published']
        );
        const examId = result.insertId;

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await conn.execute(
                `INSERT INTO online_exam_questions
                   (exam_id, question_text, question_type, options, correct_answer, marks, question_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [examId, q.question_text || '', q.question_type || 'multiple_choice',
                 q.options ? JSON.stringify(q.options) : null,
                 q.correct_answer || null, parseInt(q.marks, 10) || 1, i]
            );
        }
        await conn.commit();
        res.json({ success: true, id: examId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/admin/exams/:examId', async (req, res) => {
    const {
        title, description, class_id, section, subject_id,
        time_limit_mins, status, questions = []
    } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const totalMarks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);

        await conn.execute(
            `UPDATE online_exams
                SET title = ?, description = ?, class_id = ?, section = ?, subject_id = ?,
                    time_limit_mins = ?, total_marks = ?, status = ?
              WHERE id = ?`,
            [title, description || null, class_id, section || null, subject_id || null,
             parseInt(time_limit_mins, 10) || 0, totalMarks, status || 'published',
             req.params.examId]
        );

        // Replace questions wholesale. Existing attempts keep their stored
        // answer_text but the link to question_id may break if user removed
        // questions — that's by design and warned in the UI.
        await conn.execute('DELETE FROM online_exam_questions WHERE exam_id = ?', [req.params.examId]);
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await conn.execute(
                `INSERT INTO online_exam_questions
                   (exam_id, question_text, question_type, options, correct_answer, marks, question_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.params.examId, q.question_text || '', q.question_type || 'multiple_choice',
                 q.options ? JSON.stringify(q.options) : null,
                 q.correct_answer || null, parseInt(q.marks, 10) || 1, i]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/admin/exams/:examId', async (req, res) => {
    try {
        await db.execute('DELETE FROM online_exams WHERE id = ?', [req.params.examId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 16.C ATTEMPTS (student takes the exam) ==========================
// =====================================================================

// --- 16.C.1 Get questions without answers (for student to take) ---
app.get('/api/admin/exams/:examId/take', async (req, res) => {
    try {
        const [questions] = await db.execute(
            `SELECT id, question_text, question_type, options, marks, question_order
               FROM online_exam_questions
              WHERE exam_id = ?
              ORDER BY question_order, id`,
            [req.params.examId]
        );
        // Don't leak correct_answer to the client
        const qList = questions.map(q => ({ ...q, options: parseJsonSafe(q.options, null) }));
        res.json(qList);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.C.2 Start (or resume) an attempt --------------------------
app.post('/api/admin/exams/:examId/start', async (req, res) => {
    const { examId } = req.params;
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id required.' });
    try {
        const [existing] = await db.execute(
            'SELECT id, status FROM online_exam_attempts WHERE exam_id = ? AND student_id = ?',
            [examId, student_id]
        );
        if (existing.length > 0) {
            const att = existing[0];
            if (att.status === 'submitted' || att.status === 'graded') {
                return res.status(400).json({ error: 'You have already submitted this exam.' });
            }
            return res.json({ attempt_id: att.id, resumed: true });
        }
        const [result] = await db.execute(
            'INSERT INTO online_exam_attempts (exam_id, student_id, status, started_at) VALUES (?, ?, ?, ?)',
            [examId, student_id, 'in_progress', nowSQL()]
        );
        res.json({ attempt_id: result.insertId, resumed: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.C.3 Submit answers ----------------------------------------
//   Body: { student_id, answers: { question_id: answer_text, ... } }
//   Auto-grades MCQ rows where correct_answer matches student's answer.
app.post('/api/admin/attempts/:attemptId/submit', async (req, res) => {
    const { attemptId } = req.params;
    const { student_id, answers = {} } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [att] = await conn.execute(
            'SELECT exam_id, student_id, status FROM online_exam_attempts WHERE id = ?',
            [attemptId]
        );
        if (att.length === 0) throw new Error('Attempt not found');
        if (att[0].student_id !== parseInt(student_id, 10)) throw new Error('Not your attempt');
        if (att[0].status !== 'in_progress') throw new Error('Already submitted');

        const examId = att[0].exam_id;
        const [qs] = await conn.execute(
            'SELECT id, question_type, correct_answer, marks FROM online_exam_questions WHERE exam_id = ?',
            [examId]
        );

        let autoScore = 0;
        for (const q of qs) {
            const studentAns = (answers[q.id] ?? '').toString();
            let marksAwarded = null;
            let isAuto = 0;
            if (q.question_type === 'multiple_choice' && q.correct_answer) {
                if (studentAns === q.correct_answer) {
                    marksAwarded = q.marks;
                    autoScore += q.marks;
                } else {
                    marksAwarded = 0;
                }
                isAuto = 1;
            }
            await conn.execute(
                `INSERT INTO online_exam_answers (attempt_id, question_id, answer_text, marks_awarded, is_auto_graded)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text),
                                         marks_awarded = VALUES(marks_awarded),
                                         is_auto_graded = VALUES(is_auto_graded)`,
                [attemptId, q.id, studentAns || null, marksAwarded, isAuto]
            );
        }

        // If every question was MCQ, mark as graded immediately. Otherwise
        // keep status='submitted' until a teacher grades the written ones.
        const allMCQ = qs.every(q => q.question_type === 'multiple_choice');
        await conn.execute(
            `UPDATE online_exam_attempts
                SET status = ?, submitted_at = ?, final_score = ?, graded_at = ?
              WHERE id = ?`,
            [allMCQ ? 'graded' : 'submitted', nowSQL(), autoScore,
             allMCQ ? nowSQL() : null, attemptId]
        );
        await conn.commit();
        res.json({ success: true, auto_score: autoScore, fully_graded: allMCQ });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 16.C.4 List submissions for an exam (teacher view) ----------
app.get('/api/admin/exams/:examId/submissions', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT a.id AS attempt_id, a.status, a.final_score, a.submitted_at, a.graded_at,
                    u.id AS student_id, u.name AS student_name, u.roll_no, u.username
               FROM online_exam_attempts a
               JOIN users u ON u.id = a.student_id
              WHERE a.exam_id = ?
              ORDER BY u.name`,
            [req.params.examId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.C.5 Submission detail (for grading or student review) -----
app.get('/api/admin/attempts/:attemptId', async (req, res) => {
    try {
        const [att] = await db.execute(
            `SELECT a.*, e.title AS exam_title, e.total_marks, e.class_id,
                    u.name AS student_name, u.roll_no, u.username,
                    g.name AS graded_by_name
               FROM online_exam_attempts a
               JOIN users u ON u.id = a.student_id
               JOIN online_exams e ON e.id = a.exam_id
               LEFT JOIN users g ON g.id = a.graded_by
              WHERE a.id = ?`,
            [req.params.attemptId]
        );
        if (att.length === 0) return res.status(404).json({ error: 'Attempt not found' });

        const [rows] = await db.execute(
            `SELECT q.id AS question_id, q.question_text, q.question_type, q.options,
                    q.correct_answer, q.marks, q.question_order,
                    ans.answer_text, ans.marks_awarded, ans.is_auto_graded
               FROM online_exam_questions q
               LEFT JOIN online_exam_answers ans
                 ON ans.question_id = q.id AND ans.attempt_id = ?
              WHERE q.exam_id = ?
              ORDER BY q.question_order, q.id`,
            [req.params.attemptId, att[0].exam_id]
        );
        const items = rows.map(r => ({ ...r, options: parseJsonSafe(r.options, null) }));
        res.json({ attempt: att[0], items });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.C.6 Save grade for one attempt ---------------------------
//   Body: { graded_answers: [{question_id, marks_awarded}], teacher_feedback, graded_by }
app.post('/api/admin/attempts/:attemptId/grade', async (req, res) => {
    const { attemptId } = req.params;
    const { graded_answers = [], teacher_feedback, graded_by } = req.body;
    if (!graded_by) return res.status(400).json({ error: 'graded_by required.' });
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let total = 0;
        for (const g of graded_answers) {
            const marks = parseFloat(g.marks_awarded);
            const safe = isNaN(marks) ? 0 : marks;
            total += safe;
            await conn.execute(
                `INSERT INTO online_exam_answers (attempt_id, question_id, marks_awarded)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks_awarded = VALUES(marks_awarded)`,
                [attemptId, g.question_id, safe]
            );
        }
        await conn.execute(
            `UPDATE online_exam_attempts
                SET status = 'graded', final_score = ?, graded_at = ?, graded_by = ?, teacher_feedback = ?
              WHERE id = ?`,
            [total, nowSQL(), graded_by, teacher_feedback || null, attemptId]
        );
        await conn.commit();
        res.json({ success: true, final_score: total });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});



// =====================================================================
// === 17. REPORTS — Offline Exams, Marks Entry & Report Cards =========
//
//   Distinct from Section 16 (online quizzes). This covers the
//   traditional paper-exam workflow:
//     • exam_types          — admin defines AT1, UT1, SA1...
//     • exam_max_marks      — per exam-type + class max marks
//     • subject_teacher_map — who enters marks for a class+subject
//     • student_marks       — the actual entered marks
//   Report-card attendance is auto-computed from the daily `attendance`
//   table built in Section 15 — no separate W/P entry.
// =====================================================================

// --- Month boundaries helper for attendance roll-up ----------------
//   Given an academic year row {startDate,endDate}, returns an ordered
//   list of { key:'2025-06', label:'June', from, to } month buckets.
function buildMonthBuckets(startDateStr, endDateStr) {
    const buckets = [];
    if (!startDateStr || !endDateStr) return buckets;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start) || isNaN(end)) return buckets;
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const first = new Date(y, m, 1);
        const last  = new Date(y, m + 1, 0);
        buckets.push({
            key:   `${y}-${String(m + 1).padStart(2, '0')}`,
            label: monthNames[m],
            from:  `${y}-${String(m + 1).padStart(2, '0')}-01`,
            to:    `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
        });
        cur.setMonth(cur.getMonth() + 1);
    }
    return buckets;
}


// =====================================================================
// === 17.A EXAM TYPES =================================================
// =====================================================================

// --- 17.A.1 List exam types for a school --------------------------
app.get('/api/admin/exam-types/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [req.params.instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.A.2 Create exam type --------------------------------------
app.post('/api/admin/exam-types', async (req, res) => {
    const { institutionId, name, exam_order } = req.body;
    if (!institutionId || !name) return res.status(400).json({ error: 'institutionId and name required.' });
    try {
        const [result] = await db.execute(
            'INSERT INTO exam_types (institutionId, name, exam_order) VALUES (?, ?, ?)',
            [institutionId, name.trim(), parseInt(exam_order, 10) || 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'An exam type with that name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- 17.A.3 Update exam type --------------------------------------
app.put('/api/admin/exam-types/:id', async (req, res) => {
    const { name, exam_order } = req.body;
    try {
        await db.execute(
            'UPDATE exam_types SET name = ?, exam_order = ? WHERE id = ?',
            [name.trim(), parseInt(exam_order, 10) || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'An exam type with that name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- 17.A.4 Delete exam type --------------------------------------
app.delete('/api/admin/exam-types/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM exam_types WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 17.B MAX MARKS (per exam-type + class) ==========================
// =====================================================================

// --- 17.B.1 Get the full max-marks matrix for a school ------------
//   Returns one row per (exam_type, class) that HAS a configured max.
app.get('/api/admin/exam-max-marks/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT m.id, m.exam_type_id, m.class_id, m.max_marks,
                    t.name AS exam_type_name, c.className, c.section
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
               JOIN classes c    ON c.id = m.class_id
              WHERE t.institutionId = ?`,
            [req.params.instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.B.2 Bulk upsert max marks ---------------------------------
//   Body: { entries: [{ exam_type_id, class_id, max_marks }] }
//   max_marks = null/'' removes the row (class won't show that exam).
app.post('/api/admin/exam-max-marks', async (req, res) => {
    const { entries = [] } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.exam_type_id || !e.class_id) continue;
            const max = (e.max_marks === '' || e.max_marks === null || e.max_marks === undefined)
                ? null : parseInt(e.max_marks, 10);
            if (max === null) {
                await conn.execute(
                    'DELETE FROM exam_max_marks WHERE exam_type_id = ? AND class_id = ?',
                    [e.exam_type_id, e.class_id]
                );
            } else {
                await conn.execute(
                    `INSERT INTO exam_max_marks (exam_type_id, class_id, max_marks)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE max_marks = VALUES(max_marks)`,
                    [e.exam_type_id, e.class_id, max]
                );
            }
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// =====================================================================
// === 17.C SUBJECT-TEACHER MAP ========================================
// =====================================================================

// --- 17.C.1 Get all assignments for a class -----------------------
app.get('/api/admin/subject-teachers/:classId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT stm.id, stm.class_id, stm.subject_id, stm.teacher_id,
                    sub.name AS subject_name, u.name AS teacher_name
               FROM subject_teacher_map stm
               JOIN subjects sub ON sub.id = stm.subject_id
               JOIN users u      ON u.id = stm.teacher_id
              WHERE stm.class_id = ?`,
            [req.params.classId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.C.2 Assign (or reassign) a teacher to class+subject -------
app.post('/api/admin/subject-teachers', async (req, res) => {
    const { institutionId, class_id, subject_id, teacher_id } = req.body;
    if (!institutionId || !class_id || !subject_id || !teacher_id) {
        return res.status(400).json({ error: 'institutionId, class_id, subject_id, teacher_id required.' });
    }
    try {
        await db.execute(
            `INSERT INTO subject_teacher_map (institutionId, class_id, subject_id, teacher_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
            [institutionId, class_id, subject_id, teacher_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.C.3 Remove an assignment ----------------------------------
app.delete('/api/admin/subject-teachers/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM subject_teacher_map WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 17.D MARKS ENTRY ================================================
// =====================================================================

// --- 17.D.1 Class data bundle for the marks grid ------------------
//   GET /api/admin/reports/class-data/:classId
//   Returns everything the grid needs: students, subjects (with the
//   assigned teacher), exam types (with this class's max marks), and
//   every existing mark.
app.get('/api/admin/reports/class-data/:classId', async (req, res) => {
    const { classId } = req.params;
    try {
        const [cls] = await db.execute('SELECT * FROM classes WHERE id = ?', [classId]);
        if (cls.length === 0) return res.status(404).json({ error: 'Class not found' });
        const instId = cls[0].institutionId;
 
        // Students in this class
        const [students] = await db.execute(
            `SELECT id, name, roll_no, section
               FROM users
              WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
              ORDER BY roll_no, name`,
            [classId]
        );
 
        // All subjects in the school
        const [allSubjects] = await db.execute(
            'SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name',
            [instId]
        );
 
        // Subject → class links
        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
        const linkMap = {};   // subjectId → Set(classIds)
        scRows.forEach(r => {
            if (!linkMap[r.subject_id]) linkMap[r.subject_id] = new Set();
            linkMap[r.subject_id].add(r.class_id);
        });
 
        // Keep only subjects linked to THIS class.
        // A subject with no links at all → shown everywhere (legacy safety).
        const subjects = allSubjects.filter(s => {
            const links = linkMap[s.id];
            if (!links || links.size === 0) return true;
            return links.has(parseInt(classId, 10));
        });
 
        // Teacher assignment for this class
        const [assignments] = await db.execute(
            `SELECT stm.subject_id, stm.teacher_id, u.name AS teacher_name
               FROM subject_teacher_map stm
               JOIN users u ON u.id = stm.teacher_id
              WHERE stm.class_id = ?`,
            [classId]
        );
        const assignMap = {};
        assignments.forEach(a => { assignMap[a.subject_id] = a; });
 
        // Exam types + this class's max marks
        const [examTypes] = await db.execute(
            'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );
        const [maxRows] = await db.execute(
            `SELECT m.exam_type_id, m.max_marks
               FROM exam_max_marks m
              WHERE m.class_id = ?`,
            [classId]
        );
        const maxMap = {};
        maxRows.forEach(r => { maxMap[r.exam_type_id] = r.max_marks; });
 
        const examTypesForClass = examTypes
            .filter(t => maxMap[t.id] !== undefined)
            .map(t => ({ ...t, max_marks: maxMap[t.id] }));
 
        const subjectsForClass = subjects.map(s => ({
            ...s,
            teacher_id:   assignMap[s.id]?.teacher_id || null,
            teacher_name: assignMap[s.id]?.teacher_name || null
        }));
 
        const [marks] = await db.execute(
            `SELECT student_id, subject_id, exam_type_id, marks_obtained
               FROM student_marks
              WHERE class_id = ?`,
            [classId]
        );
 
        res.json({
            class: cls[0],
            students,
            subjects: subjectsForClass,
            examTypes: examTypesForClass,
            marks
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.D.2 Bulk save marks ---------------------------------------
//   Body: { institutionId, class_id, actor_id, entries: [
//             { student_id, subject_id, exam_type_id, marks_obtained } ] }
app.post('/api/admin/reports/marks/bulk', async (req, res) => {
    const { institutionId, class_id, actor_id, entries = [] } = req.body;
    if (!institutionId || !class_id || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'institutionId, class_id and entries[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.student_id || !e.subject_id || !e.exam_type_id) continue;
            const val = (e.marks_obtained === '' || e.marks_obtained === null || e.marks_obtained === undefined)
                ? null : parseFloat(e.marks_obtained);
            await conn.execute(
                `INSERT INTO student_marks
                   (institutionId, student_id, class_id, subject_id, exam_type_id, marks_obtained, entered_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained),
                                         entered_by = VALUES(entered_by)`,
                [institutionId, e.student_id, class_id, e.subject_id, e.exam_type_id,
                 val, actor_id || null]
            );
        }
        await conn.commit();
        res.json({ success: true, count: entries.length });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// =====================================================================
// === 17.E CLASS LIST + SUMMARIES =====================================
// =====================================================================

// --- 17.E.1 Class summaries (overview table) ----------------------
//   For each class: total marks entered, top student, top subject.
app.get('/api/admin/reports/class-summaries/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [classes] = await db.execute(
            'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section',
            [instId]
        );

        const summaries = [];
        for (const c of classes) {
            // Total marks across the class
            const [totalRow] = await db.execute(
                'SELECT COALESCE(SUM(marks_obtained), 0) AS total FROM student_marks WHERE class_id = ?',
                [c.id]
            );

            // Top student by summed marks
            const [topStudent] = await db.execute(
                `SELECT u.name, COALESCE(SUM(sm.marks_obtained), 0) AS marks
                   FROM users u
                   LEFT JOIN student_marks sm ON sm.student_id = u.id
                  WHERE u.class_id = ? AND LOWER(TRIM(u.role)) = 'student'
                  GROUP BY u.id, u.name
                  ORDER BY marks DESC
                  LIMIT 1`,
                [c.id]
            );

            // Top subject by summed marks
            const [topSubject] = await db.execute(
                `SELECT sub.name, COALESCE(SUM(sm.marks_obtained), 0) AS marks
                   FROM student_marks sm
                   JOIN subjects sub ON sub.id = sm.subject_id
                  WHERE sm.class_id = ?
                  GROUP BY sub.id, sub.name
                  ORDER BY marks DESC
                  LIMIT 1`,
                [c.id]
            );

            summaries.push({
                class_id: c.id,
                class_group: `${c.className}${c.section ? ' - ' + c.section : ''}`,
                className: c.className,
                section: c.section,
                totalClassMarks: Number(totalRow[0].total) || 0,
                topStudent: topStudent[0]
                    ? { name: topStudent[0].name, marks: Number(topStudent[0].marks) || 0 }
                    : { name: '—', marks: 0 },
                topSubject: topSubject[0]
                    ? { name: topSubject[0].name, marks: Number(topSubject[0].marks) || 0 }
                    : { name: '—', marks: 0 }
            });
        }
        res.json(summaries);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 17.F REPORT CARDS ===============================================
// =====================================================================

// --- Shared builder: assembles one student's full report card ------
async function buildReportCard(studentId) {
    const [sRows] = await db.execute(
        `SELECT u.id, u.name, u.roll_no, u.admission_no, u.class_id, u.section,
                u.institutionId, c.className
           FROM users u
           LEFT JOIN classes c ON c.id = u.class_id
          WHERE u.id = ?`,
        [studentId]
    );
    if (sRows.length === 0) return null;
    const student = sRows[0];

    // School header info
    const [instRows] = await db.execute(
        'SELECT id, name, logo, school_email, phone, type FROM institutions WHERE id = ?',
        [student.institutionId]
    );
    const institution = instRows[0] || null;

    // Active academic year (for month buckets + year label)
    const [yearRows] = await db.execute(
        `SELECT * FROM academic_years
          WHERE institutionId = ? AND isActive = 1 LIMIT 1`,
        [student.institutionId]
    );
    const academicYear = yearRows[0] || null;

     // Subjects — filtered to this student's class
        const [allSubjectsRC] = await db.execute(
            'SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name',
            [student.institutionId]
        );
        const [scRowsRC] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`,
            [student.institutionId]
        );
        const linkMapRC = {};
        scRowsRC.forEach(r => {
            if (!linkMapRC[r.subject_id]) linkMapRC[r.subject_id] = new Set();
            linkMapRC[r.subject_id].add(r.class_id);
        });
        const subjects = allSubjectsRC.filter(s => {
            const links = linkMapRC[s.id];
            if (!links || links.size === 0) return true;
            return links.has(student.class_id);
        });
        
    const [examTypes] = await db.execute(
        'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
        [student.institutionId]
    );
    const [maxRows] = await db.execute(
        'SELECT exam_type_id, max_marks FROM exam_max_marks WHERE class_id = ?',
        [student.class_id]
    );
    const maxMap = {};
    maxRows.forEach(r => { maxMap[r.exam_type_id] = r.max_marks; });
    const examTypesForClass = examTypes
        .filter(t => maxMap[t.id] !== undefined)
        .map(t => ({ ...t, max_marks: maxMap[t.id] }));

    // This student's marks
    const [marks] = await db.execute(
        `SELECT subject_id, exam_type_id, marks_obtained
           FROM student_marks
          WHERE student_id = ?`,
        [studentId]
    );

    // ---- Attendance: auto-compute monthly W/P from daily rows -----
    let attendance = [];
    if (academicYear) {
        const buckets = buildMonthBuckets(academicYear.startDate, academicYear.endDate);
        for (const b of buckets) {
            try {
                const [aRows] = await db.execute(
                    `SELECT status, COUNT(*) AS cnt
                       FROM attendance
                      WHERE user_id = ? AND attendance_date BETWEEN ? AND ?
                      GROUP BY status`,
                    [studentId, b.from, b.to]
                );
                let present = 0, working = 0;
                aRows.forEach(r => {
                    working += r.cnt;
                    if (r.status === 'P' || r.status === 'L') present += r.cnt;
                });
                attendance.push({ month: b.label, working_days: working, present_days: present });
            } catch {
                attendance.push({ month: b.label, working_days: 0, present_days: 0 });
            }
        }
    }

    return {
        student,
        institution,
        academicYear: academicYear ? academicYear.name : '',
        subjects,
        examTypes: examTypesForClass,
        marks,
        attendance
    };
}

// --- 17.F.1 One student's report card (admin/teacher) -------------
app.get('/api/admin/reports/student/:studentId', async (req, res) => {
    try {
        const card = await buildReportCard(req.params.studentId);
        if (!card) return res.status(404).json({ error: 'Student not found' });
        res.json(card);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.F.2 Logged-in student's own report card -------------------
app.get('/api/reports/my-report-card/:studentId', async (req, res) => {
    try {
        const card = await buildReportCard(req.params.studentId);
        if (!card) return res.status(404).json({ error: 'Student not found' });
        res.json(card);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 17.F.3 All report cards for a class (bulk print) -------------
app.get('/api/admin/reports/class-cards/:classId', async (req, res) => {
    try {
        const [students] = await db.execute(
            `SELECT id FROM users
              WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
              ORDER BY roll_no, name`,
            [req.params.classId]
        );
        const cards = [];
        for (const s of students) {
            const card = await buildReportCard(s.id);
            if (card) cards.push(card);
        }
        res.json(cards);
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 18: PERFORMANCE ANALYTICS
//
//  Append this whole block to backend/index.js, just BEFORE the final
//  `const PORT = ...` line.
//
//  Reads entirely from the Reports module tables (student_marks,
//  exam_types, exam_max_marks, subject_classes, subject_teacher_map).
//  No new tables needed.
//
//  ALSO — add 'Performance' to DEFAULT_MODULES at the top of index.js:
//
//      const DEFAULT_MODULES = [
//          'Overview', 'Manage Logins', 'Timetable', 'Academic Calendar',
//          'Attendance', 'Exams', 'Reports', 'Performance'
//      ];
// =====================================================================

// --- Shared helper: build a class's performance dataset --------------
//   Given a classId, returns:
//     { class, students[], subjects[], examTypes[], marks[] }
//   where examTypes carry max_marks for this class, and marks is the
//   raw student_marks rows. The frontend does the % math so it can
//   slice by exam / subject without re-querying.
async function loadClassPerformance(classId) {
    const [cls] = await db.execute('SELECT * FROM classes WHERE id = ?', [classId]);
    if (cls.length === 0) return null;
    const instId = cls[0].institutionId;

    // Students
    const [students] = await db.execute(
        `SELECT id, name, roll_no, section
           FROM users
          WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
          ORDER BY roll_no, name`,
        [classId]
    );

    // Subjects linked to this class (subject with no link = all classes)
    const [allSubjects] = await db.execute(
        'SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name',
        [instId]
    );
    const [scRows] = await db.execute(
        `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
           JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`,
        [instId]
    );
    const linkMap = {};
    scRows.forEach(r => {
        if (!linkMap[r.subject_id]) linkMap[r.subject_id] = new Set();
        linkMap[r.subject_id].add(r.class_id);
    });
    const subjects = allSubjects.filter(s => {
        const links = linkMap[s.id];
        if (!links || links.size === 0) return true;
        return links.has(parseInt(classId, 10));
    });

    // Exam types + this class's max marks
    const [examTypes] = await db.execute(
        'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
        [instId]
    );
    const [maxRows] = await db.execute(
        'SELECT exam_type_id, max_marks FROM exam_max_marks WHERE class_id = ?',
        [classId]
    );
    const maxMap = {};
    maxRows.forEach(r => { maxMap[r.exam_type_id] = r.max_marks; });
    const examTypesForClass = examTypes
        .filter(t => maxMap[t.id] !== undefined)
        .map(t => ({ ...t, max_marks: maxMap[t.id] }));

    // Teacher assignment (so UI can show "Teacher: X")
    const [assignments] = await db.execute(
        `SELECT stm.subject_id, stm.teacher_id, u.name AS teacher_name
           FROM subject_teacher_map stm
           JOIN users u ON u.id = stm.teacher_id
          WHERE stm.class_id = ?`,
        [classId]
    );

    // All marks for the class
    const [marks] = await db.execute(
        `SELECT student_id, subject_id, exam_type_id, marks_obtained
           FROM student_marks
          WHERE class_id = ?`,
        [classId]
    );

    return {
        class: cls[0],
        students,
        subjects,
        examTypes: examTypesForClass,
        assignments,
        marks
    };
}


// --- 18.1 Class list for a school (performance dropdowns) ------------
//   GET /api/admin/performance/classes/:instId
app.get('/api/admin/performance/classes/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section',
            [req.params.instId]
        );
        res.json(rows.map(c => ({
            id: c.id,
            className: c.className,
            section: c.section,
            class_group: `${c.className}${c.section ? ' - ' + c.section : ''}`
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.2 Full performance dataset for one class --------------------
//   GET /api/admin/performance/class/:classId
//   Frontend computes %, ranks, filters from this bundle.
app.get('/api/admin/performance/class/:classId', async (req, res) => {
    try {
        const data = await loadClassPerformance(req.params.classId);
        if (!data) return res.status(404).json({ error: 'Class not found' });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.3 One student's own performance bundle ----------------------
//   GET /api/admin/performance/student/:studentId
//   Returns the student's class dataset + which student is "me".
//   Used by the student-facing My Performance view.
app.get('/api/admin/performance/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute(
            'SELECT id, name, class_id FROM users WHERE id = ?',
            [req.params.studentId]
        );
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!u[0].class_id) {
            return res.json({ me: u[0], class: null, students: [], subjects: [], examTypes: [], marks: [] });
        }
        const data = await loadClassPerformance(u[0].class_id);
        if (!data) return res.status(404).json({ error: 'Class not found' });
        res.json({ me: u[0], ...data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.4 Teacher performance across the whole school ---------------
//   GET /api/admin/performance/teachers/:instId
//   For every teacher, for every (class, subject) they're assigned via
//   subject_teacher_map, compute their students' total obtained vs total
//   possible. A teacher's overall % = sum(obtained) / sum(possible).
app.get('/api/admin/performance/teachers/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        // All teacher↔class↔subject assignments in the school
        const [assignments] = await db.execute(
            `SELECT stm.class_id, stm.subject_id, stm.teacher_id,
                    u.name AS teacher_name,
                    sub.name AS subject_name,
                    c.className, c.section
               FROM subject_teacher_map stm
               JOIN users u    ON u.id = stm.teacher_id
               JOIN subjects sub ON sub.id = stm.subject_id
               JOIN classes c  ON c.id = stm.class_id
              WHERE stm.institutionId = ?`,
            [instId]
        );

        // Exam max marks: classId → (examTypeId → max)
        const [maxRows] = await db.execute(
            `SELECT m.class_id, m.exam_type_id, m.max_marks
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        const maxByClass = {};
        maxRows.forEach(r => {
            if (!maxByClass[r.class_id]) maxByClass[r.class_id] = {};
            maxByClass[r.class_id][r.exam_type_id] = r.max_marks;
        });

        // Count of active students per class
        const [studentCounts] = await db.execute(
            `SELECT class_id, COUNT(*) AS cnt
               FROM users
              WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
              GROUP BY class_id`,
            [instId]
        );
        const studentCountMap = {};
        studentCounts.forEach(r => { studentCountMap[r.class_id] = r.cnt; });

        // All marks in the school, indexed for fast lookup
        const [allMarks] = await db.execute(
            `SELECT sm.class_id, sm.subject_id, sm.exam_type_id,
                    sm.student_id, sm.marks_obtained
               FROM student_marks sm
              WHERE sm.institutionId = ?`,
            [instId]
        );

        // teacherId → { name, overallObtained, overallPossible, detail[] }
        const teachers = {};

        for (const a of assignments) {
            if (!teachers[a.teacher_id]) {
                teachers[a.teacher_id] = {
                    teacher_id: a.teacher_id,
                    teacher_name: a.teacher_name,
                    overall_obtained: 0,
                    overall_possible: 0,
                    detail: []
                };
            }
            const t = teachers[a.teacher_id];

            // Marks for this class+subject
            const relevant = allMarks.filter(m =>
                m.class_id === a.class_id && m.subject_id === a.subject_id);

            let obtained = 0, possible = 0;
            relevant.forEach(m => {
                const val = parseFloat(m.marks_obtained);
                if (isNaN(val)) return;
                const max = maxByClass[a.class_id]?.[m.exam_type_id];
                if (max === undefined || max === null) return;
                obtained += val;
                possible += parseFloat(max);
            });

            const pct = possible > 0 ? (obtained / possible) * 100 : null;

            t.detail.push({
                class_id: a.class_id,
                class_group: `${a.className}${a.section ? ' - ' + a.section : ''}`,
                subject_id: a.subject_id,
                subject_name: a.subject_name,
                student_count: studentCountMap[a.class_id] || 0,
                total_obtained: obtained,
                total_possible: possible,
                percentage: pct
            });
            t.overall_obtained += obtained;
            t.overall_possible += possible;
        }

        const result = Object.values(teachers).map(t => ({
            ...t,
            overall_percentage: t.overall_possible > 0
                ? (t.overall_obtained / t.overall_possible) * 100
                : null
        }));

        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.5 One teacher's own performance -----------------------------
//   GET /api/admin/performance/teacher/:teacherId
//   Same shape as one element of 18.4, scoped to a single teacher.
app.get('/api/admin/performance/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [u] = await db.execute(
            'SELECT id, name, institutionId FROM users WHERE id = ?',
            [teacherId]
        );
        if (u.length === 0) return res.status(404).json({ error: 'Teacher not found' });
        const instId = u[0].institutionId;

        const [assignments] = await db.execute(
            `SELECT stm.class_id, stm.subject_id,
                    sub.name AS subject_name,
                    c.className, c.section
               FROM subject_teacher_map stm
               JOIN subjects sub ON sub.id = stm.subject_id
               JOIN classes c  ON c.id = stm.class_id
              WHERE stm.teacher_id = ?`,
            [teacherId]
        );

        const [maxRows] = await db.execute(
            `SELECT m.class_id, m.exam_type_id, m.max_marks
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        const maxByClass = {};
        maxRows.forEach(r => {
            if (!maxByClass[r.class_id]) maxByClass[r.class_id] = {};
            maxByClass[r.class_id][r.exam_type_id] = r.max_marks;
        });

        const detail = [];
        let overallObtained = 0, overallPossible = 0;

        for (const a of assignments) {
            const [marks] = await db.execute(
                `SELECT exam_type_id, marks_obtained
                   FROM student_marks
                  WHERE class_id = ? AND subject_id = ?`,
                [a.class_id, a.subject_id]
            );
            let obtained = 0, possible = 0;
            marks.forEach(m => {
                const val = parseFloat(m.marks_obtained);
                if (isNaN(val)) return;
                const max = maxByClass[a.class_id]?.[m.exam_type_id];
                if (max === undefined || max === null) return;
                obtained += val;
                possible += parseFloat(max);
            });
            detail.push({
                class_id: a.class_id,
                class_group: `${a.className}${a.section ? ' - ' + a.section : ''}`,
                subject_id: a.subject_id,
                subject_name: a.subject_name,
                total_obtained: obtained,
                total_possible: possible,
                percentage: possible > 0 ? (obtained / possible) * 100 : null
            });
            overallObtained += obtained;
            overallPossible += possible;
        }

        res.json({
            teacher_id: u[0].id,
            teacher_name: u[0].name,
            overall_obtained: overallObtained,
            overall_possible: overallPossible,
            overall_percentage: overallPossible > 0
                ? (overallObtained / overallPossible) * 100 : null,
            detail
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
// === 19. GALLERY =====================================================
// =====================================================================


// Keep the uploaded file in memory so we can write its bytes straight
// into the database — no disk files are created anymore.
const galleryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB per file
});


// --- 19.1 Get all albums (grouped by title) --------------------------
//  Returns a `cover_id` (the newest item's id) instead of a file path,
//  so the frontend can request the cover image from the media endpoint.
app.get('/api/admin/gallery/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT title,
                    event_date,
                    COUNT(*)  AS item_count,
                    MAX(id)   AS cover_id
               FROM gallery
              WHERE institutionId = ?
              GROUP BY title, event_date
              ORDER BY event_date DESC`,
            [req.params.instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.2 Get items in a specific album ------------------------------
//  Note: we DO NOT select file_data here (it would be huge). The list
//  only needs ids + types; the bytes are fetched per-item on demand.
app.get('/api/admin/gallery/album/:instId/:title', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, institutionId, title, file_type, mime_type,
                    event_date, created_by, created_at
               FROM gallery
              WHERE institutionId = ? AND title = ?
              ORDER BY created_at DESC`,
            [req.params.instId, req.params.title]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.3 Upload media -> store bytes in the DB ----------------------
app.post('/api/admin/gallery/upload', galleryUpload.single('media'), async (req, res) => {
    const { title, event_date, institutionId, adminId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mime = req.file.mimetype || 'application/octet-stream';
    const file_type = mime.startsWith('image') ? 'photo' : 'video';

    try {
        const [result] = await db.execute(
            `INSERT INTO gallery
               (institutionId, title, file_path, file_data, mime_type, file_type, event_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, null, req.file.buffer, mime, file_type, event_date, adminId || null]
        );
        res.json({ success: true, insertId: result.insertId });
    } catch (err) {
        // A "max_allowed_packet" / "got a packet bigger than" error here
        // means MySQL's max_allowed_packet is smaller than the file.
        res.status(500).json({ error: err.message });
    }
});


// --- 19.4 Stream a single media item (image OR video) ----------------
//  Supports HTTP Range requests, which browsers require to play and
//  seek video. The frontend points <img>/<video> src at this URL.
//    GET /api/admin/gallery/media/:id            -> inline view/play
//    GET /api/admin/gallery/media/:id?download=1 -> force download
app.get('/api/admin/gallery/media/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT file_data, mime_type, file_type FROM gallery WHERE id = ?',
            [req.params.id]
        );
        if (!rows.length || !rows[0].file_data) return res.status(404).send('Not found');

        const data = rows[0].file_data; // Buffer (mysql2 returns LONGBLOB as Buffer)
        const mime = rows[0].mime_type ||
            (rows[0].file_type === 'photo' ? 'image/jpeg' : 'video/mp4');
        const total = data.length;

        // Force-download mode
        if (req.query.download) {
            const ext = mime.split('/')[1] || 'bin';
            res.setHeader('Content-Disposition', `attachment; filename="media-${req.params.id}.${ext}"`);
        }

        const range = req.headers.range;
        if (range) {
            // e.g. "bytes=12345-" or "bytes=0-99999"
            const m = String(range).match(/bytes=(\d*)-(\d*)/);
            let start = m && m[1] ? parseInt(m[1], 10) : 0;
            let end   = m && m[2] ? parseInt(m[2], 10) : total - 1;
            if (isNaN(start)) start = 0;
            if (isNaN(end) || end >= total) end = total - 1;

            if (start > end || start >= total) {
                res.status(416).setHeader('Content-Range', `bytes */${total}`);
                return res.end();
            }

            const chunk = data.slice(start, end + 1);
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunk.length);
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            return res.end(chunk);
        }

        // No range header -> send the whole thing
        res.setHeader('Content-Length', total);
        res.setHeader('Content-Type', mime);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.end(data);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// --- 19.5 Delete single item -----------------------------------------
//  Deleting the row removes the stored bytes too — no orphan files.
app.delete('/api/admin/gallery/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM gallery WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.6 Delete a whole album (Super Admin only) --------------------
app.delete('/api/admin/gallery/album/:instId/:title', async (req, res) => {
    const { role } = req.body; // Pass role from frontend
    if (role !== 'Super Admin') {
        return res.status(403).json({ error: "You don't have permission to delete albums." });
    }
    try {
        await db.execute('DELETE FROM gallery WHERE institutionId = ? AND title = ?',
            [req.params.instId, req.params.title]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 19: HOMEWORK
//
//  Append this whole block to backend/index.js, just BEFORE the final
//  `const PORT = ...` line.
//
//  ALSO add 'Homework' to DEFAULT_MODULES at the top of index.js:
//    const DEFAULT_MODULES = [
//        'Overview','Manage Logins','Timetable','Academic Calendar',
//        'Attendance','Exams','Reports','Performance','Homework'
//    ];
//
//  Files are stored as base64 JSON in the rows — no filesystem needed.
//  Reuses parseJsonSafe() and nowSQL() defined in Section 16.
// =====================================================================


// --- 19.1 List homework for a teacher/admin -------------------------
//   GET /api/admin/homework/teacher/:userId
//   Super Admin / Developer  → ALL homework in the school
//   Teacher (or other role)  → only homework they created
app.get('/api/admin/homework/teacher/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [users] = await db.execute(
            'SELECT id, role, institutionId FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        const baseSelect = `
            SELECT h.id, h.title, h.description, h.homework_type,
                   h.class_id, h.subject_id, h.due_date, h.questions,
                   h.created_by, h.created_at,
                   c.className, c.section,
                   sub.name AS subject_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id) AS submission_count
              FROM homework h
              LEFT JOIN classes  c   ON c.id = h.class_id
              LEFT JOIN subjects sub ON sub.id = h.subject_id
              LEFT JOIN users    u   ON u.id = h.created_by`;

        let rows;
        if (isAdmin) {
            [rows] = await db.execute(
                `${baseSelect} WHERE h.institutionId = ? ORDER BY h.created_at DESC`,
                [me.institutionId]);
        } else {
            [rows] = await db.execute(
                `${baseSelect} WHERE h.created_by = ? ORDER BY h.created_at DESC`,
                [userId]);
        }
        const decorated = rows.map(r => ({
            ...r,
            questions: parseJsonSafe(r.questions, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.2 List homework for a student -------------------------------
//   GET /api/admin/homework/student/:studentId
//   Returns homework for the student's class, each with that student's
//   submission status merged in.
app.get('/api/admin/homework/student/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [u] = await db.execute(
            'SELECT institutionId, class_id FROM users WHERE id = ?', [studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!u[0].class_id) return res.json([]);

        const [rows] = await db.execute(
            `SELECT h.id, h.title, h.description, h.homework_type,
                    h.class_id, h.subject_id, h.due_date, h.questions, h.attachments,
                    c.className, c.section, sub.name AS subject_name,
                    s.id AS submission_id, s.written_answer, s.files AS submission_files,
                    s.submitted_at, s.grade, s.remarks
               FROM homework h
               LEFT JOIN classes  c   ON c.id = h.class_id
               LEFT JOIN subjects sub ON sub.id = h.subject_id
               LEFT JOIN homework_submissions s
                      ON s.homework_id = h.id AND s.student_id = ?
              WHERE h.class_id = ?
              ORDER BY h.due_date DESC`,
            [studentId, u[0].class_id]
        );
        const decorated = rows.map(r => ({
            ...r,
            questions:        parseJsonSafe(r.questions, []),
            attachments:      parseJsonSafe(r.attachments, []),
            submission_files: parseJsonSafe(r.submission_files, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`,
            status: r.submission_id ? (r.grade ? 'Graded' : 'Submitted') : 'Pending'
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.3 Single homework (with attachments) ------------------------
app.get('/api/admin/homework/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT h.*, c.className, c.section, sub.name AS subject_name
               FROM homework h
               LEFT JOIN classes  c   ON c.id = h.class_id
               LEFT JOIN subjects sub ON sub.id = h.subject_id
              WHERE h.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Homework not found' });
        const r = rows[0];
        res.json({
            ...r,
            questions:   parseJsonSafe(r.questions, []),
            attachments: parseJsonSafe(r.attachments, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.4 Create homework -------------------------------------------
//   Body: { institutionId, title, description, homework_type, class_id,
//           subject_id, due_date, questions[], attachments[], created_by }
app.post('/api/admin/homework', async (req, res) => {
    const {
        institutionId, title, description, homework_type,
        class_id, subject_id, due_date, questions, attachments, created_by
    } = req.body;
    if (!institutionId || !title || !class_id || !due_date) {
        return res.status(400).json({ error: 'institutionId, title, class_id and due_date are required.' });
    }
    try {
        const [result] = await db.execute(
            `INSERT INTO homework
               (institutionId, title, description, homework_type, class_id,
                subject_id, due_date, questions, attachments, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, description || null, homework_type || 'PDF',
             class_id, subject_id || null, due_date,
             JSON.stringify(questions || []), JSON.stringify(attachments || []),
             created_by || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.5 Update homework -------------------------------------------
app.put('/api/admin/homework/:id', async (req, res) => {
    const {
        title, description, homework_type,
        class_id, subject_id, due_date, questions, attachments
    } = req.body;
    try {
        await db.execute(
            `UPDATE homework
                SET title = ?, description = ?, homework_type = ?, class_id = ?,
                    subject_id = ?, due_date = ?, questions = ?, attachments = ?
              WHERE id = ?`,
            [title, description || null, homework_type || 'PDF', class_id,
             subject_id || null, due_date,
             JSON.stringify(questions || []), JSON.stringify(attachments || []),
             req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.6 Delete homework -------------------------------------------
app.delete('/api/admin/homework/:id', async (req, res) => {
    try {
        // submissions cascade-delete via FK
        await db.execute('DELETE FROM homework WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.7 Roster of submissions for one homework (teacher view) -----
//   GET /api/admin/homework/:id/submissions
//   Returns EVERY student in the class, with their submission (or null).
app.get('/api/admin/homework/:id/submissions', async (req, res) => {
    try {
        const [hw] = await db.execute(
            'SELECT class_id FROM homework WHERE id = ?', [req.params.id]);
        if (hw.length === 0) return res.status(404).json({ error: 'Homework not found' });

        const [rows] = await db.execute(
            `SELECT u.id AS student_id, u.name AS student_name, u.roll_no,
                    s.id AS submission_id, s.written_answer, s.files,
                    s.submitted_at, s.grade, s.remarks
               FROM users u
               LEFT JOIN homework_submissions s
                      ON s.student_id = u.id AND s.homework_id = ?
              WHERE u.class_id = ? AND LOWER(TRIM(u.role)) = 'student'
                AND (u.status IS NULL OR LOWER(TRIM(u.status)) = 'active')
              ORDER BY u.roll_no, u.name`,
            [req.params.id, hw[0].class_id]
        );
        const decorated = rows.map(r => ({
            ...r,
            files: parseJsonSafe(r.files, [])
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.8 Student submits (or resubmits) homework -------------------
//   Body: { student_id, written_answer, files[] }
app.post('/api/admin/homework/:id/submit', async (req, res) => {
    const { id } = req.params;
    const { student_id, written_answer, files } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id required.' });
    try {
        await db.execute(
            `INSERT INTO homework_submissions
               (homework_id, student_id, written_answer, files, submitted_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               written_answer = VALUES(written_answer),
               files          = VALUES(files),
               submitted_at   = VALUES(submitted_at),
               grade          = NULL,
               remarks        = NULL,
               graded_by      = NULL,
               graded_at      = NULL`,
            [id, student_id, written_answer || null,
             JSON.stringify(files || []), nowSQL()]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.9 Student deletes their own submission ----------------------
app.delete('/api/admin/homework/submission/:submissionId', async (req, res) => {
    try {
        await db.execute(
            'DELETE FROM homework_submissions WHERE id = ?',
            [req.params.submissionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.10 Teacher grades a submission ------------------------------
//   Body: { grade, remarks, graded_by }
app.put('/api/admin/homework/grade/:submissionId', async (req, res) => {
    const { grade, remarks, graded_by } = req.body;
    try {
        await db.execute(
            `UPDATE homework_submissions
                SET grade = ?, remarks = ?, graded_by = ?, graded_at = ?
              WHERE id = ?`,
            [grade || null, remarks || null, graded_by || null, nowSQL(),
             req.params.submissionId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 20: MEALS
//
//  Append this whole block to backend/index.js, just BEFORE the final
//  `const PORT = ...` line.
//
//  ALSO add 'Meals' to DEFAULT_MODULES at the top of index.js:
//    const DEFAULT_MODULES = [
//        'Overview','Manage Logins','Timetable','Academic Calendar',
//        'Attendance','Exams','Reports','Performance','Homework','Meals'
//    ];
//
//  Weekly repeating menu — day_index 0=Mon ... 6=Sun.
// =====================================================================


// --- 20.1 Full meals data for a school ------------------------------
//   GET /api/admin/meals/:instId
//   Returns the school's slots + every menu cell. The frontend builds
//   the weekly grid from this single bundle.
app.get('/api/admin/meals/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [slots] = await db.execute(
            'SELECT * FROM meal_slots WHERE institutionId = ? ORDER BY slot_order, id',
            [instId]
        );
        const [menu] = await db.execute(
            `SELECT m.id, m.slot_id, m.day_index, m.items
               FROM meal_menu m
              WHERE m.institutionId = ?`,
            [instId]
        );
        res.json({ slots, menu });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 20.2 Save the school's meal slots ------------------------------
//   POST /api/admin/meals/slots
//   Body: { institutionId, slots: [{ id?, name, start_time, end_time }] }
//   Replaces the whole slot set. Slots no longer present are deleted
//   (their menu cells cascade-delete). Existing slots keep their id so
//   their menu cells survive.
app.post('/api/admin/meals/slots', async (req, res) => {
    const { institutionId, slots } = req.body;
    if (!institutionId || !Array.isArray(slots)) {
        return res.status(400).json({ error: 'institutionId and slots[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Which existing slot ids should survive?
        const keepIds = slots.filter(s => s.id).map(s => parseInt(s.id, 10));
        const [existing] = await conn.execute(
            'SELECT id FROM meal_slots WHERE institutionId = ?', [institutionId]);

        // Delete slots that were removed in the UI
        for (const row of existing) {
            if (!keepIds.includes(row.id)) {
                await conn.execute('DELETE FROM meal_slots WHERE id = ?', [row.id]);
            }
        }

        // Upsert each slot in order
        for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const name = (s.name || '').trim();
            if (!name) continue;
            if (s.id) {
                await conn.execute(
                    `UPDATE meal_slots
                        SET name = ?, start_time = ?, end_time = ?, slot_order = ?
                      WHERE id = ? AND institutionId = ?`,
                    [name, s.start_time || null, s.end_time || null, i, s.id, institutionId]
                );
            } else {
                await conn.execute(
                    `INSERT INTO meal_slots (institutionId, name, start_time, end_time, slot_order)
                     VALUES (?, ?, ?, ?, ?)`,
                    [institutionId, name, s.start_time || null, s.end_time || null, i]
                );
            }
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 20.3 Save the weekly menu --------------------------------------
//   POST /api/admin/meals/menu
//   Body: { institutionId, entries: [{ slot_id, day_index, items }] }
//   Upserts each cell. An empty `items` clears that cell.
app.post('/api/admin/meals/menu', async (req, res) => {
    const { institutionId, entries } = req.body;
    if (!institutionId || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'institutionId and entries[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.slot_id || e.day_index === undefined || e.day_index === null) continue;
            const items = (e.items || '').trim();
            if (items === '') {
                // Empty cell — remove any existing row
                await conn.execute(
                    'DELETE FROM meal_menu WHERE slot_id = ? AND day_index = ?',
                    [e.slot_id, e.day_index]
                );
            } else {
                await conn.execute(
                    `INSERT INTO meal_menu (institutionId, slot_id, day_index, items)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE items = VALUES(items)`,
                    [institutionId, e.slot_id, e.day_index, items]
                );
            }
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});
// =====================================================================
// === 21. PARENT TEACHER MEETINGS (PTM) ===============================
// =====================================================================

// --- 21.1 List PTMs for a School (Admin/Teacher view) ---
// --- 21.1 List PTMs (The Corrected Version) ---
app.get('/api/admin/ptm/:instId', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const [users] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const userRole = users[0].role;
        // Super Admin/Dev are the only ones who see EVERYONE'S meetings
        const isSystemAdmin = (userRole === 'Super Admin' || userRole === 'Developer');

        let sql = '';
        let params = [];

        if (isSystemAdmin) {
            // Master Key: See everything in the school
            sql = `SELECT p.*, c.className, t.name AS teacher_name
                   FROM ptm_meetings p
                   LEFT JOIN classes c ON c.id = p.class_id
                   LEFT JOIN users t ON t.id = p.teacher_id
                   WHERE p.institutionId = ?
                   ORDER BY p.meeting_datetime DESC`;
            params = [req.params.instId];
        } else {
            // Restricted View: Even if they have 'Read' permission, 
            // we only show meetings where they are the assigned teacher.
            sql = `SELECT p.*, c.className, t.name AS teacher_name
                   FROM ptm_meetings p
                   LEFT JOIN classes c ON c.id = p.class_id
                   LEFT JOIN users t ON t.id = p.teacher_id
                   WHERE p.institutionId = ? AND p.teacher_id = ?
                   ORDER BY p.meeting_datetime DESC`;
            params = [req.params.instId, userId];
        }

        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- 21.2 List PTMs for a Student ---
app.get('/api/admin/ptm/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id, section FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        const { institutionId, class_id, section } = u[0];

        const [rows] = await db.execute(
            `SELECT p.*, c.className, t.name AS teacher_name
               FROM ptm_meetings p
               LEFT JOIN classes c ON c.id = p.class_id
               LEFT JOIN users t ON t.id = p.teacher_id
              WHERE p.institutionId = ?
                AND (p.class_id IS NULL OR p.class_id = ?)
                AND (p.section IS NULL OR p.section = ?)
              ORDER BY p.meeting_datetime DESC`,
            [institutionId, class_id || 0, section || '']
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.3 Create PTM ---
app.post('/api/admin/ptm', async (req, res) => {
    const {
        institutionId, meeting_datetime, teacher_id, class_id,
        section, subject_focus, notes, meeting_link, status, created_by
    } = req.body;
    
    if (!institutionId || !meeting_datetime || !teacher_id || !subject_focus) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO ptm_meetings 
               (institutionId, meeting_datetime, teacher_id, class_id, section, subject_focus, notes, meeting_link, status, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                institutionId, meeting_datetime, teacher_id, class_id || null, 
                section || null, subject_focus, notes || null, meeting_link || null, 
                status || 'Scheduled', created_by || null
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.4 Update PTM ---
app.put('/api/admin/ptm/:id', async (req, res) => {
    const {
        meeting_datetime, teacher_id, class_id, section,
        subject_focus, notes, meeting_link, status
    } = req.body;
    try {
        await db.execute(
            `UPDATE ptm_meetings 
                SET meeting_datetime = ?, teacher_id = ?, class_id = ?, section = ?, 
                    subject_focus = ?, notes = ?, meeting_link = ?, status = ?
              WHERE id = ?`,
            [
                meeting_datetime, teacher_id, class_id || null, section || null,
                subject_focus, notes || null, meeting_link || null, status || 'Scheduled',
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.5 Delete PTM ---
app.delete('/api/admin/ptm/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM ptm_meetings WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- Multer config for Online Classes ---
const videoUploadDir = 'public/uploads/online_classes';
if (!fs.existsSync(videoUploadDir)) { fs.mkdirSync(videoUploadDir, { recursive: true }); }
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, videoUploadDir),
    filename: (req, file, cb) => cb(null, 'vid_' + Date.now() + path.extname(file.originalname))
});
const videoUpload = multer({ storage: videoStorage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

// =====================================================================
// === 22. ONLINE CLASSES ==============================================
// =====================================================================

// --- 22.1 List Classes for Admin/Teacher ---
// --- 22.1 List Classes for Admin/Teacher ---
// --- 22.1 List Classes for Admin/Teacher ---
app.get('/api/admin/online-classes/:instId', async (req, res) => {
    const { instId } = req.params;
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try {
        // Get logged-in user info
        const [users] = await db.execute(
            `SELECT id, role, class_id, section, institutionId FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = users[0];
        const roleName = user.role;
        const isStudent = roleName && roleName.toLowerCase() === 'student';

        // 1. Only TRUE system admins get the Global View of all data
        const isSystemAdmin = (roleName === 'Super Admin' || roleName === 'Developer');

        let query = '';
        let params = [];

        // ===============================
        // GLOBAL VIEW (Strictly Super Admin / Developer)
        // ===============================
        if (isSystemAdmin) {
            query = `
                SELECT o.*, c.className, c.section, s.name AS subject_name, t.name AS teacher_name
                  FROM online_classes o
                  LEFT JOIN classes c ON c.id = o.class_id
                  LEFT JOIN subjects s ON s.id = o.subject_id
                  LEFT JOIN users t ON t.id = o.teacher_id
                 WHERE o.institutionId = ?
                 ORDER BY o.class_datetime DESC
            `;
            params = [instId];
        } 
        // ===============================
        // STUDENT VIEW
        // ===============================
        else if (isStudent) {
            query = `
                SELECT o.*, c.className, c.section, s.name AS subject_name, t.name AS teacher_name
                  FROM online_classes o
                  LEFT JOIN classes c ON c.id = o.class_id
                  LEFT JOIN subjects s ON s.id = o.subject_id
                  LEFT JOIN users t ON t.id = o.teacher_id
                 WHERE o.institutionId = ? AND o.class_id = ?
                   AND (c.section IS NULL OR c.section = ?)
                 ORDER BY o.class_datetime DESC
            `;
            params = [instId, user.class_id || 0, user.section || ''];
        } 
        // ===============================
        // RESTRICTED VIEW (Teachers, Guest Lecturers, Custom Roles)
        // ===============================
        else {
            // Even if they have matrix permissions, they ONLY see their own data
            query = `
                SELECT o.*, c.className, c.section, s.name AS subject_name, t.name AS teacher_name
                  FROM online_classes o
                  LEFT JOIN classes c ON c.id = o.class_id
                  LEFT JOIN subjects s ON s.id = o.subject_id
                  LEFT JOIN users t ON t.id = o.teacher_id
                 WHERE o.institutionId = ? AND o.created_by = ?
                 ORDER BY o.class_datetime DESC
            `;
            params = [instId, user.id];
        }

        const [rows] = await db.execute(query, params);
        res.json(rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- 22.2 List Classes for Student ---
app.get('/api/admin/online-classes/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        
        const [rows] = await db.execute(
            `SELECT o.*, c.className, c.section, s.name AS subject_name, t.name AS teacher_name
               FROM online_classes o
               LEFT JOIN classes c ON c.id = o.class_id
               LEFT JOIN subjects s ON s.id = o.subject_id
               LEFT JOIN users t ON t.id = o.teacher_id
              WHERE o.institutionId = ? AND (o.class_id IS NULL OR o.class_id = ?)
              ORDER BY o.class_datetime DESC`,
            [u[0].institutionId, u[0].class_id || 0]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.3 Create Class (Multipart Form Data) ---
app.post('/api/admin/online-classes', videoUpload.single('videoFile'), async (req, res) => {
    const { institutionId, title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, topic, description, created_by } = req.body;
    let video_path = req.file ? `/public/uploads/online_classes/${req.file.filename}` : null;

    try {
        const [result] = await db.execute(
            `INSERT INTO online_classes 
               (institutionId, title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, video_path, topic, description, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                institutionId, title, class_type, class_id || null, subject_id, teacher_id, 
                class_datetime, meet_link || null, video_path, topic || null, description || null, created_by
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.4 Update Class (Multipart Form Data) ---
// --- 22.4 Update Class (Multipart Form Data) ---
app.put('/api/admin/online-classes/:id', videoUpload.single('videoFile'), async (req, res) => {
    const { title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, topic, description, clear_video } = req.body;
    try {
        const [[existing]] = await db.execute('SELECT video_path FROM online_classes WHERE id = ?', [req.params.id]);
        let video_path = existing.video_path;

        // If a new file is uploaded, OR if switching to a link (clear_video flag), delete the old file
        if (req.file || clear_video === 'true') {
            if (video_path) {
                const oldPath = path.join(__dirname, '..', video_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            video_path = req.file ? `/public/uploads/online_classes/${req.file.filename}` : null;
        }

        await db.execute(
            `UPDATE online_classes 
                SET title=?, class_type=?, class_id=?, subject_id=?, teacher_id=?, class_datetime=?, meet_link=?, video_path=?, topic=?, description=?
              WHERE id=?`,
            [title, class_type, class_id || null, subject_id, teacher_id, class_datetime, meet_link || null, video_path, topic || null, description || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.5 Delete Class ---
app.delete('/api/admin/online-classes/:id', async (req, res) => {
    try {
        const [[existing]] = await db.execute('SELECT video_path FROM online_classes WHERE id = ?', [req.params.id]);
        if (existing && existing.video_path) {
            const oldPath = path.join(__dirname, '..', existing.video_path);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await db.execute('DELETE FROM online_classes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 21: DIGITAL LABS
//
//  Append this whole block to backend/index.js, just BEFORE the final
//  `const PORT = ...` line.
//
//  ALSO add 'Digital Labs' to DEFAULT_MODULES at the top of index.js:
//    const DEFAULT_MODULES = [
//        'Overview','Manage Logins','Timetable','Academic Calendar',
//        'Attendance','Exams','Reports','Performance','Homework',
//        'Meals','Digital Labs'
//    ];
//
//  A lab bundles many resources (video / link / live). One lab targets
//  one class. Reuses nowSQL() from Section 16.
// =====================================================================


// --- 21.1 List labs for a teacher/admin -----------------------------
//   GET /api/admin/labs/teacher/:userId
//   Super Admin / Developer → ALL labs in the school
//   Teacher (or other role) → only labs they created
app.get('/api/admin/labs/teacher/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [users] = await db.execute(
            'SELECT id, role, institutionId FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        const baseSelect = `
            SELECT l.id, l.title, l.description, l.class_id, l.subject_id,
                   l.created_by, l.created_at,
                   c.className, c.section,
                   sub.name AS subject_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM lab_resources r WHERE r.lab_id = l.id) AS resource_count
              FROM digital_labs l
              LEFT JOIN classes  c   ON c.id = l.class_id
              LEFT JOIN subjects sub ON sub.id = l.subject_id
              LEFT JOIN users    u   ON u.id = l.created_by`;

        let rows;
        if (isAdmin) {
            [rows] = await db.execute(
                `${baseSelect} WHERE l.institutionId = ? ORDER BY l.created_at DESC`,
                [me.institutionId]);
        } else {
            [rows] = await db.execute(
                `${baseSelect} WHERE l.created_by = ? ORDER BY l.created_at DESC`,
                [userId]);
        }
        const decorated = rows.map(r => ({
            ...r,
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 21.2 List labs for a student -----------------------------------
//   GET /api/admin/labs/student/:studentId
//   Returns labs targeted at the student's class, each with resources.
app.get('/api/admin/labs/student/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [u] = await db.execute(
            'SELECT institutionId, class_id FROM users WHERE id = ?', [studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!u[0].class_id) return res.json([]);

        const [labs] = await db.execute(
            `SELECT l.id, l.title, l.description, l.class_id, l.subject_id,
                    l.created_at, c.className, c.section,
                    sub.name AS subject_name, usr.name AS created_by_name
               FROM digital_labs l
               LEFT JOIN classes  c   ON c.id = l.class_id
               LEFT JOIN subjects sub ON sub.id = l.subject_id
               LEFT JOIN users    usr ON usr.id = l.created_by
              WHERE l.class_id = ?
              ORDER BY l.created_at DESC`,
            [u[0].class_id]
        );
        if (labs.length === 0) return res.json([]);

        // Fetch all resources for these labs in one query
        const labIds = labs.map(l => l.id);
        const placeholders = labIds.map(() => '?').join(',');
        const [resources] = await db.execute(
            `SELECT * FROM lab_resources
              WHERE lab_id IN (${placeholders})
              ORDER BY resource_order, id`,
            labIds
        );
        const resByLab = {};
        resources.forEach(r => {
            if (!resByLab[r.lab_id]) resByLab[r.lab_id] = [];
            resByLab[r.lab_id].push(r);
        });

        const decorated = labs.map(l => ({
            ...l,
            class_group: `${l.className || ''}${l.section ? ' - ' + l.section : ''}`,
            resources: resByLab[l.id] || []
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 21.3 Single lab with resources ---------------------------------
app.get('/api/admin/labs/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT l.*, c.className, c.section, sub.name AS subject_name,
                    u.name AS created_by_name
               FROM digital_labs l
               LEFT JOIN classes  c   ON c.id = l.class_id
               LEFT JOIN subjects sub ON sub.id = l.subject_id
               LEFT JOIN users    u   ON u.id = l.created_by
              WHERE l.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Lab not found' });

        const [resources] = await db.execute(
            'SELECT * FROM lab_resources WHERE lab_id = ? ORDER BY resource_order, id',
            [req.params.id]
        );
        const lab = rows[0];
        res.json({
            ...lab,
            class_group: `${lab.className || ''}${lab.section ? ' - ' + lab.section : ''}`,
            resources
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 21.4 Create lab (with resources) -------------------------------
//   Body: { institutionId, title, description, class_id, subject_id,
//           created_by, resources: [{ resource_type, title, url, scheduled_at }] }
app.post('/api/admin/labs', async (req, res) => {
    const {
        institutionId, title, description, class_id, subject_id,
        created_by, resources = []
    } = req.body;
    if (!institutionId || !title || !class_id) {
        return res.status(400).json({ error: 'institutionId, title and class_id are required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO digital_labs
               (institutionId, title, description, class_id, subject_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [institutionId, title, description || null, class_id,
             subject_id || null, created_by || null]
        );
        const labId = result.insertId;

        for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            if (!r.title || !r.url) continue;
            await conn.execute(
                `INSERT INTO lab_resources
                   (lab_id, resource_type, title, url, scheduled_at, resource_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [labId, r.resource_type || 'link', r.title, r.url,
                 r.scheduled_at || null, i]
            );
        }
        await conn.commit();
        res.json({ success: true, id: labId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 21.5 Update lab (replaces resources wholesale) -----------------
app.put('/api/admin/labs/:id', async (req, res) => {
    const {
        title, description, class_id, subject_id, resources = []
    } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            `UPDATE digital_labs
                SET title = ?, description = ?, class_id = ?, subject_id = ?
              WHERE id = ?`,
            [title, description || null, class_id, subject_id || null, req.params.id]
        );
        // Replace resources
        await conn.execute('DELETE FROM lab_resources WHERE lab_id = ?', [req.params.id]);
        for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            if (!r.title || !r.url) continue;
            await conn.execute(
                `INSERT INTO lab_resources
                   (lab_id, resource_type, title, url, scheduled_at, resource_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.params.id, r.resource_type || 'link', r.title, r.url,
                 r.scheduled_at || null, i]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 21.6 Delete lab ------------------------------------------------
app.delete('/api/admin/labs/:id', async (req, res) => {
    try {
        // lab_resources cascade-delete via FK
        await db.execute('DELETE FROM digital_labs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- Pre-Admissions Storage ---
const PRE_ADMISSIONS_DIR = path.join(__dirname, 'public/uploads/preadmissions');
if (!fs.existsSync(PRE_ADMISSIONS_DIR)) { 
    fs.mkdirSync(PRE_ADMISSIONS_DIR, { recursive: true }); 
}
const preAdmissionsStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRE_ADMISSIONS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `preadmission-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const preAdmissionsUpload = multer({ storage: preAdmissionsStorage });


// =====================================================================
// === 23. ADMISSIONS / DIRECTORY ======================================
// =====================================================================

// --- 23.1 GET all records (Secured) ---
// FIXED: Added :instId to route
app.get('/api/admin/preadmissions/:instId', async (req, res) => {
    const { instId } = req.params;
    const { search, year, userId } = req.query; 

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const [users] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const roleName = users[0].role;
        const isSystemAdmin = (roleName === 'Super Admin' || roleName === 'Developer');

        const [perms] = await db.execute(`
            SELECT p.can_read 
              FROM permissions p
              JOIN roles r ON r.id = p.role_id
             WHERE r.role_name = ? AND r.institutionId = ? AND p.module_name = 'PreAdmissions'
        `, [roleName, instId]);

        const hasAccess = isSystemAdmin || (perms.length > 0 && perms[0].can_read);

        if (!hasAccess) {
            return res.status(403).json({ message: "You do not have permission to view admissions." });
        }

        let whereClauses = ["institutionId = ?"];
        const queryParams = [instId];

        if (year && !isNaN(parseInt(year))) {
            whereClauses.push("YEAR(submission_date) = ?");
            queryParams.push(parseInt(year));
        }

        if (search) {
            whereClauses.push("(student_name LIKE ? OR admission_no LIKE ? OR previous_institute LIKE ?)");
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        const query = `SELECT * FROM pre_admissions WHERE ${whereClauses.join(' AND ')} ORDER BY submission_date DESC LIMIT 1000`;
        const [records] = await db.query(query, queryParams);
        
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch admission records." });
    }
});

// --- 23.2 POST new record ---
app.post('/api/admin/preadmissions', preAdmissionsUpload.single('photo'), async (req, res) => {
    const fields = req.body;
    const photo_url = req.file ? `/public/uploads/preadmissions/${req.file.filename}` : null; 

    if (!fields.institutionId || !fields.admission_no || !fields.student_name || !fields.joining_grade) {
        return res.status(400).json({ message: "Institution ID, Admission No, Name, and Grade are required." });
    }

    const query = `
        INSERT INTO pre_admissions (
            institutionId, admission_no, student_name, photo_url, dob, pen_no, phone_no, aadhar_no, 
            parent_name, parent_phone, previous_institute, previous_grade, joining_grade, 
            school_joined_date, school_joined_grade, school_outgoing_date, school_outgoing_grade, 
            tc_issued_date, tc_number, address, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const v = (val) => (val === '' || val === 'null' || val === undefined ? null : val);

    const params = [
        fields.institutionId, fields.admission_no, fields.student_name, photo_url, v(fields.dob), v(fields.pen_no), 
        v(fields.phone_no), v(fields.aadhar_no), v(fields.parent_name), v(fields.parent_phone), 
        v(fields.previous_institute), v(fields.previous_grade), fields.joining_grade,
        v(fields.school_joined_date), v(fields.school_joined_grade), v(fields.school_outgoing_date), 
        v(fields.school_outgoing_grade), v(fields.tc_issued_date), v(fields.tc_number),
        v(fields.address), fields.status || 'Pending'
    ];

    try {
        await db.query(query, params);
        res.status(201).json({ message: "Admission record created successfully." });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Admission No '${fields.admission_no}' already exists for this school.` });
        }
        res.status(500).json({ message: "Failed to create record." });
    }
});

// --- 23.3 PUT update record ---
// FIXED: Added :id to route
app.put('/api/admin/preadmissions/:id', preAdmissionsUpload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let setClauses = [];
    let params = [];

    const updatableFields = [
        'admission_no', 'student_name', 'dob', 'pen_no', 'phone_no', 'aadhar_no', 
        'parent_name', 'parent_phone', 'previous_institute', 'previous_grade', 
        'joining_grade', 'school_joined_date', 'school_joined_grade', 
        'school_outgoing_date', 'school_outgoing_grade', 'tc_issued_date', 'tc_number',
        'address', 'status'
    ];

    updatableFields.forEach(field => {
        if (fields[field] !== undefined) {
            setClauses.push(`${field} = ?`);
            params.push(fields[field] === '' || fields[field] === 'null' ? null : fields[field]);
        }
    });

    if (req.file) {
        setClauses.push('photo_url = ?');
        params.push(`/public/uploads/preadmissions/${req.file.filename}`);
    }

    if (setClauses.length === 0) return res.status(400).json({ message: "No fields to update." });

    const query = `UPDATE pre_admissions SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);

    try {
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found." });
        res.status(200).json({ message: "Updated successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to update record." });
    }
});

// --- 23.4 DELETE record ---
// FIXED: Added :id to route
app.delete('/api/admin/preadmissions/:id', async (req, res) => {
    try {
        const [[record]] = await db.query("SELECT photo_url FROM pre_admissions WHERE id = ?", [req.params.id]);
        const [result] = await db.query("DELETE FROM pre_admissions WHERE id = ?", [req.params.id]);
        
        if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found." });

        if (record && record.photo_url) {
            const oldPath = path.join(__dirname, '..', record.photo_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        res.status(200).json({ message: "Deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete record." });
    }
});
// --- Multer config for Study Materials ---
const studyMatDir = 'public/uploads/study_materials';
if (!fs.existsSync(studyMatDir)) { fs.mkdirSync(studyMatDir, { recursive: true }); }
const studyMatStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, studyMatDir),
    filename: (req, file, cb) => cb(null, 'mat_' + Date.now() + path.extname(file.originalname))
});
const studyMatUpload = multer({ storage: studyMatStorage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// =====================================================================
// === 24. STUDY MATERIALS =============================================
// =====================================================================

// --- 24.1 List Materials (Admin/Teacher) ---
app.get('/api/admin/study-materials/:instId', async (req, res) => {
    const { instId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        // 1. Get user role
        const [users] = await db.execute('SELECT role, institutionId FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const roleName = users[0].role;
        const isSystemAdmin = (roleName === 'Super Admin' || roleName === 'Developer');

        // 2. Check Permission Matrix
        const [perms] = await db.execute(`
            SELECT p.can_read 
              FROM permissions p
              JOIN roles r ON r.id = p.role_id
             WHERE r.role_name = ? AND r.institutionId = ? AND p.module_name = 'StudyMaterials'
        `, [roleName, instId]);

        const hasAccess = isSystemAdmin || (perms.length > 0 && perms[0].can_read);

        if (!hasAccess) {
            return res.status(403).json({ message: "You do not have permission to view study materials." });
        }

        // 3. Build Query
        let query = `
            SELECT m.*, c.className, c.section, s.name AS subject_name, u.name AS uploaded_by_name
              FROM study_materials m
              LEFT JOIN classes c ON c.id = m.class_id
              LEFT JOIN subjects s ON s.id = m.subject_id
              LEFT JOIN users u ON u.id = m.uploaded_by
             WHERE m.institutionId = ?
        `;
        let params = [instId];

        // 4. Data Isolation (Teachers only see their own uploads)
        if (!isSystemAdmin) {
            query += ` AND m.uploaded_by = ?`;
            params.push(userId);
        }
        query += ` ORDER BY m.created_at DESC`;

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});
// --- 24.2 List Materials (Student) ---
app.get('/api/admin/study-materials/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });

        const [rows] = await db.execute(
            `SELECT m.*, c.className, c.section, s.name AS subject_name, u.name AS uploaded_by_name
               FROM study_materials m
               LEFT JOIN classes c ON c.id = m.class_id
               LEFT JOIN subjects s ON s.id = m.subject_id
               LEFT JOIN users u ON u.id = m.uploaded_by
              WHERE m.institutionId = ? AND m.class_id = ?
              ORDER BY m.created_at DESC`,
            [u[0].institutionId, u[0].class_id || 0]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24.3 Create Material ---
app.post('/api/admin/study-materials', studyMatUpload.single('materialFile'), async (req, res) => {
    const { institutionId, title, description, class_id, subject_id, material_type, external_link, uploaded_by } = req.body;
    const file_path = req.file ? `/public/uploads/study_materials/${req.file.filename}` : null;

    try {
        const [result] = await db.execute(
            `INSERT INTO study_materials 
               (institutionId, title, description, class_id, subject_id, material_type, file_path, external_link, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                institutionId, title, description || null, class_id, subject_id || null, 
                material_type || 'Notes', file_path, external_link || null, uploaded_by
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24.4 Update Material ---
app.put('/api/admin/study-materials/:id', studyMatUpload.single('materialFile'), async (req, res) => {
    const { title, description, class_id, subject_id, material_type, external_link } = req.body;
    try {
        const [[existing]] = await db.execute('SELECT file_path FROM study_materials WHERE id = ?', [req.params.id]);
        let file_path = existing.file_path;

        if (req.file) {
            if (file_path) {
                const oldPath = path.join(__dirname, '..', file_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            file_path = `/public/uploads/study_materials/${req.file.filename}`;
        }

        await db.execute(
            `UPDATE study_materials 
                SET title=?, description=?, class_id=?, subject_id=?, material_type=?, file_path=?, external_link=?
              WHERE id=?`,
            [title, description || null, class_id, subject_id || null, material_type || 'Notes', file_path, external_link || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24.5 Delete Material ---
app.delete('/api/admin/study-materials/:id', async (req, res) => {
    try {
        const [[existing]] = await db.execute('SELECT file_path FROM study_materials WHERE id = ?', [req.params.id]);
        if (existing && existing.file_path) {
            const oldPath = path.join(__dirname, '..', existing.file_path);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await db.execute('DELETE FROM study_materials WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 22: SYLLABUS  (v5 — fast viewer, self-contained)
//
//  REPLACE your whole Section 22 block (v4) with this.
//  No separate file, no require('./syllabusDetect') needed.
//  Requires (run in backend, commit package.json):
//      npm install pdfjs-dist@3.11.174 pdf-lib --save
//
//  What changed vs v4:
//    • Chapters are sliced ONCE at upload and stored, so opening a
//      chapter is instant (no re-slicing the whole book each click).
//    • New endpoint  GET /chapter/:id/pdf  returns the chapter as a real
//      application/pdf file — the iframe loads it directly (no giant
//      base64 in the browser). This is what fixes the stuck spinner.
//
//  What changed vs v5 (this build):
//    • Keywords now support an `example` column in addition to
//      `definition`. The add-keyword endpoint (22.16) stores it.
//      Run this migration once:
//        ALTER TABLE syllabus_keywords ADD COLUMN example text AFTER definition;
//
//  Reuses nowSQL() from Section 16.
// =====================================================================

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');

// ---------------------------------------------------------------------
//  Detection helpers
// ---------------------------------------------------------------------
async function detectChapters(buffer) {
    const data = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({
        data, useSystemFonts: true, isEvalSupported: false,
    }).promise;

    const total = doc.numPages;
    let chapters = [];
    try { chapters = await _fromOutline(doc, total); } catch (_) { chapters = []; }
    if (!chapters.length) {
        try { chapters = await _fromTocText(doc, total); } catch (_) { chapters = []; }
    }
    if (!chapters.length) chapters = [{ title: 'Full Document', page_from: 1, page_to: total }];
    try { await doc.cleanup(); await doc.destroy(); } catch (_) {}
    return { total, chapters };
}

async function _fromOutline(doc, total) {
    const outline = await doc.getOutline();
    if (!outline || !outline.length) return [];
    const items = [];
    for (const node of outline) {
        const idx = await _destToPageIndex(doc, node.dest);
        items.push({ title: node.title || '', start: idx == null ? null : idx + 1 });
    }
    if (!items.some(i => i.start != null)) return [];
    return _assemble(items, total);
}

async function _destToPageIndex(doc, dest) {
    try {
        let d = dest;
        if (typeof d === 'string') d = await doc.getDestination(d);
        if (!Array.isArray(d) || !d.length) return null;
        const ref = d[0];
        if (ref == null) return null;
        return await doc.getPageIndex(ref);
    } catch (_) { return null; }
}

async function _fromTocText(doc, total) {
    const scan = Math.min(total, 20);
    const candidates = [];
    for (let p = 1; p <= scan; p++) {
        const page = await doc.getPage(p);
        const lines = await _pageToLines(page);
        for (const ln of lines) {
            const parsed = _parseTocLine(ln, total);
            if (parsed) candidates.push(parsed);
        }
    }
    if (candidates.length < 2) return [];
    candidates.sort((a, b) => a.start - b.start);
    const seen = new Set(); const items = [];
    for (const c of candidates) {
        if (seen.has(c.start)) continue;
        seen.add(c.start);
        items.push({ title: c.title, start: c.start });
    }
    return _assemble(items, total);
}

async function _pageToLines(page) {
    const tc = await page.getTextContent();
    const buckets = [];
    for (const it of tc.items) {
        const s = it.str || '';
        if (!s.trim()) continue;
        const y = it.transform[5];
        const x = it.transform[4];
        let b = buckets.find((bk) => Math.abs(bk.y - y) <= 3);
        if (!b) { b = { y, parts: [] }; buckets.push(b); }
        b.parts.push({ x, s });
    }
    buckets.sort((a, b) => b.y - a.y);
    return buckets.map((b) =>
        b.parts.sort((p, q) => p.x - q.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()
    );
}

function _parseTocLine(line, total) {
    if (!line || line.length < 4) return null;
    const m = line.match(/^(.*?[A-Za-z].*?)[\s.·•\-_]{1,}(\d{1,4})$/);
    if (!m) return null;
    const title = (m[1] || '').replace(/\s+/g, ' ').replace(/[\s.·•\-_]+$/, '').trim();
    const pageNum = parseInt(m[2], 10);
    if (!title || title.length < 3) return null;
    if (!/[A-Za-z]/.test(title)) return null;
    if (!(pageNum >= 1 && pageNum <= total)) return null;
    return { title, start: pageNum };
}

function _assemble(items, total) {
    if (!items.length) return [];
    const n = items.length;
    const starts = items.map(it => (Number.isFinite(it.start) ? it.start : null));
    let prev = 0;
    for (let i = 0; i < n; i++) {
        if (starts[i] == null || starts[i] < 1 || starts[i] > total || starts[i] <= prev) starts[i] = null;
        else prev = starts[i];
    }
    for (let i = 0; i < n; i++) {
        if (starts[i] != null) continue;
        let l = i - 1; while (l >= 0 && starts[l] == null) l--;
        let r = i + 1; while (r < n && starts[r] == null) r++;
        const lv = l >= 0 ? starts[l] : 1;
        const rv = r < n ? starts[r] : total + 1;
        const base = l >= 0 ? l : -1;
        const span = (r < n ? r : n) - base;
        let v = Math.round(lv + (rv - lv) * ((i - base) / span));
        if (v <= lv) v = lv + 1;
        if (v > total) v = total;
        starts[i] = v;
    }
    const cleaned = items.map((it, i) => ({ title: _cleanTitle(it.title), start: starts[i] }));
    const firstChapter = cleaned.findIndex(c => /^\d+\b/.test(c.title));
    const result = [];
    let startIdx = 0;
    if (firstChapter > 0) {
        result.push({ title: 'Index', page_from: 1, page_to: Math.max(1, cleaned[firstChapter].start - 1) });
        startIdx = firstChapter;
    } else if (cleaned[0].start > 1) {
        result.push({ title: 'Index', page_from: 1, page_to: cleaned[0].start - 1 });
    }
    let seq = 0;
    for (let i = startIdx; i < n; i++) {
        seq++;
        const from = cleaned[i].start;
        const to = (i + 1 < n) ? cleaned[i + 1].start - 1 : total;
        result.push({ title: _formatChapterTitle(cleaned[i].title, seq), page_from: from, page_to: Math.max(from, to) });
    }
    return result;
}

function _cleanTitle(t) {
    return (t || '').replace(/\.pdf\s*$/i, '').replace(/\s+/g, ' ').trim();
}
function _titleCase(s) {
    return (s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
function _formatChapterTitle(clean, seq) {
    const m = clean.match(/^(\d+)\s*[.)]?\s*(.*)$/);
    if (m && m[2]) return `${m[1]}. ${_titleCase(m[2])}`;
    if (m) return `${m[1]}. Chapter ${m[1]}`;
    return `${seq}. ${_titleCase(clean)}`;
}

// ---------------------------------------------------------------------
//  Slicing helpers
//  sliceAll loads the source ONCE and cuts many ranges — fast at upload.
// ---------------------------------------------------------------------
async function sliceAll(buffer, ranges) {
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    const slices = [];
    for (const [from, to] of ranges) {
        let start = Math.max(1, parseInt(from, 10) || 1);
        let end = Math.min(total, parseInt(to, 10) || total);
        if (end < start) end = start;
        const d = await PDFDocument.create();
        const idx = [];
        for (let i = start - 1; i <= end - 1; i++) idx.push(i);
        const pages = await d.copyPages(src, idx);
        pages.forEach((p) => d.addPage(p));
        const bytes = await d.save();
        slices.push(Buffer.from(bytes).toString('base64'));
    }
    return { total, slices };
}

async function slicePdf(buffer, from, to) {
    const { slices } = await sliceAll(buffer, [[from, to]]);
    return slices[0];
}

// Re-cut a single chapter's slice from its parent book (after edits)
async function resliceChapter(chapterId) {
    const [rows] = await db.execute(
        `SELECT c.page_from, c.page_to, s.doc_data, s.page_offset
           FROM syllabus_chapters c JOIN syllabus s ON s.id = c.syllabus_id
          WHERE c.id = ?`, [chapterId]);
    if (!rows.length) return;
    const r = rows[0];
    if (!r.doc_data || !r.page_from) {
        await db.execute('UPDATE syllabus_chapters SET doc_data = NULL, doc_pages = NULL WHERE id = ?', [chapterId]);
        return;
    }
    const base64 = String(r.doc_data).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const offset = r.page_offset || 0;
    const from = (r.page_from || 1) + offset;
    const to = (r.page_to || r.page_from || 1) + offset;
    const b64 = await slicePdf(buffer, from, to);
    await db.execute('UPDATE syllabus_chapters SET doc_data = ?, doc_pages = ? WHERE id = ?',
        ['data:application/pdf;base64,' + b64, Math.max(1, (r.page_to - r.page_from + 1)), chapterId]);
}


// ---------------------------------------------------------------------
//  ROUTES
// ---------------------------------------------------------------------

// --- 22.1 Syllabus Management list ----------------------------------
app.get('/api/admin/syllabus/list/:instId', async (req, res) => {
    const { instId } = req.params;
    const { classId } = req.query;
    try {
        let sql = `
            SELECT s.id, s.class_id, s.subject_id, s.teacher_id, s.updated_at,
                   c.className, c.section,
                   sub.name AS subject_name,
                   t.name AS teacher_name,
                   (SELECT COUNT(*) FROM syllabus_chapters ch WHERE ch.syllabus_id = s.id) AS lesson_count
              FROM syllabus s
              LEFT JOIN classes  c   ON c.id = s.class_id
              LEFT JOIN subjects sub ON sub.id = s.subject_id
              LEFT JOIN users    t   ON t.id = s.teacher_id
             WHERE s.institutionId = ?`;
        const params = [instId];
        if (classId) { sql += ' AND s.class_id = ?'; params.push(classId); }
        sql += ' ORDER BY sub.name';

        const [rows] = await db.execute(sql, params);
        const decorated = rows.map(r => ({
            ...r,
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        }));
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.2 Create a syllabus -----------------------------------------
app.post('/api/admin/syllabus', async (req, res) => {
    const {
        institutionId, academic_year_id, class_id, subject_id, teacher_id, created_by
    } = req.body;
    if (!institutionId || !class_id || !subject_id) {
        return res.status(400).json({ error: 'institutionId, class_id and subject_id are required.' });
    }
    try {
        const [result] = await db.execute(
            `INSERT INTO syllabus
               (institutionId, academic_year_id, class_id, subject_id, teacher_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [institutionId, academic_year_id || null, class_id, subject_id,
             teacher_id || null, created_by || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'A syllabus for this class and subject already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});


// --- 22.3 Update a syllabus -----------------------------------------
app.put('/api/admin/syllabus/:id', async (req, res) => {
    const { class_id, subject_id, teacher_id } = req.body;
    try {
        await db.execute(
            `UPDATE syllabus SET class_id = ?, subject_id = ?, teacher_id = ? WHERE id = ?`,
            [class_id, subject_id, teacher_id || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.4 Delete a syllabus -----------------------------------------
app.delete('/api/admin/syllabus/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM syllabus WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.5 Resolve a syllabus by class + subject ---------------------
app.get('/api/admin/syllabus/resolve/:instId/:classId/:subjectId', async (req, res) => {
    const { instId, classId, subjectId } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT s.id, s.teacher_id, t.name AS teacher_name
               FROM syllabus s LEFT JOIN users t ON t.id = s.teacher_id
              WHERE s.institutionId = ? AND s.class_id = ? AND s.subject_id = ?`,
            [instId, classId, subjectId]
        );
        res.json(rows.length > 0 ? rows[0] : { id: null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.6 Chapters of a syllabus ------------------------------------
app.get('/api/admin/syllabus/:syllabusId/chapters', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.id, c.syllabus_id, c.chapter_order, c.title,
                    c.page_from, c.page_to, c.doc_pages,
                    c.periods, c.start_date, c.end_date,
                    (c.doc_data IS NOT NULL) AS has_doc,
                    (SELECT COUNT(*) FROM syllabus_keywords k WHERE k.chapter_id = c.id) AS keyword_count
               FROM syllabus_chapters c
              WHERE c.syllabus_id = ?
              ORDER BY c.chapter_order, c.id`,
            [req.params.syllabusId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.7 Textbook meta (light — no doc_data) -----------------------
app.get('/api/admin/syllabus/:syllabusId/book', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT doc_name, doc_pages, page_offset, (doc_data IS NOT NULL) AS has_book
               FROM syllabus WHERE id = ?`,
            [req.params.syllabusId]
        );
        res.json(rows[0] || { has_book: 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.8 Upload textbook -> detect chapters -> pre-slice each ------
app.put('/api/admin/syllabus/:syllabusId/book', async (req, res) => {
    const { doc_name, doc_data, page_offset } = req.body;
    const syllabusId = req.params.syllabusId;
    if (!doc_data) return res.status(400).json({ error: 'doc_data is required.' });

    try {
        const base64 = String(doc_data).replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const offset = parseInt(page_offset, 10) || 0;

        const { total, chapters } = await detectChapters(buffer);

        await db.execute(
            `UPDATE syllabus
                SET doc_name = ?, doc_data = ?, doc_pages = ?, page_offset = ?, updated_at = ?
              WHERE id = ?`,
            [doc_name || null, doc_data, total, offset, nowSQL(), syllabusId]
        );

        await db.execute('DELETE FROM syllabus_chapters WHERE syllabus_id = ?', [syllabusId]);

        const ranges = chapters.map(c => [c.page_from + offset, c.page_to + offset]);
        const { slices } = await sliceAll(buffer, ranges);

        let order = 0;
        for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            const dataUri = 'data:application/pdf;base64,' + slices[i];
            const pages = ranges[i][1] - ranges[i][0] + 1;
            await db.execute(
                `INSERT INTO syllabus_chapters
                   (syllabus_id, chapter_order, title, page_from, page_to, doc_name, doc_data, doc_pages)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [syllabusId, order++, ch.title, ch.page_from, ch.page_to, doc_name || null, dataUri, pages]
            );
        }

        res.json({ success: true, total_pages: total, chapters: chapters.length });
    } catch (err) {
        console.error('Textbook detection failed:', err);
        res.status(500).json({ error: 'Could not read this PDF: ' + err.message });
    }
});


// --- 22.9 Change page offset -> re-slice all chapters ---------------
app.put('/api/admin/syllabus/:syllabusId/book/offset', async (req, res) => {
    try {
        const offset = parseInt(req.body.page_offset, 10) || 0;
        const sid = req.params.syllabusId;
        await db.execute('UPDATE syllabus SET page_offset = ? WHERE id = ?', [offset, sid]);

        const [bookRows] = await db.execute('SELECT doc_data FROM syllabus WHERE id = ?', [sid]);
        if (bookRows.length && bookRows[0].doc_data) {
            const base64 = String(bookRows[0].doc_data).replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64, 'base64');
            const [chs] = await db.execute(
                'SELECT id, page_from, page_to FROM syllabus_chapters WHERE syllabus_id = ? ORDER BY chapter_order, id',
                [sid]);
            const ranges = chs.map(c => [(c.page_from || 1) + offset, (c.page_to || c.page_from || 1) + offset]);
            const { slices } = await sliceAll(buffer, ranges);
            for (let i = 0; i < chs.length; i++) {
                await db.execute('UPDATE syllabus_chapters SET doc_data = ?, doc_pages = ? WHERE id = ?',
                    ['data:application/pdf;base64,' + slices[i], ranges[i][1] - ranges[i][0] + 1, chs[i].id]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.10 A chapter as a real PDF file (iframe loads this) ---------
app.get('/api/admin/syllabus/chapter/:id/pdf', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT doc_data FROM syllabus_chapters WHERE id = ?', [req.params.id]);
        if (!rows.length || !rows[0].doc_data) return res.status(404).send('No document');
        const base64 = String(rows[0].doc_data).replace(/^data:[^;]+;base64,/, '');
        const bytes = Buffer.from(base64, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="chapter.pdf"');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(bytes);
    } catch (err) { res.status(500).send(err.message); }
});


// --- 22.10b A chapter's stored slice as JSON (kept for compatibility)
app.get('/api/admin/syllabus/chapter/:id/doc', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT doc_name, doc_data, doc_pages FROM syllabus_chapters WHERE id = ?', [req.params.id]);
        if (!rows.length || !rows[0].doc_data) return res.json({});
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.11 Create a chapter (manual) -> slice it --------------------
app.post('/api/admin/syllabus/chapters', async (req, res) => {
    const { syllabus_id, title, page_from, page_to } = req.body;
    if (!syllabus_id || !title) {
        return res.status(400).json({ error: 'syllabus_id and title are required.' });
    }
    try {
        const [[{ maxOrder }]] = await db.execute(
            `SELECT COALESCE(MAX(chapter_order), -1) + 1 AS maxOrder
               FROM syllabus_chapters WHERE syllabus_id = ?`, [syllabus_id]);
        const [result] = await db.execute(
            `INSERT INTO syllabus_chapters (syllabus_id, chapter_order, title, page_from, page_to)
             VALUES (?, ?, ?, ?, ?)`,
            [syllabus_id, maxOrder, title, page_from || null, page_to || null]);
        await resliceChapter(result.insertId);
        await db.execute('UPDATE syllabus SET updated_at = ? WHERE id = ?', [nowSQL(), syllabus_id]);
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.12 Update a chapter -> re-slice it --------------------------
app.put('/api/admin/syllabus/chapters/:id', async (req, res) => {
    const { title, page_from, page_to } = req.body;
    try {
        await db.execute(
            `UPDATE syllabus_chapters SET title = ?, page_from = ?, page_to = ? WHERE id = ?`,
            [title, page_from || null, page_to || null, req.params.id]);
        await resliceChapter(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.13 Delete a chapter -----------------------------------------
app.delete('/api/admin/syllabus/chapters/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM syllabus_chapters WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.14 Update lesson-period schedule ----------------------------
app.put('/api/admin/syllabus/chapter/:id/periods', async (req, res) => {
    const { periods, start_date, end_date } = req.body;
    try {
        await db.execute(
            `UPDATE syllabus_chapters SET periods = ?, start_date = ?, end_date = ? WHERE id = ?`,
            [periods || 0, start_date || null, end_date || null, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.15 Keywords for a chapter -----------------------------------
//  SELECT * already returns the new `example` column.
app.get('/api/admin/syllabus/chapter/:id/keywords', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM syllabus_keywords WHERE chapter_id = ? ORDER BY term', [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.16 Add a keyword (term + definition + example) --------------
app.post('/api/admin/syllabus/chapter/:id/keywords', async (req, res) => {
    const { term, definition, example } = req.body;
    if (!term || !term.trim()) return res.status(400).json({ error: 'term is required.' });
    try {
        const [result] = await db.execute(
            'INSERT INTO syllabus_keywords (chapter_id, term, definition, example) VALUES (?, ?, ?, ?)',
            [req.params.id, term.trim(), definition || null, example || null]);
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.17 Delete a keyword -----------------------------------------
app.delete('/api/admin/syllabus/keywords/:keywordId', async (req, res) => {
    try {
        await db.execute('DELETE FROM syllabus_keywords WHERE id = ?', [req.params.keywordId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// ====================================================================
// === GROUP CHAT MODULE (UNIFIED PERMISSIONS & MULTI-TENANT) ========
// =====================================================================

// --- 1. Multer Configuration for Chat Media ---
const chatUploadDir = 'public/uploads/chat_media';
if (!fs.existsSync(chatUploadDir)) { fs.mkdirSync(chatUploadDir, { recursive: true }); }

function generateUniqueFilename(originalName, prefix = 'file') {
    const ext = path.extname(originalName);
    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, chatUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, generateUniqueFilename(file.originalname, 'chat-media'));
    }
});

const chatUpload = multer({
    storage: chatStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|mkv|mp3|m4a|wav|aac|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('File type not supported: ' + file.originalname));
    }
});


// --- 2. Unified Helper for Group Permissions ---
const checkGroupPermission = (action) => async (req, res, next) => {
    try {
        const userId = req.body.userId || req.query.userId;
        if (!userId) return res.status(400).json({ message: 'userId is required.' });

        const [users] = await db.execute(
            'SELECT role, institutionId FROM users WHERE id = ?', [userId]
        );
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = users[0];

        const isSystemAdmin = (user.role === 'Super Admin' || user.role === 'Developer');

        if (isSystemAdmin) {
            req.isAdminEquivalent = true;
            req.actorRole = user.role;
            req.actorInstId = user.institutionId;
            return next();
        }

        const [perms] = await db.execute(`
            SELECT p.can_${action}
              FROM permissions p
              JOIN roles r ON p.role_id = r.id
             WHERE r.role_name = ? AND r.institutionId = ? AND p.module_name = 'GroupChat'
        `, [user.role, user.institutionId]);

        if (perms.length > 0 && perms[0][`can_${action}`]) {
            req.isAdminEquivalent = true;
            req.actorRole = user.role;
            req.actorInstId = user.institutionId;
            return next();
        }

        // Creator of the group can still edit/delete their own group
        if ((action === 'edit' || action === 'delete') && req.params.groupId) {
            const [grp] = await db.execute(
                'SELECT created_by FROM `groups` WHERE id = ?',
                [req.params.groupId]
            );
            if (grp.length > 0 && String(grp[0].created_by) === String(userId)) {
                req.isAdminEquivalent = false;
                req.actorRole = user.role;
                req.actorInstId = user.institutionId;
                return next();
            }
        }

        return res.status(403).json({ message: `Access denied. Requires ${action} permission for GroupChat.` });
    } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({ message: 'Server error verifying permissions.' });
    }
};


// --- 3. Group Options (classes + roles for group creation UI) ---
// GET /api/groups/options?userId=xxx&instId=xxx
app.get('/api/groups/options', async (req, res) => {
    const { userId, instId } = req.query;
    if (!userId || !instId) return res.status(400).json({ error: 'userId and instId are required' });

    try {
        const [users] = await db.execute(
            'SELECT role, institutionId FROM users WHERE id = ?', [userId]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const [roles] = await db.execute(`
            SELECT DISTINCT role_name
              FROM roles
             WHERE institutionId = ?
               AND LOWER(role_name) != 'student'
             ORDER BY role_name ASC
        `, [instId]);

        const [classes] = await db.execute(`
            SELECT className, section
              FROM classes
             WHERE institutionId = ?
             ORDER BY className ASC, section ASC
        `, [instId]);

        const roleList = roles.map(r => r.role_name);
        const classList = classes.map(c =>
            (c.section && c.section.trim() !== '')
                ? `${c.className} - ${c.section}`
                : c.className
        );

        res.json({ classes: classList, roles: roleList });
    } catch (error) {
        console.error('Error in /api/groups/options:', error.message);
        res.status(500).json({ classes: [], roles: [], error: error.message });
    }
});


// --- 4. Create Group ---
// POST /api/groups
// Body: { userId, institutionId, name, description, selectedCategories, backgroundColor, isReadOnly }
app.post('/api/groups', checkGroupPermission('edit'), async (req, res) => {
    try {
        const {
            userId, institutionId, name, description,
            selectedCategories, backgroundColor, isReadOnly
        } = req.body;

        if (!userId || !institutionId || !name || !Array.isArray(selectedCategories) || selectedCategories.length === 0) {
            return res.status(400).json({ message: 'userId, institutionId, name and selectedCategories are required.' });
        }

        let finalCategories = selectedCategories;

        if (!req.isAdminEquivalent) {
            finalCategories = selectedCategories.filter(cat =>
                cat !== 'All' && cat !== 'Super Admin' && cat !== 'Developer' && cat !== 'Teacher'
            );
            if (finalCategories.length === 0) {
                return res.status(403).json({ message: 'You can only create groups for specific classes.' });
            }
        }

        let whereClauses = [];
        let queryParams = [];

        finalCategories.forEach(category => {
            if (category === 'All' && req.isAdminEquivalent) {
                whereClauses.push('u.institutionId = ?');
                queryParams.push(institutionId);
            } else {
                whereClauses.push(`(
                    u.role = ?
                    OR (c.section IS NOT NULL AND c.section != '' AND CONCAT(c.className, ' - ', c.section) = ?)
                    OR ((c.section IS NULL OR c.section = '') AND c.className = ?)
                ) AND u.institutionId = ?`);
                queryParams.push(category, category, category, institutionId);
            }
        });

        const finalWhereClause = whereClauses.join(' OR ');

        const getUsersQuery = `
            SELECT DISTINCT u.id
              FROM users u
              LEFT JOIN classes c ON u.class_id = c.id
             WHERE ${finalWhereClause}
        `;

        const [usersToAdd] = await db.execute(getUsersQuery, queryParams);
        const memberIds = usersToAdd.map(u => u.id);
        const allMemberIds = [...new Set([parseInt(userId, 10), ...memberIds])];

        if (allMemberIds.length === 0) {
            return res.status(400).json({ message: 'No members found for the selected categories.' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [groupResult] = await conn.execute(
                `INSERT INTO \`groups\`
                   (institutionId, name, description, created_by, background_color, is_read_only)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [institutionId, name, description || null, userId,
                 backgroundColor || '#e5ddd5', isReadOnly ? 1 : 0]
            );
            const groupId = groupResult.insertId;

            for (const memberId of allMemberIds) {
                await conn.execute(
                    'INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
                    [groupId, memberId]
                );
            }

            await conn.commit();
            res.status(201).json({ message: 'Group created successfully!', groupId });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ message: 'Server error while creating group.' });
    }
});


// --- 5. List Groups for a User ---
// GET /api/groups?userId=xxx&instId=xxx
app.get('/api/groups', async (req, res) => {
    const { userId, instId } = req.query;
    if (!userId || !instId) return res.status(400).json({ error: 'userId and instId are required' });

    try {
        const [users] = await db.execute(
            'SELECT role, institutionId FROM users WHERE id = ?', [userId]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const isSystemAdmin = (users[0].role === 'Super Admin' || users[0].role === 'Developer');

        const [groups] = await db.execute(`
            SELECT
                g.id,
                g.name,
                g.description,
                g.created_at,
                g.created_by,
                g.group_dp_url,
                g.background_color,
                g.status,
                g.is_read_only,
                
                /* THE FIX: Generate text for media files instead of returning NULL */
                COALESCE(
                    lm.message_text, 
                    CASE 
                        WHEN lm.message_type = 'image' THEN '📷 Photo'
                        WHEN lm.message_type = 'video' THEN '🎥 Video'
                        WHEN lm.message_type = 'file' THEN CONCAT('📁 ', COALESCE(lm.file_name, 'Document'))
                        ELSE NULL 
                    END
                ) AS last_message_text,
                
                DATE_FORMAT(lm.timestamp, '%Y-%m-%dT%H:%i:%s') AS last_message_timestamp,
                (
                    SELECT COUNT(*)
                      FROM group_chat_messages unread_m
                     WHERE unread_m.group_id = g.id
                       AND unread_m.timestamp > COALESCE(gls.last_seen_timestamp, '1970-01-01')
                       AND unread_m.user_id != ?
                ) AS unread_count
              FROM \`groups\` g
              LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
              LEFT JOIN group_last_seen gls ON g.id = gls.group_id AND gls.user_id = ?
              LEFT JOIN (
                  /* THE FIX: Added message_type and file_name to the SELECT here */
                  SELECT group_id, message_text, message_type, file_name, timestamp,
                         ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY timestamp DESC) AS rn
                    FROM group_chat_messages
              ) lm ON g.id = lm.group_id AND lm.rn = 1
             WHERE g.institutionId = ?
               AND (gm.user_id IS NOT NULL OR ?)
             ORDER BY COALESCE(lm.timestamp, g.created_at) DESC
        `, [parseInt(userId, 10), parseInt(userId, 10), parseInt(userId, 10), parseInt(instId, 10), isSystemAdmin ? 1 : 0]);

        res.json(groups);
    } catch (error) {
        console.error('Error fetching user groups:', error);
        res.status(500).json({ message: 'Error fetching groups.' });
    }
});


// --- 6. Get Group Details ---
// GET /api/groups/:groupId/details?userId=xxx
app.get('/api/groups/:groupId/details', async (req, res) => {
    const { groupId } = req.params;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const [users] = await db.execute(
            'SELECT role, institutionId FROM users WHERE id = ?', [userId]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const { role, institutionId } = users[0];
        const isSystemAdmin = (role === 'Super Admin' || role === 'Developer');

        const [grp] = await db.execute(
            'SELECT * FROM `groups` WHERE id = ? AND institutionId = ?',
            [groupId, institutionId]
        );
        if (grp.length === 0) return res.status(404).json({ message: 'Group not found.' });

        if (!isSystemAdmin) {
           const [memberCheck] = await db.execute(
        'SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?',
        [parseInt(groupId, 10), parseInt(userId, 10)]
    );
            if (memberCheck.length === 0) {
                return res.status(403).json({ message: 'Access denied.' });
            }
        }

        res.json(grp[0]);
    } catch (error) {
        console.error('Error fetching group details:', error);
        res.status(500).json({ message: 'Error fetching group details.' });
    }
});


// --- 7. Mark Group as Seen ---
// POST /api/groups/:groupId/seen
// Body: { userId }
app.post('/api/groups/:groupId/seen', async (req, res) => {
    const { groupId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
    await db.execute(`
            INSERT INTO group_last_seen (group_id, user_id, last_seen_timestamp)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_seen_timestamp = NOW()
        `, [parseInt(groupId, 10), parseInt(userId, 10)]);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking group as seen:', error);
        res.status(500).json({ message: 'Could not mark group as seen.' });
    }
});


// --- 8. Update Group ---
// PUT /api/groups/:groupId
// Body: { userId, name, backgroundColor, isReadOnly }
app.put('/api/groups/:groupId', checkGroupPermission('edit'), async (req, res) => {
    const { groupId } = req.params;
    const { name, backgroundColor, isReadOnly } = req.body;

    try {
        await db.execute(
            'UPDATE `groups` SET name = ?, background_color = ?, is_read_only = ? WHERE id = ?',
            [name, backgroundColor || '#e5ddd5', isReadOnly ? 1 : 0, groupId]
        );
        res.json({ message: 'Group updated successfully.' });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ message: 'Failed to update group.' });
    }
});


// --- 9. Update Group Display Picture ---
// POST /api/groups/:groupId/dp
// Form data: { userId, group_dp (file) }
app.post('/api/groups/:groupId/dp', chatUpload.single('group_dp'), checkGroupPermission('edit'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const { groupId } = req.params;
    const fileUrl = `/public/uploads/chat_media/${req.file.filename}`;

    try {
        await db.execute(
            'UPDATE `groups` SET group_dp_url = ? WHERE id = ?',
            [fileUrl, groupId]
        );
        res.json({ message: 'Group DP updated successfully.', group_dp_url: fileUrl });
    } catch (error) {
        console.error('Error updating group DP:', error);
        res.status(500).json({ message: 'Failed to update group DP.' });
    }
});
// --- 10. Delete Group ---
// DELETE /api/groups/:groupId
// Body: { userId }
app.delete('/api/groups/:groupId', checkGroupPermission('delete'), async (req, res) => {
    const { groupId } = req.params;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM `groups` WHERE id = ?', [groupId]);
        await conn.commit();
        res.json({ message: 'Group deleted successfully.' });
    } catch (error) {
        await conn.rollback();
        console.error('Error deleting group:', error);
        res.status(500).json({ message: 'Failed to delete group.' });
    } finally {
        conn.release();
    }
});


// --- 11. Get Chat History ---
// GET /api/groups/:groupId/history?userId=xxx&page=1&limit=20
app.get('/api/groups/:groupId/history', async (req, res) => {
    const { groupId } = req.params;
 const { userId, page = 1, limit = 20 } = req.query;
const groupIdInt = parseInt(groupId, 10);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const [users] = await db.execute(
            'SELECT role, institutionId FROM users WHERE id = ?', [userId]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const isSystemAdmin = (users[0].role === 'Super Admin' || users[0].role === 'Developer');

        if (!isSystemAdmin) {
           const [memberCheck] = await db.execute(
        'SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupIdInt, parseInt(userId, 10)]
    );
            if (memberCheck.length === 0) {
                return res.status(403).json({ message: 'Access denied.' });
            }
        }

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);
        const groupIdNum = parseInt(groupId, 10);

        const [messages] = await db.execute(`
            SELECT
                m.id,
                m.message_text,
                DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%s') AS timestamp,
                m.user_id,
                m.group_id,
                m.message_type,
                m.file_url,
                m.file_size,
                m.file_mime_type,
                m.is_edited,
                m.is_deleted,
                m.deleted_by,
                m.is_pinned,
                m.file_name,
                m.reply_to_message_id,
                u.name AS full_name,
                u.role,
                u.profile_pic AS profile_image_url,
                u.roll_no,
                reply_m.message_text AS reply_text,
                reply_m.message_type AS reply_type,
                reply_u.name AS reply_sender_name
              FROM group_chat_messages m
              JOIN users u ON m.user_id = u.id
              LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
              LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
             WHERE m.group_id = ${groupIdNum}
             ORDER BY m.timestamp ASC
             LIMIT ${limitNum} OFFSET ${offsetNum}
        `);

        const [lastSeen] = await db.execute(
            'SELECT last_seen_timestamp FROM group_last_seen WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        res.json({
            messages,
            lastSeen: lastSeen.length > 0 ? lastSeen[0].last_seen_timestamp : null
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Error fetching chat history.' });
    }
});


// --- 12. Upload Chat Media ---
// POST /api/groups/media
// Form data: { userId, media (file) }
app.post('/api/groups/media', chatUpload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    res.status(201).json({
        fileUrl: `/public/uploads/chat_media/${req.file.filename}`,
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
        fileName: req.file.originalname
    });
});


// =====================================================================
// === SOCKET.IO — Real-Time Chat ======================================
// =====================================================================

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinGroup', (data) => {
        if (data.groupId) {
            socket.join(`group-${data.groupId}`);
        }
    });

    socket.on('sendMessage', async (data) => {
        const {
            userId, groupId, messageType, messageText,
            fileUrl, fileName, fileSize, fileMimeType,
            replyToMessageId, clientMessageId
        } = data;

        if (!userId || !groupId || !messageType) return;
        if (messageType === 'text' && !messageText?.trim()) return;
        if (messageType !== 'text' && !fileUrl) return;

        const roomName = `group-${groupId}`;
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO group_chat_messages
                   (user_id, group_id, message_type, message_text,
                    file_url, file_name, file_size, file_mime_type, reply_to_message_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, groupId, messageType, messageText || null,
                 fileUrl || null, fileName || null, fileSize || null,
                 fileMimeType || null, replyToMessageId || null]
            );
            const newMessageId = result.insertId;

            const [rows] = await conn.execute(`
                SELECT
                    m.id,
                    m.message_text,
                    DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%s') AS timestamp,
                    m.user_id,
                    m.group_id,
                    m.message_type,
                    m.file_url,
                    m.file_size,
                    m.file_mime_type,
                    m.is_edited,
                    m.is_deleted,
                    m.deleted_by,
                    m.is_pinned,
                    m.file_name,
                    m.reply_to_message_id,
                    u.name AS full_name,
                    u.role,
                    u.profile_pic AS profile_image_url,
                    u.roll_no,
                    reply_m.message_text AS reply_text,
                    reply_m.message_type AS reply_type,
                    reply_u.name AS reply_sender_name
                  FROM group_chat_messages m
                  JOIN users u ON m.user_id = u.id
                  LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
                  LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
                 WHERE m.id = ?
            `, [newMessageId]);

            await conn.commit();

            const broadcastMessage = { ...rows[0], clientMessageId: clientMessageId || null };
            io.to(roomName).emit('newMessage', broadcastMessage);
            io.emit('updateGroupList', { groupId });

        } catch (error) {
            await conn.rollback();
            console.error('Failed to save message:', error);
        } finally {
            conn.release();
        }
    });

    socket.on('deleteMessage', async (data) => {
        const { messageId, userId, groupId } = data;
        if (!messageId || !userId || !groupId) return;

        const roomName = `group-${groupId}`;
        const conn = await db.getConnection();
        try {
            const [msgRows] = await conn.execute(
                'SELECT user_id FROM group_chat_messages WHERE id = ?', [messageId]
            );
            if (msgRows.length === 0) return;

            const [userRows] = await conn.execute(
                'SELECT role, institutionId FROM users WHERE id = ?', [userId]
            );
            if (userRows.length === 0) return;

            const { role, institutionId } = userRows[0];
            const isSystemAdmin = (role === 'Super Admin' || role === 'Developer');

            const [perms] = await conn.execute(`
                SELECT p.can_delete
                  FROM permissions p
                  JOIN roles r ON p.role_id = r.id
                 WHERE r.role_name = ? AND r.institutionId = ? AND p.module_name = 'GroupChat'
            `, [role, institutionId]);

            const hasDeletePower = isSystemAdmin || (perms.length > 0 && perms[0].can_delete);
            const isOwnMessage = String(msgRows[0].user_id) === String(userId);

            if (!isOwnMessage && !hasDeletePower) return;

            await conn.execute(`
                UPDATE group_chat_messages
                   SET is_deleted = 1,
                       deleted_by = ?,
                       message_text = NULL,
                       file_url = NULL,
                       file_name = NULL,
                       file_size = NULL,
                       file_mime_type = NULL
                 WHERE id = ?
            `, [userId, messageId]);

            io.to(roomName).emit('messageDeleted', { messageId, deletedBy: userId });

        } catch (error) {
            console.error('Failed to delete message:', error);
        } finally {
            conn.release();
        }
    });

    socket.on('editMessage', async (data) => {
        const { messageId, newText, userId, groupId } = data;
        if (!messageId || !newText?.trim() || !userId || !groupId) return;

        const roomName = `group-${groupId}`;
        const conn = await db.getConnection();
        try {
            const [msgRows] = await conn.execute(
                'SELECT user_id FROM group_chat_messages WHERE id = ?', [messageId]
            );
            if (msgRows.length === 0) return;

            if (String(msgRows[0].user_id) !== String(userId)) return;

            await conn.execute(
                'UPDATE group_chat_messages SET message_text = ?, is_edited = 1 WHERE id = ?',
                [newText, messageId]
            );

            const [rows] = await conn.execute(`
                SELECT
                    m.id,
                    m.message_text,
                    DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%s') AS timestamp,
                    m.user_id,
                    m.group_id,
                    m.message_type,
                    m.file_url,
                    m.file_size,
                    m.file_mime_type,
                    m.is_edited,
                    m.is_deleted,
                    m.deleted_by,
                    m.is_pinned,
                    m.file_name,
                    m.reply_to_message_id,
                    u.name AS full_name,
                    u.role,
                    u.profile_pic AS profile_image_url,
                    u.roll_no,
                    reply_m.message_text AS reply_text,
                    reply_m.message_type AS reply_type,
                    reply_u.name AS reply_sender_name
                  FROM group_chat_messages m
                  JOIN users u ON m.user_id = u.id
                  LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
                  LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
                 WHERE m.id = ?
            `, [messageId]);

            io.to(roomName).emit('messageEdited', rows[0]);

            const [lastMsg] = await conn.execute(
                'SELECT id FROM group_chat_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 1',
                [groupId]
            );
            if (lastMsg.length > 0 && String(lastMsg[0].id) === String(messageId)) {
                io.emit('updateGroupList', { groupId });
            }

        } catch (error) {
            console.error('Failed to edit message:', error);
        } finally {
            conn.release();
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});



// =====================================================================
//  BACKEND — Section 23: ALUMNI
//
//  Append this whole block to backend/index.js, just BEFORE the final
//  `const PORT = ...` line.
//
//  ALSO add 'Alumni' to DEFAULT_MODULES at the top of index.js:
//    const DEFAULT_MODULES = [
//        'Overview','Manage Logins','Timetable','Academic Calendar',
//        'Attendance','Exams','Reports','Performance','Homework',
//        'Meals','Digital Labs','Syllabus','Alumni'
//    ];
//
//  Reuses nowSQL() from Section 16.
//
//  NOTE: 23.5 (promoteToAlumni) is the function the PROMOTION TAB calls
//  when its destination is "Alumni (Passout)". See the wiring file for
//  how to hook it into your existing promotion route.
// =====================================================================


// --- 23.1 Distinct passout years for the filter ---------------------
//   GET /api/admin/alumni/years/:instId
app.get('/api/admin/alumni/years/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT a.academic_year_id, a.passout_year,
                    y.name AS year_name
               FROM alumni a
               LEFT JOIN academic_years y ON y.id = a.academic_year_id
              WHERE a.institutionId = ?
              ORDER BY a.passout_year DESC`,
            [req.params.instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.2 Alumni list (card data) -----------------------------------
//   GET /api/admin/alumni/:instId?yearId=optional&q=optional
//   Light payload for the cards — excludes the heavy profile_pic/notes.
app.get('/api/admin/alumni/:instId', async (req, res) => {
    const { instId } = req.params;
    const { yearId, q } = req.query;
    try {
        let sql = `
            SELECT id, user_id, academic_year_id, passout_year, final_class,
                   name, email, phone, current_status, roll_no,
                   (profile_pic IS NOT NULL) AS has_pic
              FROM alumni
             WHERE institutionId = ?`;
        const params = [instId];
        if (yearId) { sql += ' AND academic_year_id = ?'; params.push(yearId); }
        if (q && q.trim()) {
            sql += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?
                          OR roll_no LIKE ? OR current_status LIKE ?)`;
            const like = `%${q.trim()}%`;
            params.push(like, like, like, like, like);
        }
        sql += ' ORDER BY name';
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.3 Single alumni (full detail incl. picture) -----------------
app.get('/api/admin/alumni/detail/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM alumni WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Alumni not found' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.4 Manually add an alumni ------------------------------------
//   Body: either { user_id, academic_year_id, passout_year } to snapshot
//   an existing student, OR a full manual record with name/email/etc.
app.post('/api/admin/alumni', async (req, res) => {
    const b = req.body;
    if (!b.institutionId) return res.status(400).json({ error: 'institutionId required.' });
    try {
        // If a user_id is supplied, snapshot from their profile first.
        let snap = {};
        if (b.user_id) {
            const [u] = await db.execute('SELECT * FROM users WHERE id = ?', [b.user_id]);
            if (u.length) {
                const s = u[0];
                snap = {
                    name: s.name, email: s.email, phone: s.phone,
                    gender: s.gender, dob: s.dob, address: s.address,
                    profile_pic: s.profile_pic, roll_no: s.roll_no,
                    admission_no: s.admission_no
                };
            }
        }
        const merged = { ...snap, ...b };   // explicit body fields win
        const [result] = await db.execute(
            `INSERT INTO alumni
               (institutionId, user_id, academic_year_id, passout_year, final_class,
                name, email, phone, gender, dob, address, profile_pic,
                roll_no, admission_no,
                current_status, occupation, organization, higher_education,
                location, linkedin, notes, created_by)
             VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?, ?,?,?,?,?,?,?, ?)`,
            [merged.institutionId, merged.user_id || null,
             merged.academic_year_id || null, merged.passout_year || null,
             merged.final_class || null,
             merged.name || null, merged.email || null, merged.phone || null,
             merged.gender || null, merged.dob || null, merged.address || null,
             merged.profile_pic || null, merged.roll_no || null, merged.admission_no || null,
             merged.current_status || null, merged.occupation || null,
             merged.organization || null, merged.higher_education || null,
             merged.location || null, merged.linkedin || null, merged.notes || null,
             merged.created_by || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.5 Promote a batch of students to Alumni ---------------------
//   Called by the PROMOTION TAB when destination = "Alumni (Passout)".
//   Body: { institutionId, student_ids: [..], academic_year_id,
//           passout_year, final_class, created_by }
//   Snapshots each student into `alumni` and sets users.status='alumni'.
app.post('/api/admin/alumni/promote', async (req, res) => {
    const {
        institutionId, student_ids, academic_year_id,
        passout_year, final_class, created_by
    } = req.body;
    if (!institutionId || !Array.isArray(student_ids) || student_ids.length === 0) {
        return res.status(400).json({ error: 'institutionId and student_ids[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let added = 0;
        for (const sid of student_ids) {
            const [u] = await conn.execute('SELECT * FROM users WHERE id = ?', [sid]);
            if (!u.length) continue;
            const s = u[0];

            // skip if already an alumni record for this user + year
            const [exists] = await conn.execute(
                'SELECT id FROM alumni WHERE user_id = ? AND academic_year_id = ?',
                [sid, academic_year_id || null]
            );
            if (exists.length) continue;

            await conn.execute(
                `INSERT INTO alumni
                   (institutionId, user_id, academic_year_id, passout_year, final_class,
                    name, email, phone, gender, dob, address, profile_pic,
                    roll_no, admission_no, created_by)
                 VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?, ?)`,
                [institutionId, sid, academic_year_id ?? null, passout_year ?? null,
                 final_class ?? null,
                 s.name ?? null, s.email ?? null, s.phone ?? null, s.gender ?? null,
                 s.dob ?? null, s.address ?? null, s.profile_pic ?? null,
                 s.roll_no ?? null, s.admission_no ?? null, created_by ?? null]
            );
            // deactivate the original account
            await conn.execute(
                "UPDATE users SET status = 'alumni' WHERE id = ?", [sid]);
            added++;
        }
        await conn.commit();
        res.json({ success: true, added });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 23.6 Update the editable / extra fields ------------------------
//   Body: any of current_status, occupation, organization,
//   higher_education, location, linkedin, notes, name, email, phone.
app.put('/api/admin/alumni/:id', async (req, res) => {
    const b = req.body;
    const fields = [
        'name','email','phone','gender','dob','address',
        'current_status','occupation','organization','higher_education',
        'location','linkedin','notes','passout_year','final_class'
    ];
    const sets = [];
    const params = [];
    fields.forEach(f => {
        if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(b[f] || null); }
    });
    if (sets.length === 0) return res.json({ success: true });   // nothing to change
    params.push(req.params.id);
    try {
        await db.execute(`UPDATE alumni SET ${sets.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.7 Delete an alumni record -----------------------------------
app.delete('/api/admin/alumni/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM alumni WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 23.8 Candidates for manual add ---------------------------------
//   GET /api/admin/alumni/candidates/:instId/:classId
//   Active students of a class — for the manual "Add to Alumni" picker.
app.get('/api/admin/alumni/candidates/:instId/:classId', async (req, res) => {
    const { instId, classId } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT id, name, roll_no, email, phone
               FROM users
              WHERE institutionId = ? AND class_id = ?
                AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) <> 'alumni')
              ORDER BY roll_no, name`,
            [instId, classId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
// === 14. LESSON PLAN MODULE ==========================================
// =====================================================================

// Get the single latest Guideline image for the school
app.get('/api/admin/lesson-plans/:instId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, image_data FROM lesson_plans WHERE institutionId = ? ORDER BY created_at DESC LIMIT 1',
            [req.params.instId]
        );
        res.json(rows[0] || null);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update/Upload the Guideline image
app.post('/api/admin/lesson-plans', async (req, res) => {
    const { institutionId, image_data } = req.body;
    try {
        // We simply insert a new one, and the GET request always picks the latest
        await db.execute(
            'INSERT INTO lesson_plans (institutionId, image_data, title) VALUES (?, ?, ?)',
            [institutionId, image_data, 'Active Guideline']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/lesson-plans/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM lesson_plans WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`);
});