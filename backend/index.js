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
const server = http.createServer({ maxHeaderSize: 81920 }, app);

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
    connectionLimit: 25,
    enableKeepAlive: true,
    dateStrings: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';


// =====================================================================
// === AUTH CORE — token gate + role / tenant helpers ==================
//
//   PASTE THIS ONCE, near the top of index.js, immediately AFTER:
//       const JWT_SECRET = process.env.JWT_SECRET || 'unified_erp_key_2025';
//   and BEFORE Section 1 (the app.post('/api/login') route).
//
//   Order matters: this installs a gate on EVERY /api route, so it must
//   be registered before the routes are defined (they all sit below it).
//
//   What it does:
//     • Every request under /api now needs a valid login token, except
//       the allowlist (/login). No token -> 401, app asks them to log in.
//     • On success it attaches req.auth = { userId, role, institutionId }
//       taken from the VERIFIED token. THIS is the value every route
//       should trust from now on — never the URL (:instId) or the body.
//     • /developer/* is Developer-only; /group/* is Group Admin (or Dev).
//
//   Nothing here touches your database. Self-contained.
// =====================================================================

// How long a login lasts before the user must sign in again. Change to
// '12h' or '30d' to taste, or set TOKEN_TTL in the environment.
// (Your /api/login currently signs with '24h'. To use this value, change
//  that '24h' to TOKEN_TTL in the login route — optional.)
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';

// Paths under /api that must work WITHOUT a token. Everything else is
// closed. NOTE: these are written WITHOUT the /api prefix (Express strips
// it inside this mounted middleware), so '/api/login' is just '/login'.
//   If you have any other genuinely public endpoint — e.g. an outsider
//   submitting a pre-admission enquiry form with no account — add its
//   path here, otherwise it will start returning 401.
const PUBLIC_API_PATHS = new Set(['/login']);

// Verify the Bearer token. Returns the decoded payload, or null after
// sending the 401 itself.
function _readToken(req, res) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) { res.status(401).json({ error: 'Please sign in to continue.' }); return null; }
    try {
        return jwt.verify(match[1], JWT_SECRET);
    } catch (e) {
        res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
        return null;
    }
}

// ---- THE GATE: authenticate every /api request ----------------------
app.use('/api', (req, res, next) => {
    if (req.method === 'OPTIONS') return next();          // CORS preflight
    if (PUBLIC_API_PATHS.has(req.path)) return next();    // allowlist (login)

    const payload = _readToken(req, res);
    if (!payload) return;                                 // 401 already sent

    // The only identity routes may trust from here on.
    req.auth = {
        userId: payload.id,
        role: payload.role,
        institutionId: payload.instId
    };

    // Developer console — Developer only.
    if (req.path.startsWith('/developer/') && req.auth.role !== 'Developer') {
        return res.status(403).json({ error: 'Developer access only.' });
    }
    // Group console — Group Admin (or Developer).
    if (req.path.startsWith('/group/') && !['Group Admin', 'Developer'].includes(req.auth.role)) {
        return res.status(403).json({ error: 'Group access only.' });
    }

    next();
});

// ---- helpers used by the per-route tenant scoping (Part 2) ----------
//
// sameTenant(req, instId): true when the caller may act on this
// institution — their own, or a Developer (who spans all tenants).
function sameTenant(req, instId) {
    if (req.auth && req.auth.role === 'Developer') return true;
    return req.auth && String(req.auth.institutionId) === String(instId);
}

// requireRole('Super Admin', ...): drop into a single route to limit it
// to specific roles, e.g.
//   app.get('/api/admin/users-export/:instId', requireRole('Super Admin'), handler)
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.auth) return res.status(401).json({ error: 'Please sign in to continue.' });
        if (!roles.includes(req.auth.role)) {
            return res.status(403).json({ error: 'You do not have access to this action.' });
        }
        next();
    };
}



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
//  SMARTEDZ — GROUP OF INSTITUTES (parent_id model)
//  Backend changes for index.js. Splice the marked sections into your
//  existing file (replace the same-numbered blocks; add Section 2b new).
//  NOTHING in your per-module code (Attendance, Marks, Timetable,
//  Notifications, Reports, Performance) changes — branches are normal
//  institutionId-scoped tenants and your modules already scope by it.
//
//  ────────────────────────────────────────────────────────────────────
//  ONE-TIME MIGRATION (run in MySQL Workbench, in this order):
//
//    -- 1. Re-home any existing 'University' rows before dropping the value
//    --    (id > 0 keeps Workbench safe-update mode happy).
//    UPDATE institutions SET type='College' WHERE type='University' AND id > 0;
//
//    -- 2. Swap the enum: drop University, add Group (Tuition kept).
//    ALTER TABLE institutions
//      MODIFY COLUMN `type` ENUM('School','College','Tuition','Group') NOT NULL;
//
//    -- 3. Add the self-referencing parent link (group -> branches).
//    --    RESTRICT = you can't delete a group while branches still exist,
//    --    so a stray delete can never wipe a whole org's data.
//    ALTER TABLE institutions
//      ADD COLUMN parent_id INT NULL AFTER `type`,
//      ADD KEY fk_inst_parent (parent_id),
//      ADD CONSTRAINT fk_inst_parent FOREIGN KEY (parent_id)
//          REFERENCES institutions(id) ON DELETE RESTRICT;
//  ────────────────────────────────────────────────────────────────────
//
//  MODEL RECAP:
//    • Group  = institutions row, type='Group', parent_id=NULL. Owns the
//               PLAN (branches inherit it). Has a 'Group Admin' user who
//               logs in to the group console. No classes/students itself.
//    • Branch = institutions row, type School/College/Tuition,
//               parent_id = group id. A normal tenant with its own
//               'Super Admin', users, classes, marks, etc.
//    • Standalone = parent_id=NULL, type School/College/Tuition. Exactly
//               today's behaviour — unchanged.
// =====================================================================


// =====================================================================
// === REPLACE Section 1 — LOGIN (plan now walks up to the group) ======
//
//   Only change vs your current login: when the user's institution has a
//   parent_id (i.e. it's a branch), the plan-expiry check reads the
//   GROUP's plan instead of the branch's own (branches inherit).
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
            const [instRows] = await db.execute(
                'SELECT id, parent_id, usage_plan, plan_start_date FROM institutions WHERE id = ?',
                [user.institutionId]
            );
            if (instRows.length > 0) {
                let planRow = instRows[0];
                // Branch? Inherit the group's plan.
                if (planRow.parent_id) {
                    const [p] = await db.execute(
                        'SELECT usage_plan, plan_start_date FROM institutions WHERE id = ?',
                        [planRow.parent_id]
                    );
                    if (p.length) planRow = p[0];
                }
                const status = computePlanStatus(planRow.usage_plan, planRow.plan_start_date);
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
// === REPLACE Section 2 — DEVELOPER ENDPOINTS =========================
//
//   onboard / update now accept `parent_id` and a 'Group' type:
//     • type='Group'  -> umbrella row, parent forced NULL, owns the plan,
//                        admin user is created with role='Group Admin',
//                        academic system roles are NOT seeded (no school).
//     • otherwise      -> branch (if parent_id given) or standalone,
//                        admin user role='Super Admin', system roles seeded.
//
//   /developer/data decoration resolves each branch's plan from its group
//   (so the dashboard shows the inherited plan, not the placeholder).
// =====================================================================

// Resolve the plan a row should DISPLAY: a branch shows its group's plan.
function _effectivePlan(inst, byId) {
    const src = (inst.parent_id && byId[inst.parent_id]) ? byId[inst.parent_id] : inst;
    return { usage_plan: src.usage_plan, plan_start_date: src.plan_start_date };
}

app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, username, role, institutionId, password, status FROM users');
        const byId = {};
        insts.forEach(i => { byId[i.id] = i; });
        const decorated = insts.map(inst => {
            const eff = _effectivePlan(inst, byId);
            // Override the plan fields too, so branch cards read the group's
            // plan (their own usage_plan column is just a placeholder).
            return { ...inst, usage_plan: eff.usage_plan, plan_start_date: eff.plan_start_date,
                     ...computePlanStatus(eff.usage_plan, eff.plan_start_date) };
        });
        res.json({ institutions: decorated, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Onboard: group OR branch OR standalone --------------------------
app.post('/api/developer/onboard', async (req, res) => {
    const { name, type, parent_id, logo, schoolKey, school_email, phone,
            usage_plan, plan_start_date,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;

    const isGroup = type === 'Group';
    const parentId = isGroup ? null : (parent_id || null);           // a group never has a parent
    const plan = PLAN_DAYS.hasOwnProperty(usage_plan) ? usage_plan : 'Full Time';
    const startDate = plan_start_date || new Date().toISOString().slice(0, 10);
    const adminRole = isGroup ? 'Group Admin' : 'Super Admin';        // umbrella vs branch principal

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, parent_id, logo, schoolKey, school_email, phone, usage_plan, plan_start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, type, parentId, logo, schoolKey, school_email, phone, plan, startDate]
        );
        const instId = inst.insertId;

        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, adminRole, instId]
        );

        // Academic system roles only make sense for real schools, not the
        // group umbrella (it owns no students/teachers/classes).
        if (!isGroup) {
            for (const roleName of SYSTEM_ROLES) {
                await conn.execute('INSERT IGNORE INTO roles (role_name, institutionId) VALUES (?, ?)', [roleName, instId]);
            }
        }

        await conn.commit();
        res.json({ success: true, id: instId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- Update institution (group / branch / standalone) ----------------
app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, parent_id, logo, school_email, phone, usage_plan, plan_start_date,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;

    const isGroup = type === 'Group';
    const parentId = isGroup ? null : (parent_id || null);
    const plan = PLAN_DAYS.hasOwnProperty(usage_plan) ? usage_plan : 'Full Time';
    const startDate = plan_start_date || new Date().toISOString().slice(0, 10);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            'UPDATE institutions SET name=?, type=?, parent_id=?, logo=?, school_email=?, phone=?, usage_plan=?, plan_start_date=? WHERE id=?',
            [name, type, parentId, logo, school_email, phone, plan, startDate, id]
        );
        // Update whichever platform admin this institution has (group OR branch).
        await conn.execute(
            'UPDATE users SET name=?, email=?, password=? WHERE institutionId=? AND role IN ("Super Admin","Group Admin")',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );
        if (!isGroup) {
            for (const roleName of SYSTEM_ROLES) {
                await conn.execute('INSERT IGNORE INTO roles (role_name, institutionId) VALUES (?, ?)', [roleName, id]);
            }
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
    } catch (err) {
        // FK RESTRICT: deleting a group that still has branches is blocked.
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
            return res.status(400).json({ error: 'This group still has branches. Move or delete its branches first.' });
        }
        res.status(500).json({ error: err.message });
    }
});


// =====================================================================
// === ADD Section 2b (NEW) — GROUP ADMIN ENDPOINTS ====================
//
//   A Group Admin (role='Group Admin', institutionId = the group row)
//   manages ONLY the branches whose parent_id = their group id. Every
//   route below is scoped to that group server-side, so a group owner
//   can never touch another group's data.
// =====================================================================

// Aggregate data for the group console.
function _ownsGroup(req, groupId) {
    if (req.auth.role === 'Developer') return true;
    return String(req.auth.institutionId) === String(groupId);
}
 
app.get('/api/group/data/:groupId', async (req, res) => {
    const { groupId } = req.params;
    if (!_ownsGroup(req, groupId)) return res.status(403).json({ error: 'You can only view your own group.' });
    try {
        const [grpRows] = await db.execute('SELECT * FROM institutions WHERE id = ? AND type = "Group"', [groupId]);
        if (grpRows.length === 0) return res.status(404).json({ error: 'Group not found.' });
        const group = { ...grpRows[0], ...computePlanStatus(grpRows[0].usage_plan, grpRows[0].plan_start_date) };
 
        const [branches] = await db.execute('SELECT * FROM institutions WHERE parent_id = ? ORDER BY created_at DESC', [groupId]);
        const decorated = branches.map(b => ({
            ...b, usage_plan: group.usage_plan, plan_start_date: group.plan_start_date,
            ...computePlanStatus(group.usage_plan, group.plan_start_date)
        }));
 
        const branchIds = branches.map(b => b.id);
        let users = [];
        if (branchIds.length) {
            const ph = branchIds.map(() => '?').join(',');
            const [u] = await db.execute(
                `SELECT id, name, email, role, institutionId, status, password FROM users WHERE institutionId IN (${ph})`,
                branchIds
            );
            users = u;
        }
        res.json({ group, branches: decorated, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.post('/api/group/:groupId/branch', async (req, res) => {
    const { groupId } = req.params;
    if (!_ownsGroup(req, groupId)) return res.status(403).json({ error: 'You can only add branches to your own group.' });
    const { name, type, logo, schoolKey, school_email, phone,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const branchType = ['School', 'College', 'Tuition'].includes(type) ? type : 'School';
 
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [grp] = await conn.execute('SELECT id FROM institutions WHERE id = ? AND type = "Group"', [groupId]);
        if (grp.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Group not found.' }); }
 
        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, parent_id, logo, schoolKey, school_email, phone, usage_plan, plan_start_date) VALUES (?, ?, ?, ?, ?, ?, ?, "Full Time", CURDATE())',
            [name, branchType, groupId, logo, schoolKey, school_email, phone]
        );
        const instId = inst.insertId;
 
        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, "Super Admin", ?)',
            [superAdminName, superAdminEmail, superAdminPassword, instId]
        );
        for (const roleName of SYSTEM_ROLES) {
            await conn.execute('INSERT IGNORE INTO roles (role_name, institutionId) VALUES (?, ?)', [roleName, instId]);
        }
 
        await conn.commit();
        res.json({ success: true, id: instId });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
            return res.status(400).json({ error: 'That login email is already in use.' });
        }
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});
 
app.put('/api/group/:groupId/branch/:id', async (req, res) => {
    const { groupId, id } = req.params;
    if (!_ownsGroup(req, groupId)) return res.status(403).json({ error: 'You can only edit branches in your own group.' });
    const { name, type, logo, school_email, phone,
            superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const branchType = ['School', 'College', 'Tuition'].includes(type) ? type : 'School';
 
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [own] = await conn.execute('SELECT id FROM institutions WHERE id = ? AND parent_id = ?', [id, groupId]);
        if (own.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Branch not found in this group.' }); }
 
        await conn.execute(
            'UPDATE institutions SET name=?, type=?, logo=?, school_email=?, phone=? WHERE id=?',
            [name, branchType, logo, school_email, phone, id]
        );
        await conn.execute(
            'UPDATE users SET name=?, email=?, password=? WHERE institutionId=? AND role="Super Admin"',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});
 
app.delete('/api/group/:groupId/branch/:id', async (req, res) => {
    const { groupId, id } = req.params;
    if (!_ownsGroup(req, groupId)) return res.status(403).json({ error: 'You can only delete branches in your own group.' });
    try {
        const [r] = await db.execute('DELETE FROM institutions WHERE id = ? AND parent_id = ?', [id, groupId]);
        res.json({ success: true, deleted: r.affectedRows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
// === 15.8 ARCHIVE TRACKING — per-module "final archive" freshness ====
//
//   HARDENED so a missing timestamp column or a single failing module
//   can never blank out the whole status (which made the tick stick on
//   "Not saved yet" even after a successful download).
//
//   Changes vs the previous version:
//     • computeArchiveFingerprint now has a graceful fallback for EVERY
//       module (not just users), so a missing updated_at/marked_at column
//       degrades to a count-only signature instead of throwing.
//     • archive-status wraps each module independently — one module
//       erroring no longer 500s the entire response.
//
//   MIGRATION (run once — safe to re-run):
//     CREATE TABLE IF NOT EXISTS archive_downloads (
//       id INT AUTO_INCREMENT PRIMARY KEY,
//       institutionId INT NOT NULL,
//       academic_year_id INT NOT NULL,
//       module VARCHAR(32) NOT NULL,
//       fingerprint VARCHAR(255) NOT NULL,
//       downloaded_by INT NULL,
//       downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//       UNIQUE KEY uq_archive (institutionId, academic_year_id, module)
//     );
//     -- optional, lets user edits invalidate the users archive:
//     -- ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NULL
//     --   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
// =====================================================================

const ARCHIVE_MODULES = ['users', 'attendance', 'marks', 'performance'];

const _archNorm = (v) => (v == null ? '' : (v instanceof Date ? v.toISOString() : String(v)));

// Signature of a module's CURRENT data for an institution + year.
// Every branch falls back to a count-only signature if its preferred
// timestamp columns don't exist, so this never throws on schema drift.
async function computeArchiveFingerprint(instId, yearId, module) {
    if (module === 'users') {
        let rows;
        try {
            [rows] = await db.execute(
                `SELECT COUNT(*) c, COALESCE(MAX(updated_at), '') t, COALESCE(MAX(id), 0) mx
                   FROM users
                  WHERE institutionId = ? AND (status IS NULL OR LOWER(TRIM(status)) <> 'alumni')`,
                [instId]
            );
        } catch (e) {
            [rows] = await db.execute(
                `SELECT COUNT(*) c, '' t, COALESCE(MAX(id), 0) mx
                   FROM users
                  WHERE institutionId = ? AND (status IS NULL OR LOWER(TRIM(status)) <> 'alumni')`,
                [instId]
            );
        }
        const x = rows[0] || {};
        return `u:${x.c}|${_archNorm(x.t)}|${x.mx}`;
    }

    if (module === 'attendance') {
        let rows;
        try {
            [rows] = await db.execute(
                `SELECT COUNT(*) c, COALESCE(MAX(marked_at), '') mk, COALESCE(MAX(updated_at), '') up
                   FROM attendance
                  WHERE institutionId = ? AND academic_year_id = ?`,
                [instId, yearId]
            );
        } catch (e) {
            // marked_at / updated_at may not exist — fall back to count + max id.
            try {
                [rows] = await db.execute(
                    `SELECT COUNT(*) c, '' mk, COALESCE(MAX(id), 0) up
                       FROM attendance
                      WHERE institutionId = ? AND academic_year_id = ?`,
                    [instId, yearId]
                );
            } catch (e2) {
                [rows] = [{ c: 0, mk: '', up: '' }];
            }
        }
        const x = rows[0] || {};
        return `a:${x.c}|${_archNorm(x.mk)}|${_archNorm(x.up)}`;
    }

    if (module === 'marks' || module === 'performance') {
        const tag = module === 'performance' ? 'p' : 'm';
        let rows;
        try {
            [rows] = await db.execute(
                `SELECT COUNT(*) c, COALESCE(MAX(updated_at), '') up, COALESCE(MAX(id), 0) mx
                   FROM student_marks
                  WHERE institutionId = ? AND academic_year_id = ?`,
                [instId, yearId]
            );
        } catch (e) {
            try {
                [rows] = await db.execute(
                    `SELECT COUNT(*) c, '' up, COALESCE(MAX(id), 0) mx
                       FROM student_marks
                      WHERE institutionId = ? AND academic_year_id = ?`,
                    [instId, yearId]
                );
            } catch (e2) {
                [rows] = [{ c: 0, up: '', mx: 0 }];
            }
        }
        const x = rows[0] || {};
        return `${tag}:${x.c}|${_archNorm(x.up)}|${x.mx}`;
    }

    return '';
}

async function _getArchiveRow(instId, yearId, module) {
    const [rows] = await db.execute(
        'SELECT fingerprint, downloaded_at FROM archive_downloads WHERE institutionId = ? AND academic_year_id = ? AND module = ? LIMIT 1',
        [instId, yearId, module]
    );
    return rows[0] || null;
}

// ---- status for every module of one year ----------------------------
//   Each module is computed independently; if one throws, it degrades to
//   a safe "not downloaded" entry instead of failing the whole response.
app.get('/api/admin/archive-status/:instId/:yearId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { yearId } = req.params;
    try {
        const modules = {};
        for (const m of ARCHIVE_MODULES) {
            try {
                const current = await computeArchiveFingerprint(instId, yearId, m);
                const row = await _getArchiveRow(instId, yearId, m);
                modules[m] = {
                    downloaded: !!row,
                    stale: row ? row.fingerprint !== current : false,
                    downloadedAt: row ? row.downloaded_at : null
                };
            } catch (mErr) {
                console.error(`[archive-status] module "${m}" failed:`, mErr.message);
                modules[m] = { downloaded: false, stale: false, downloadedAt: null, error: true };
            }
        }
        res.json({ modules });
    } catch (err) {
        console.error('[archive-status]', err);
        res.status(500).json({ error: err.message });
    }
});

// ---- record a successful final-archive download ---------------------
app.post('/api/admin/archive-record/:instId/:yearId/:module', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { yearId, module } = req.params;
    const downloadedBy = req.auth.userId || null;          // actor from token, not body
    if (!ARCHIVE_MODULES.includes(module)) {
        return res.status(400).json({ error: 'Unknown module.' });
    }
    try {
        const fingerprint = await computeArchiveFingerprint(instId, yearId, module);
        await db.execute(
            `INSERT INTO archive_downloads (institutionId, academic_year_id, module, fingerprint, downloaded_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                fingerprint = VALUES(fingerprint),
                downloaded_by = VALUES(downloaded_by),
                downloaded_at = CURRENT_TIMESTAMP`,
            [instId, yearId, module, fingerprint, downloadedBy]
        );
        const row = await _getArchiveRow(instId, yearId, module);
        res.json({ downloaded: true, stale: false, downloadedAt: row ? row.downloaded_at : new Date() });
    } catch (err) {
        console.error('[archive-record]', err);
        res.status(500).json({ error: err.message });
    }
});



// =====================================================================
// === REPLACE Section 3 — SUPER ADMIN School Aggregate Data ===========
//
//   Only change: a branch's `institution.plan*` fields are resolved from
//   its GROUP, so anything showing plan/days-left on the branch side
//   reflects the inherited plan instead of the placeholder.
// =====================================================================
app.get('/api/admin/data/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const includeFullUsers = req.query.fullUsers === 'true';
        let users;
        if (includeFullUsers) {
            [users] = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        } else {
            [users] = await db.execute(
                `SELECT id, name, email, username, role, institutionId, class_id, section, roll_no, status
                   FROM users WHERE institutionId = ?`, [instId]);
        }
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
 
        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
        const subjectClasses = {};
        scRows.forEach(r => {
            if (!subjectClasses[r.subject_id]) subjectClasses[r.subject_id] = [];
            subjectClasses[r.subject_id].push(r.class_id);
        });
 
        let institution = null;
        if (inst[0]) {
            let planRow = inst[0];
            let parentName = null;
            let parentLogo = null;
            if (inst[0].parent_id) {
                const [p] = await db.execute(
                    'SELECT name, logo, usage_plan, plan_start_date FROM institutions WHERE id = ?',
                    [inst[0].parent_id]
                );
                if (p.length) {
                    planRow = { usage_plan: p[0].usage_plan, plan_start_date: p[0].plan_start_date };
                    parentName = p[0].name;
                    parentLogo = p[0].logo;
                }
            }
            institution = {
                ...inst[0],
                parent_name: parentName,
                parent_logo: parentLogo,
                usage_plan: planRow.usage_plan,
                plan_start_date: planRow.plan_start_date,
                ...computePlanStatus(planRow.usage_plan, planRow.plan_start_date)
            };
        }
 
        res.json({
            users, classes, academicYears: years, roles, subjects,
            teacherSubjects, subjectClasses, modules: DEFAULT_MODULES, institution,
            systemRoles: SYSTEM_ROLES
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 4. USERS — Full CRUD ============================================
//
//  REPLACE your whole Section 4 block with this.
//
//  In this version:
//    • Every NEW user is automatically stamped with the institution's
//      ACTIVE academic year (academic_year_id). The backend decides it,
//      so it can't be faked from the client. On EDIT the original year
//      is preserved (never changed).
//    • Roll number is unique PER CLASS; on edit, uniqueness is only
//      re-checked for fields that actually changed (so editing other
//      info never reports a false "roll already used").
//
//  Run the migration first:
//    ALTER TABLE users
//      ADD COLUMN academic_year_id int DEFAULT NULL AFTER class_id,
//      ADD KEY fk_user_academic_year (academic_year_id),
//      ADD CONSTRAINT fk_user_academic_year FOREIGN KEY (academic_year_id)
//          REFERENCES academic_years (id) ON DELETE SET NULL;
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

// The institution's currently-active academic year id (or null).
// Every module now anchors to this — new users get stamped with it.
async function getActiveAcademicYearId(conn, instId) {
    const [rows] = await conn.execute(
        'SELECT id FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1',
        [instId]
    );
    return rows.length ? rows[0].id : null;
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

// Small helper: does any OTHER row match this query?
async function _exists(conn, sql, params) {
    const [rows] = await conn.execute(sql, params);
    return rows.length > 0;
}

// Compare two values as strings (handles number vs string, null vs '').
const _sameVal = (a, b) => String(a ?? '') === String(b ?? '');

// Uniqueness rules, scoped correctly:
//   • Roll number  -> unique WITHIN A CLASS (institutionId + class_id).
//   • PEN number   -> unique across the whole school.
//   • TC number    -> unique across the whole school.
//
//  `current` is the existing DB row when UPDATING (null when creating).
//  A field is only checked when it CHANGED vs `current`, so editing a
//  user without touching these fields never triggers a conflict.
//  The user being edited is also excluded via id <> excludeId.
async function checkUserUniqueness(conn, instId, body, excludeId, current) {
    const exclude = excludeId || 0;
    const cur = current || {};
    const isCreate = !current;

    // --- Roll number — per class -------------------------------------
    if (body.roll_no && body.class_id) {
        const rollChanged  = isCreate || !_sameVal(body.roll_no, cur.roll_no);
        const classChanged = isCreate || !_sameVal(body.class_id, cur.class_id);
        if (rollChanged || classChanged) {
            const taken = await _exists(conn,
                'SELECT id FROM users WHERE institutionId = ? AND class_id = ? AND roll_no = ? AND id <> ?',
                [instId, body.class_id, body.roll_no, exclude]);
            if (taken) return `Roll number "${body.roll_no}" is already used by another student in this class.`;
        }
    }

    // --- PEN number — school-wide ----------------------------------
    if (body.pen_no && (isCreate || !_sameVal(body.pen_no, cur.pen_no))) {
        const taken = await _exists(conn,
            'SELECT id FROM users WHERE institutionId = ? AND pen_no = ? AND id <> ?',
            [instId, body.pen_no, exclude]);
        if (taken) return `PEN number "${body.pen_no}" is already used by another user in this school.`;
    }

    // --- TC number — school-wide -------------------------------------
    if (body.tc_number && (isCreate || !_sameVal(body.tc_number, cur.tc_number))) {
        const taken = await _exists(conn,
            'SELECT id FROM users WHERE institutionId = ? AND tc_number = ? AND id <> ?',
            [instId, body.tc_number, exclude]);
        if (taken) return `TC number "${body.tc_number}" is already used by another user in this school.`;
    }

    return null;
}


// ---------------------------------------------------------------------
//  4.1  Create user  (auto-stamps the active academic year)
// ---------------------------------------------------------------------
app.post('/api/admin/users', async (req, res) => {
    const body = req.body;
    const institutionId = req.auth.institutionId;          // TENANT: from token, never the body
    const {
        name, email, username, password, role, modules,
        phone_no, roll_no, admission_no, class_id, section, status,
        dob, gender, address, profile_pic, subject_ids,
        aadhar_no, joining_date, prev_salary, present_salary, experience,
        pen_no, parent_name, admission_date,
        school_joined_date, school_joined_grade, tc_number
    } = body;
 
    const vErr = validateUserData(body);
    if (vErr) return res.status(400).json({ error: vErr });
 
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
 
        const uErr = await checkUserUniqueness(conn, institutionId, body, 0, null);
        if (uErr) { await conn.rollback(); return res.status(400).json({ error: uErr }); }
 
        const academicYearId = await getActiveAcademicYearId(conn, institutionId);
 
        const [result] = await conn.execute(
            `INSERT INTO users
              (name, email, username, password, role, institutionId, modules,
               phone_no, roll_no, admission_no, class_id, section, status,
               dob, gender, address, profile_pic,
               aadhar_no, joining_date, prev_salary, present_salary, experience,
               pen_no, parent_name, admission_date,
               school_joined_date, school_joined_grade, tc_number,
               academic_year_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, username || null, password, role, institutionId, modules || null,
             phone_no || null, roll_no || null, admission_no || null,
             class_id || null, section || null, status || 'active',
             dob || null, gender || null, address || null, profile_pic || null,
             aadhar_no || null, joining_date || null,
             prev_salary || null, present_salary || null, experience || null,
             pen_no || null, parent_name || null, admission_date || null,
             school_joined_date || null,
             school_joined_grade ? parseInt(school_joined_grade, 10) : null,
             tc_number || null,
             academicYearId]
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
//  4.2  Update user  (academic_year_id is preserved, never changed)
// ---------------------------------------------------------------------
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const {
        name, email, username, password, role, modules,
        phone_no, roll_no, admission_no, class_id, section, status,
        dob, gender, address, profile_pic, subject_ids,
        aadhar_no, joining_date, prev_salary, present_salary, experience,
        pen_no, parent_name, admission_date,
        school_joined_date, school_joined_grade, tc_number
    } = body;
 
    const vErr = validateUserData(body);
    if (vErr) return res.status(400).json({ error: vErr });
 
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
 
        const [owner] = await conn.execute(
            'SELECT institutionId, roll_no, class_id, pen_no, tc_number FROM users WHERE id = ?',
            [id]
        );
        if (owner.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'User not found.' }); }
        const current = owner[0];
        const instId = current.institutionId;
 
        // TENANT: refuse if this user belongs to another institution.
        if (!sameTenant(req, instId)) { await conn.rollback(); return res.status(403).json({ error: 'This user belongs to another institution.' }); }
 
        const uErr = await checkUserUniqueness(conn, instId, body, parseInt(id, 10), current);
        if (uErr) { await conn.rollback(); return res.status(400).json({ error: uErr }); }
 
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
             aadhar_no || null, joining_date || null,
             prev_salary || null, present_salary || null, experience || null,
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


// ---------------------------------------------------------------------
//  4.3  Delete user
// ---------------------------------------------------------------------
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT institutionId FROM users WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.json({ success: true });   // already gone
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
 
        await db.execute('DELETE FROM users WHERE id = ? AND institutionId = ?', [req.params.id, rows[0].institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// === 15.7 USERS EXPORT — full directory, register layout =============
app.get('/api/admin/users-export/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const ExcelJS = require('exceljs');
        const BRAND = 'FF3284C7';
        const dmy = (v) => {
            if (!v) return '';
            const d = (v instanceof Date) ? v : new Date(v);
            if (isNaN(d.getTime())) return '';
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        };
        const rollNum = (r) => { const n = parseInt(r, 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; };
        const money = (v) => (v === null || v === undefined || v === '') ? '' : v;
 
        const scope = (req.query.scope || 'all').toString();
        const isClassScope = scope.startsWith('class:');
        const specificClass = isClassScope ? parseInt(scope.slice(6), 10) : null;
        const includeStudents = scope === 'all' || scope === 'students' || isClassScope;
        const includeTeachers = scope === 'all' || scope === 'teachers';
        const includeOther = scope === 'all' || scope === 'other';
 
        let year = null;
        if (req.query.yearId) {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE id = ? AND institutionId = ?', [req.query.yearId, instId]);
            if (yr.length) year = yr[0];
        }
        if (!year) {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
            if (yr.length) year = yr[0];
        }
        const yearId = year ? year.id : null;
        const yLabel = year ? (year.name || '') : 'All years';
 
        const [instRows] = await db.execute('SELECT id, name FROM institutions WHERE id = ?', [instId]);
        const inst = instRows[0] || { name: 'Institution' };
 
        const [classes] = await db.execute('SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const classById = {}; classes.forEach(c => { classById[c.id] = c; });
        const labelOf = (cid) => { const c = classById[cid]; return c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : 'Unassigned'; };
 
        const [users] = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const roleLc = (u) => (u.role || '').toLowerCase().trim();
        const notAlumni = (u) => (u.status || '').toLowerCase() !== 'alumni';
        const isStudent = (u) => roleLc(u) === 'student';
        const isTeacher = (u) => roleLc(u).includes('teacher');
 
        let histClass = {};
        if (yearId) {
            const [hc] = await db.execute('SELECT DISTINCT student_id, class_id FROM student_marks WHERE institutionId = ? AND academic_year_id = ?', [instId, yearId]);
            hc.forEach(r => { if (histClass[r.student_id] == null) histClass[r.student_id] = r.class_id; });
        }
        const classOf = (u) => (histClass[u.id] != null ? histClass[u.id] : u.class_id);
 
        let subjByTeacher = {};
        try {
            const [ts] = await db.execute(
                `SELECT ts.teacher_id AS tid, s.name AS sname
                   FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id
                  WHERE s.institutionId = ?`, [instId]
            );
            ts.forEach(r => { (subjByTeacher[r.tid] = subjByTeacher[r.tid] || []).push(r.sname); });
        } catch (e) { /* leave subjects blank if schema differs */ }
 
        const live = users.filter(notAlumni);
        const studentsByClass = {};
        live.filter(isStudent).forEach(u => { const cid = classOf(u); (studentsByClass[cid] = studentsByClass[cid] || []).push(u); });
        Object.values(studentsByClass).forEach(list => list.sort((a, b) => rollNum(a.roll_no) - rollNum(b.roll_no) || (a.name || '').localeCompare(b.name || '')));
        const teacherUsers = live.filter(isTeacher).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const otherUsers = live.filter(u => !isStudent(u) && !isTeacher(u)).sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.name || '').localeCompare(b.name || ''));
 
        const STU_HEAD = ['Roll', 'Name', 'Section', 'Gender', 'DOB', 'Phone', 'Email', 'Username', 'Aadhaar No', 'Admission No', 'Admission Date', 'Parent / Guardian', 'PEN No', 'Joined Date', 'Joined Grade', 'TC No', 'Address', 'Status'];
        const stuRow = (u) => [
            u.roll_no || '', u.name || '', u.section || '', u.gender || '', dmy(u.dob), u.phone_no || '', u.email || '', u.username || '',
            u.aadhar_no || '', u.admission_no || '', dmy(u.admission_date), u.parent_name || '', u.pen_no || '',
            dmy(u.school_joined_date), (u.school_joined_grade ?? '') === '' ? '' : String(u.school_joined_grade), u.tc_number || '', u.address || '', u.status || ''
        ];
        const TEA_HEAD = ['S.No', 'Name', 'Role', 'Gender', 'DOB', 'Phone', 'Email', 'Username', 'Aadhaar No', 'Joining Date', 'Experience', 'Prev Salary', 'Present Salary', 'Subjects', 'Address', 'Status'];
        const teaRow = (u, i) => [
            i + 1, u.name || '', u.role || '', u.gender || '', dmy(u.dob), u.phone_no || '', u.email || '', u.username || '',
            u.aadhar_no || '', dmy(u.joining_date), u.experience || '', money(u.prev_salary), money(u.present_salary),
            (subjByTeacher[u.id] || []).join(', '), u.address || '', u.status || ''
        ];
        const OTH_HEAD = ['S.No', 'Name', 'Role', 'Gender', 'DOB', 'Phone', 'Email', 'Username', 'Aadhaar No', 'Joining Date', 'Experience', 'Prev Salary', 'Present Salary', 'Address', 'Status'];
        const othRow = (u, i) => [
            i + 1, u.name || '', u.role || '', u.gender || '', dmy(u.dob), u.phone_no || '', u.email || '', u.username || '',
            u.aadhar_no || '', dmy(u.joining_date), u.experience || '', money(u.prev_salary), money(u.present_salary), u.address || '', u.status || ''
        ];
        const maxCols = Math.max(STU_HEAD.length, TEA_HEAD.length, OTH_HEAD.length);
 
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz'; wb.created = new Date();
        const ws = wb.addWorksheet('Users');
        let r = 1;
 
        ws.mergeCells(r, 1, r, maxCols);
        const tt = ws.getCell(r, 1); tt.value = inst.name || 'Institution'; tt.font = { bold: true, size: 14, color: { argb: 'FF111827' } }; r++;
        ws.mergeCells(r, 1, r, maxCols);
        const sb = ws.getCell(r, 1); sb.value = `Users directory · ${yLabel}`; sb.font = { size: 10, color: { argb: 'FF6B7280' } }; r++;
        r++;
 
        const heading = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            c.alignment = { vertical: 'middle' }; ws.getRow(r).height = 20; r++;
        };
        const subHeading = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } }; r++;
        };
        const headerRow = (heads) => {
            const row = ws.getRow(r);
            heads.forEach((h, i) => {
                const c = row.getCell(i + 1); c.value = h;
                c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
                c.alignment = { vertical: 'middle', horizontal: (i < 2 ? 'left' : 'center'), wrapText: true };
            });
            row.height = 26; r++;
        };
        const dataRow = (vals) => {
            const row = ws.getRow(r);
            vals.forEach((v, i) => {
                const c = row.getCell(i + 1); c.value = (v === null || v === undefined) ? '' : v;
                c.font = { size: 9, color: { argb: 'FF374151' } };
                c.alignment = { horizontal: (i < 2 ? 'left' : 'center'), vertical: 'top', wrapText: i >= 2 };
            });
            r++;
        };
 
        if (includeStudents) {
            heading('STUDENTS');
            const cids = (specificClass != null ? [specificClass] : Object.keys(studentsByClass).map(Number))
                .filter(cid => studentsByClass[cid] && studentsByClass[cid].length)
                .sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { numeric: true }));
            if (cids.length === 0) subHeading('No students found for this selection');
            cids.forEach(cid => {
                subHeading(labelOf(cid));
                headerRow(STU_HEAD);
                studentsByClass[cid].forEach(u => dataRow(stuRow(u)));
                r++;
            });
        }
 
        if (includeTeachers) {
            heading('TEACHERS');
            headerRow(TEA_HEAD);
            if (teacherUsers.length === 0) { ws.getRow(r).getCell(2).value = 'No teachers found'; r++; }
            teacherUsers.forEach((u, i) => dataRow(teaRow(u, i)));
            r++;
        }
 
        if (includeOther) {
            heading('OTHER STAFF');
            headerRow(OTH_HEAD);
            if (otherUsers.length === 0) { ws.getRow(r).getCell(2).value = 'No other staff found'; r++; }
            otherUsers.forEach((u, i) => dataRow(othRow(u, i)));
            r++;
        }
 
        const widths = [8, 24, 12, 9, 12, 14, 26, 16, 16, 14, 14, 22, 16, 22, 12, 14, 30, 12];
        for (let i = 1; i <= maxCols; i++) ws.getColumn(i).width = widths[i - 1] || 14;
        ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 0 }];
 
        const scopeTag = isClassScope ? `Class_${labelOf(specificClass)}` : scope.charAt(0).toUpperCase() + scope.slice(1);
        const fileSafe = `${inst.name || 'institution'}_Users_${scopeTag}_${yLabel}`.replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafe}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[users-export] FATAL:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
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
    const institutionId = req.auth.institutionId;          // TENANT: from token
    const { role_name } = req.body;
    const trimmed = (role_name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Role name is required.' });
    if (isSystemRole(trimmed)) {
        return res.status(400).json({ error: `"${trimmed}" is a reserved system role name.` });
    }
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
    const { role_name } = req.body;
    const trimmed = (role_name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Role name is required.' });
 
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
 
        const [existing] = await conn.execute('SELECT role_name, institutionId FROM roles WHERE id = ?', [id]);
        if (existing.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Role not found' }); }
 
        const oldName = existing[0].role_name;
        const institutionId = existing[0].institutionId;   // TENANT: from the row, not the body
        if (!sameTenant(req, institutionId)) { await conn.rollback(); return res.status(403).json({ error: 'This role belongs to another institution.' }); }
 
        if (isSystemRole(oldName)) { await conn.rollback(); return res.status(400).json({ error: `The system role "${oldName}" cannot be renamed.` }); }
        if (isSystemRole(trimmed)) { await conn.rollback(); return res.status(400).json({ error: `"${trimmed}" is a reserved system role name.` }); }
 
        await conn.execute('UPDATE roles SET role_name = ? WHERE id = ?', [trimmed, id]);
        await conn.execute('UPDATE users SET role = ? WHERE role = ? AND institutionId = ?', [trimmed, oldName, institutionId]);
 
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
        const [rows] = await db.execute('SELECT role_name, institutionId FROM roles WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This role belongs to another institution.' });
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
        const [r] = await db.execute('SELECT institutionId FROM roles WHERE id = ?', [req.params.roleId]);
        if (r.length === 0) return res.json([]);
        if (!sameTenant(req, r[0].institutionId)) return res.status(403).json({ error: 'This role belongs to another institution.' });
 
        const [rows] = await db.execute('SELECT * FROM permissions WHERE role_id = ?', [req.params.roleId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.post('/api/admin/permissions', async (req, res) => {
    const { role_id, permissions } = req.body;
    const conn = await db.getConnection();
    try {
        const [r] = await conn.execute('SELECT institutionId FROM roles WHERE id = ?', [role_id]);
        if (r.length === 0) return res.status(404).json({ error: 'Role not found.' });
        if (!sameTenant(req, r[0].institutionId)) return res.status(403).json({ error: 'This role belongs to another institution.' });
 
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
 
// "My" permissions — always the logged-in user, taken from the token.
app.get('/api/admin/my-permissions/:userId', async (req, res) => {
    const userId = req.auth.userId;                         // TENANT: ignore the URL, use the token
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
//
//  REPLACE your whole Section 7 block with this.
//
//  Design decision: the ACTIVE year is NEVER changed automatically.
//  It anchors every module's data, and schools have different calendars
//  (some start in April, some in June), so auto-switching is unsafe.
//  Instead we expose the active year's status (days left / expired) so
//  the UI can warn the admin and let them switch manually.
//
//  No database change is required.
// =====================================================================

// Status of an academic year relative to today (reusable for the
// Academics screen now, and notifications / dashboard popups later).
function computeAcademicYearStatus(startDate, endDate) {
    const MS = 24 * 60 * 60 * 1000;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : null;
    const end   = endDate   ? new Date(endDate)   : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end)   end.setHours(0, 0, 0, 0);

    let daysLeft = null, expired = false, daysSinceEnd = 0, notStarted = false;

    if (end && !isNaN(end.getTime())) {
        daysLeft = Math.ceil((end - today) / MS);
        expired = daysLeft < 0;
        if (expired) daysSinceEnd = Math.abs(daysLeft);
    }
    if (start && !isNaN(start.getTime()) && today < start) notStarted = true;

    return { daysLeft, expired, daysSinceEnd, notStarted };
}


// --- 7.1 Create academic year ----------------------------------------
app.post('/api/admin/academics', async (req, res) => {
    const institutionId = req.auth.institutionId;          // TENANT: from token
    const { name, startDate, endDate } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        return res.status(400).json({ error: 'End date must be after the start date.' });
    }
    try {
        await db.execute(
            'INSERT INTO academic_years (name, startDate, endDate, isActive, institutionId) VALUES (?, ?, ?, 0, ?)',
            [name.trim(), startDate || null, endDate || null, institutionId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.put('/api/admin/academics/:id', async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        return res.status(400).json({ error: 'End date must be after the start date.' });
    }
    try {
        const [own] = await db.execute('SELECT institutionId FROM academic_years WHERE id = ?', [id]);
        if (own.length === 0) return res.status(404).json({ error: 'Academic year not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This academic year belongs to another institution.' });
 
        await db.execute('UPDATE academic_years SET name=?, startDate=?, endDate=? WHERE id=?',
            [name.trim(), startDate || null, endDate || null, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.put('/api/admin/academics/set-active/:id', async (req, res) => {
    const { id } = req.params;
    const institutionId = req.auth.institutionId;          // TENANT: from token
    const conn = await db.getConnection();
    try {
        const [own] = await conn.execute('SELECT institutionId FROM academic_years WHERE id = ?', [id]);
        if (own.length === 0) return res.status(404).json({ error: 'Academic year not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This academic year belongs to another institution.' });
 
        await conn.beginTransaction();
        await conn.execute('UPDATE academic_years SET isActive = 0 WHERE institutionId = ?', [institutionId]);
        await conn.execute('UPDATE academic_years SET isActive = 1 WHERE id = ? AND institutionId = ?', [id, institutionId]);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});
 
app.delete('/api/admin/academics/:id', async (req, res) => {
    const { id } = req.params;
    const conn = await db.getConnection();
    try {
        const [rows] = await conn.execute('SELECT id, institutionId, isActive FROM academic_years WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Academic year not found.' });
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This academic year belongs to another institution.' });
        if (rows[0].isActive) return res.status(400).json({ error: 'Cannot delete the active academic year. Set another year active first.' });
        const instId = rows[0].institutionId;
 
        await conn.beginTransaction();
        const [delMarks] = await conn.execute('DELETE FROM student_marks WHERE institutionId = ? AND academic_year_id = ?', [instId, id]);
        const [delAtt] = await conn.execute('DELETE FROM attendance WHERE institutionId = ? AND academic_year_id = ?', [instId, id]);
        await conn.execute('DELETE FROM academic_years WHERE id = ?', [id]);
        await conn.commit();
        res.json({ success: true, deletedMarks: delMarks.affectedRows, deletedAttendance: delAtt.affectedRows });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});
 
app.get('/api/admin/academics/status/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [rows] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
        if (!rows.length) return res.json({ hasActive: false, level: 'none', message: 'No academic year is currently active.' });
        const y = rows[0];
        const st = computeAcademicYearStatus(y.startDate, y.endDate);
        let level = 'ok', message = '';
        if (st.expired) { level = 'expired'; message = `The active academic year "${y.name}" ended ${st.daysSinceEnd} day(s) ago. Please set the next year as active.`; }
        else if (st.daysLeft != null && st.daysLeft <= 30) { level = 'warning'; message = `The active academic year "${y.name}" ends in ${st.daysLeft} day(s).`; }
        else if (st.notStarted) { level = 'info'; message = `The active academic year "${y.name}" has not started yet.`; }
        res.json({ hasActive: true, activeYear: y, ...st, level, message });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// === 30. ACADEMIC YEAR DATA EXPORT (multi-sheet .xlsx) ===============
// ---- styling constants ----------------------------------------------
const _XL_BRAND = 'FF3284C7';
const _XL_BRAND_SOFT = 'FFE7F1FB';
const _XL_ZEBRA = 'FFF7F8FA';
const _XL_THIN = { style: 'thin', color: { argb: 'FFD9DEE5' } };
const _XL_BORDERS = { top: _XL_THIN, left: _XL_THIN, bottom: _XL_THIN, right: _XL_THIN };
 
const _fmtDMY = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};
 
const _rollNum = (r) => {
    const n = parseInt(r, 10);
    return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};
 
// Excel sheet names: <=31 chars, none of  [ ] : * ? / \  ; must be unique.
function _safeSheetName(name, fallback, used) {
    let s = String(name || fallback || 'Sheet').replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) s = fallback || 'Sheet';
    s = s.slice(0, 31);
    if (used) {
        let base = s, n = 2;
        while (used.has(s.toLowerCase())) {
            const suffix = ' ' + n;
            s = base.slice(0, 31 - suffix.length) + suffix;
            n++;
        }
        used.add(s.toLowerCase());
    }
    return s;
}
 
function _xlTitle(ws, lastCol, inst, subtitle) {
    ws.mergeCells(1, 1, 1, lastCol);
    const t = ws.getCell(1, 1);
    t.value = inst.name || 'Institution';
    t.font = { bold: true, size: 14, color: { argb: _XL_BRAND } };
    ws.mergeCells(2, 1, 2, lastCol);
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = { size: 10, color: { argb: 'FF6B7280' } };
    ws.getRow(1).height = 20;
}
 
function _xlHeaderCell(cell) {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: _XL_BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = _XL_BORDERS;
}
 
function _xlWriteTable(ws, startRow, headers, rows, widths) {
    const hr = startRow;
    headers.forEach((h, i) => { const c = ws.getCell(hr, i + 1); c.value = h; _xlHeaderCell(c); });
    rows.forEach((r, ri) => {
        const rowNum = hr + 1 + ri;
        r.forEach((v, ci) => {
            const c = ws.getCell(rowNum, ci + 1);
            c.value = (v === undefined || v === null || v === '') ? '' : v;
            c.border = _XL_BORDERS;
            c.alignment = { vertical: 'middle', horizontal: (typeof v === 'number') ? 'center' : 'left' };
            if (ri % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: _XL_ZEBRA } };
        });
    });
    if (widths) widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.views = [{ state: 'frozen', ySplit: hr }];
    return hr + 1 + rows.length;
}
 
function _buildYearWorkbook(payload) {
    const { inst, year, students = [], staff = [], attendance = {}, marksClasses = [] } = payload;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SmartEdz';
    wb.created = new Date();
    const used = new Set();
    const yLabel = year?.name || '';
 
    // 1. Summary
    {
        const ws = wb.addWorksheet(_safeSheetName('Summary', 'Summary', used));
        _xlTitle(ws, 4, inst, `Academic Year Archive · ${yLabel}`);
        const info = [
            ['Institution', inst.name || '—'],
            ['Academic Year', yLabel || '—'],
            ['Year Period', [year?.startDate, year?.endDate].filter(Boolean).map(_fmtDMY).join('  to  ') || '—'],
            ['Email', inst.school_email || '—'],
            ['Phone', inst.phone || '—'],
            ['Generated On', new Date().toLocaleString('en-GB')],
            ['', ''],
            ['Students', String(students.length)],
            ['Staff', String(staff.length)],
            ['Classes with marks', String(marksClasses.length)],
            ['', ''],
            ['Note', 'This file is the offline archive for the academic year above. Keep a printed copy in the school records. Once the academic year is deleted from SmartEdz, this data cannot be recovered from the app.']
        ];
        info.forEach((r, i) => {
            const rn = 4 + i;
            const a = ws.getCell(rn, 1); a.value = r[0]; a.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
            const b = ws.getCell(rn, 2); b.value = r[1]; b.alignment = { wrapText: true, vertical: 'top' };
            if (r[0] === 'Note') { ws.mergeCells(rn, 2, rn, 4); ws.getRow(rn).height = 56; }
        });
        ws.getColumn(1).width = 22; ws.getColumn(2).width = 30; ws.getColumn(3).width = 18; ws.getColumn(4).width = 18;
    }
 
    // 2. Students
    {
        const ws = wb.addWorksheet(_safeSheetName('Students', 'Students', used));
        const headers = ['Roll', 'Name', 'Class', 'Section', 'Gender', 'DOB', 'Phone', 'Email', 'Username',
                         'Aadhaar No', 'Admission No', 'Admission Date', 'Parent / Guardian', 'PEN No',
                         'Joined Date', 'Joined Grade', 'TC No', 'Address', 'Status'];
        _xlTitle(ws, headers.length, inst, `Students · ${yLabel}`);
        const rows = students.map(s => [
            s.roll_no || '', s.name || '', s.classLabel || '', s.section || '', s.gender || '', s.dob || '',
            s.phone_no || '', s.email || '', s.username || '', s.aadhar_no || '', s.admission_no || '',
            s.admission_date || '', s.parent_name || '', s.pen_no || '', s.school_joined_date || '',
            s.school_joined_grade || '', s.tc_number || '', s.address || '', s.status || ''
        ]);
        _xlWriteTable(ws, 4, headers, rows, [8, 24, 14, 9, 9, 12, 14, 26, 16, 16, 14, 14, 22, 14, 14, 9, 14, 28, 10]);
    }
 
    // 3. Staff
    {
        const ws = wb.addWorksheet(_safeSheetName('Staff', 'Staff', used));
        const headers = ['S.No', 'Name', 'Role', 'Gender', 'DOB', 'Phone', 'Email', 'Username',
                         'Aadhaar No', 'Joining Date', 'Experience', 'Prev Salary', 'Present Salary',
                         'Subjects', 'Address', 'Status'];
        _xlTitle(ws, headers.length, inst, `Teachers & Staff · ${yLabel}`);
        const rows = staff.map((s, i) => [
            i + 1, s.name || '', s.role || '', s.gender || '', s.dob || '', s.phone_no || '',
            s.email || '', s.username || '', s.aadhar_no || '', s.joining_date || '', s.experience || '',
            (s.prev_salary ?? '') === '' ? '' : s.prev_salary, (s.present_salary ?? '') === '' ? '' : s.present_salary,
            s.subjects || '', s.address || '', s.status || ''
        ]);
        _xlWriteTable(ws, 4, headers, rows, [6, 24, 16, 9, 12, 14, 26, 16, 16, 13, 14, 13, 13, 22, 28, 10]);
    }
 
    // 4. Attendance — class summary
    {
        const ws = wb.addWorksheet(_safeSheetName('Attendance Summary', 'Attendance Summary', used));
        _xlTitle(ws, 6, inst, `Attendance — class overview · ${yLabel}`);
        const headers = ['Class', 'Students', 'Working Days', 'Present (total)', 'Absent (total)', 'Overall %'];
        const rows = (attendance.classSummary || []).map(r => [
            r.classLabel || '', r.students || 0, r.workingDays || 0, r.present || 0, r.absent || 0,
            (r.pct != null ? `${r.pct}%` : '—')
        ]);
        _xlWriteTable(ws, 4, headers, rows, [18, 10, 14, 16, 16, 12]);
    }
 
    // 5. Attendance — students
    {
        const ws = wb.addWorksheet(_safeSheetName('Attendance Students', 'Attendance Students', used));
        _xlTitle(ws, 7, inst, `Attendance — per student · ${yLabel}`);
        const headers = ['Class', 'Roll', 'Name', 'Working Days', 'Present', 'Absent', '%'];
        const rows = (attendance.students || []).map(r => [
            r.classLabel || '', r.roll || '', r.name || '', r.workingDays || 0, r.present || 0, r.absent || 0,
            (r.pct != null ? `${r.pct}%` : '—')
        ]);
        _xlWriteTable(ws, 4, headers, rows, [16, 8, 24, 14, 10, 10, 9]);
    }
 
    // 6. Attendance — staff
    {
        const ws = wb.addWorksheet(_safeSheetName('Attendance Staff', 'Attendance Staff', used));
        _xlTitle(ws, 6, inst, `Attendance — teachers & staff · ${yLabel}`);
        const headers = ['Name', 'Role', 'Working Days', 'Present', 'Absent', '%'];
        const rows = (attendance.staff || []).map(r => [
            r.name || '', r.role || '', r.workingDays || 0, r.present || 0, r.absent || 0,
            (r.pct != null ? `${r.pct}%` : '—')
        ]);
        _xlWriteTable(ws, 4, headers, rows, [24, 16, 14, 10, 10, 9]);
    }
 
    // 7. Marks register — one sheet per class
    marksClasses.forEach(cls => {
        const ws = wb.addWorksheet(_safeSheetName(`${cls.label} Marks`, 'Class Marks', used));
        const exams = cls.exams || [];
        const subjects = cls.subjects || [];
        const nCells = exams.length * subjects.length;
        const lastCol = 2 + nCells + 2;
 
        _xlTitle(ws, lastCol, inst, `Marks Register · ${cls.label} · ${yLabel}`);
 
        const hr1 = 4, hr2 = 5;
        ws.mergeCells(hr1, 1, hr2, 1); ws.getCell(hr1, 1).value = 'Roll'; _xlHeaderCell(ws.getCell(hr1, 1));
        ws.mergeCells(hr1, 2, hr2, 2); ws.getCell(hr1, 2).value = 'Name'; _xlHeaderCell(ws.getCell(hr1, 2));
 
        let col = 3;
        exams.forEach(ex => {
            const start = col;
            subjects.forEach(sub => { const c = ws.getCell(hr2, col); c.value = sub.name; _xlHeaderCell(c); col++; });
            const end = col - 1;
            if (end >= start) {
                ws.mergeCells(hr1, start, hr1, end);
                ws.getCell(hr1, start).value = ex.name;
                for (let k = start; k <= end; k++) _xlHeaderCell(ws.getCell(hr1, k));
            }
        });
        const totalCol = col, pctCol = col + 1;
        ws.mergeCells(hr1, totalCol, hr2, totalCol); ws.getCell(hr1, totalCol).value = 'Total'; _xlHeaderCell(ws.getCell(hr1, totalCol));
        ws.mergeCells(hr1, pctCol, hr2, pctCol); ws.getCell(hr1, pctCol).value = '%'; _xlHeaderCell(ws.getCell(hr1, pctCol));
 
        (cls.rows || []).forEach((r, ri) => {
            const rowNum = hr2 + 1 + ri;
            const zebra = ri % 2 === 1;
            const put = (cIdx, val, opts = {}) => {
                const c = ws.getCell(rowNum, cIdx);
                c.value = (val === undefined || val === null || val === '') ? '' : val;
                c.border = _XL_BORDERS;
                c.alignment = { vertical: 'middle', horizontal: opts.left ? 'left' : 'center' };
                if (opts.bold) c.font = { bold: true };
                if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
                else if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: _XL_ZEBRA } };
            };
            put(1, r.roll || '');
            put(2, r.name || '', { left: true });
            let cc = 3;
            exams.forEach(ex => subjects.forEach(sub => {
                const v = r.cells[`${ex.id}:${sub.id}`];
                put(cc, (v === undefined || v === null) ? '' : Number(v));
                cc++;
            }));
            put(totalCol, (r.total != null ? Number(r.total) : ''), { bold: true, fill: _XL_BRAND_SOFT });
            put(pctCol, (r.pct != null ? `${r.pct}%` : ''), { bold: true, fill: _XL_BRAND_SOFT });
        });
 
        ws.getColumn(1).width = 7;
        ws.getColumn(2).width = 22;
        for (let k = 3; k <= 2 + nCells; k++) ws.getColumn(k).width = 11;
        ws.getColumn(totalCol).width = 9;
        ws.getColumn(pctCol).width = 8;
        ws.views = [{ state: 'frozen', xSplit: 2, ySplit: hr2 }];
    });
 
    return wb;
}
 
// ---- the route -------------------------------------------------------
app.get('/api/admin/year-export/:instId/:yearId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { yearId } = req.params;
    try {
        // Validate the year belongs to this institution.
        const [yRows] = await db.execute(
            'SELECT * FROM academic_years WHERE id = ? AND institutionId = ?', [yearId, instId]
        );
        if (yRows.length === 0) return res.status(404).json({ error: 'Academic year not found for this institution.' });
        const year = yRows[0];
 
        const [instRows] = await db.execute(
            'SELECT id, name, school_email, phone FROM institutions WHERE id = ?', [instId]
        );
        const inst = instRows[0] || { name: 'Institution' };
 
        const [classes] = await db.execute(
            'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]
        );
        const classById = {}; classes.forEach(c => { classById[c.id] = c; });
        const labelOf = (cid) => { const c = classById[cid]; return c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : '—'; };
 
        const [users] = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
 
        // ---- marks (year-scoped) → also gives each student's historical class
        const [mrows] = await db.execute(
            `SELECT sm.class_id, sm.student_id, sm.subject_id, sm.exam_type_id, sm.marks_obtained,
                    u.name AS student_name, u.roll_no,
                    sub.name AS subject_name, et.name AS exam_name, et.exam_order
               FROM student_marks sm
               JOIN users u   ON u.id = sm.student_id
               JOIN subjects sub ON sub.id = sm.subject_id
               JOIN exam_types et ON et.id = sm.exam_type_id
              WHERE sm.institutionId = ? AND sm.academic_year_id = ?`,
            [instId, yearId]
        );
        const histClassByStudent = {};
        mrows.forEach(r => { if (histClassByStudent[r.student_id] == null) histClassByStudent[r.student_id] = r.class_id; });
        const classOfStudent = (u) => (histClassByStudent[u.id] != null ? histClassByStudent[u.id] : u.class_id);
 
        // per-class max marks for the % column
        const [maxAll] = await db.execute(
            `SELECT m.class_id, m.exam_type_id, m.subject_id, m.max_marks
               FROM exam_max_marks m JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`, [instId]
        );
        const maxRowsByClass = {};
        maxAll.forEach(r => { (maxRowsByClass[r.class_id] = maxRowsByClass[r.class_id] || []).push(r); });
        const maxMapByClass = {};
        Object.keys(maxRowsByClass).forEach(cid => { maxMapByClass[cid] = buildMaxMarksMap(maxRowsByClass[cid]); });
        const maxFor = (cid, etId, subId) => {
            const m = maxMapByClass[cid] && maxMapByClass[cid][etId];
            if (!m) return undefined;
            const sp = m.bySubject ? m.bySubject[subId] : undefined;
            if (sp !== undefined && sp !== null) return Number(sp);
            if (m.default !== undefined && m.default !== null) return Number(m.default);
            return undefined;
        };
 
        // ---- attendance (year-scoped), bucketed by historical class -----
        const isStudent = (u) => (u.role || '').toLowerCase().trim() === 'student';
        const studentUsers = users.filter(isStudent);
        const staffUsers = users.filter(u => !isStudent(u));
 
        const [attStu] = await db.execute(
            `SELECT a.user_id, a.attendance_date, a.status
               FROM attendance a JOIN users u ON u.id = a.user_id
              WHERE a.institutionId = ? AND a.academic_year_id = ? AND LOWER(TRIM(u.role)) = 'student'`,
            [instId, yearId]
        );
        const userById = {}; users.forEach(u => { userById[u.id] = u; });
        const stuAtt = {};                 // userId -> {present, absent}
        const classDates = {};             // classId -> Set(dates)
        attStu.forEach(r => {
            const a = (stuAtt[r.user_id] = stuAtt[r.user_id] || { present: 0, absent: 0 });
            if (r.status === 'P') a.present++; else if (r.status === 'A') a.absent++;
            const u = userById[r.user_id];
            if (u) {
                const cid = classOfStudent(u);
                const d = (r.attendance_date instanceof Date) ? r.attendance_date.toISOString().slice(0, 10) : String(r.attendance_date);
                (classDates[cid] = classDates[cid] || new Set()).add(d);
            }
        });
        const workingDaysOfClass = (cid) => (classDates[cid] ? classDates[cid].size : 0);
 
        const [attStaff] = await db.execute(
            `SELECT a.user_id, a.attendance_date, a.status
               FROM attendance a JOIN users u ON u.id = a.user_id
              WHERE a.institutionId = ? AND a.academic_year_id = ? AND LOWER(TRIM(u.role)) <> 'student'`,
            [instId, yearId]
        );
        const staffAtt = {};
        const staffDates = new Set();
        attStaff.forEach(r => {
            const a = (staffAtt[r.user_id] = staffAtt[r.user_id] || { present: 0, absent: 0 });
            if (r.status === 'P') a.present++; else if (r.status === 'A') a.absent++;
            const d = (r.attendance_date instanceof Date) ? r.attendance_date.toISOString().slice(0, 10) : String(r.attendance_date);
            staffDates.add(d);
        });
        const staffWorkingDays = staffDates.size;
 
        // ---- assemble payload -------------------------------------------
        const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
 
        // teacher -> subject names (best-effort; table/columns may vary)
        let subjByTeacher = {};
        try {
            const [tsRows] = await db.execute(
                `SELECT ts.teacher_id AS tid, s.name AS sname
                   FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id
                  WHERE s.institutionId = ?`, [instId]
            );
            tsRows.forEach(r => { (subjByTeacher[r.tid] = subjByTeacher[r.tid] || []).push(r.sname); });
        } catch (e) { /* leave subjects blank if schema differs */ }
 
        // students sheet (sorted by class label then roll) — full fields
        const studentsSheet = studentUsers.map(u => ({
            roll_no: u.roll_no, name: u.name, classLabel: labelOf(classOfStudent(u)), section: u.section,
            gender: u.gender, dob: _fmtDMY(u.dob), phone_no: u.phone_no, email: u.email, username: u.username,
            aadhar_no: u.aadhar_no, admission_no: u.admission_no, admission_date: _fmtDMY(u.admission_date),
            parent_name: u.parent_name, pen_no: u.pen_no, school_joined_date: _fmtDMY(u.school_joined_date),
            school_joined_grade: u.school_joined_grade, tc_number: u.tc_number, address: u.address, status: u.status
        })).sort((a, b) => (a.classLabel || '').localeCompare(b.classLabel || '') || _rollNum(a.roll_no) - _rollNum(b.roll_no));
 
        const staffSheet = staffUsers.map(u => ({
            name: u.name, role: u.role, gender: u.gender, dob: _fmtDMY(u.dob),
            phone_no: u.phone_no, email: u.email, username: u.username, aadhar_no: u.aadhar_no,
            joining_date: _fmtDMY(u.joining_date), experience: u.experience,
            prev_salary: u.prev_salary, present_salary: u.present_salary,
            subjects: (subjByTeacher[u.id] || []).join(', '), address: u.address, status: u.status
        })).sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.name || '').localeCompare(b.name || ''));
 
        // attendance — per student
        const attStudentsSheet = studentUsers
            .filter(u => stuAtt[u.id])
            .map(u => {
                const cid = classOfStudent(u);
                const wd = workingDaysOfClass(cid);
                const a = stuAtt[u.id] || { present: 0, absent: 0 };
                return {
                    classLabel: labelOf(cid), roll: u.roll_no, name: u.name,
                    workingDays: wd, present: a.present, absent: a.absent, pct: pct1(a.present, wd)
                };
            })
            .sort((a, b) => (a.classLabel || '').localeCompare(b.classLabel || '') || _rollNum(a.roll) - _rollNum(b.roll));
 
        // attendance — class summary
        const classAgg = {}; // cid -> {students, present, absent}
        studentUsers.forEach(u => {
            if (!stuAtt[u.id]) return;
            const cid = classOfStudent(u);
            const agg = (classAgg[cid] = classAgg[cid] || { students: 0, present: 0, absent: 0 });
            agg.students++; agg.present += stuAtt[u.id].present; agg.absent += stuAtt[u.id].absent;
        });
        const attClassSummary = Object.keys(classAgg).map(cid => {
            const wd = workingDaysOfClass(cid);
            const agg = classAgg[cid];
            return {
                classLabel: labelOf(cid), students: agg.students, workingDays: wd,
                present: agg.present, absent: agg.absent, pct: pct1(agg.present, wd * agg.students)
            };
        }).sort((a, b) => (a.classLabel || '').localeCompare(b.classLabel || ''));
 
        // attendance — staff
        const attStaffSheet = staffUsers
            .filter(u => staffAtt[u.id])
            .map(u => {
                const a = staffAtt[u.id];
                return {
                    name: u.name, role: u.role, workingDays: staffWorkingDays,
                    present: a.present, absent: a.absent, pct: pct1(a.present, staffWorkingDays)
                };
            })
            .sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.name || '').localeCompare(b.name || ''));
 
        // marks — one register per class
        const cmap = {}; // cid -> {students, exams, subjects, cells}
        mrows.forEach(r => {
            const cm = (cmap[r.class_id] = cmap[r.class_id] || { students: {}, exams: {}, subjects: {}, cells: {} });
            cm.students[r.student_id] = { id: r.student_id, name: r.student_name, roll: r.roll_no };
            cm.exams[r.exam_type_id] = { id: r.exam_type_id, name: r.exam_name, order: r.exam_order ?? 0 };
            cm.subjects[r.subject_id] = { id: r.subject_id, name: r.subject_name };
            (cm.cells[r.student_id] = cm.cells[r.student_id] || {})[`${r.exam_type_id}:${r.subject_id}`] = r.marks_obtained;
        });
        const marksClasses = Object.keys(cmap).map(cid => {
            const cm = cmap[cid];
            const exams = Object.values(cm.exams).sort((a, b) => (a.order - b.order) || a.id - b.id);
            const subjects = Object.values(cm.subjects).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            const studentList = Object.values(cm.students)
                .sort((a, b) => _rollNum(a.roll) - _rollNum(b.roll) || (a.name || '').localeCompare(b.name || ''));
            const rows = studentList.map(stu => {
                const cells = cm.cells[stu.id] || {};
                let total = 0, max = 0;
                exams.forEach(ex => subjects.forEach(sub => {
                    const v = cells[`${ex.id}:${sub.id}`];
                    if (v != null) total += Number(v);
                    const mx = maxFor(cid, ex.id, sub.id);
                    if (mx !== undefined) max += mx;
                }));
                return {
                    roll: stu.roll, name: stu.name, cells,
                    total: Math.round(total * 100) / 100,
                    pct: max > 0 ? Math.round((total / max) * 1000) / 10 : null
                };
            });
            return { label: labelOf(cid), exams, subjects, rows };
        }).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
 
        const payload = {
            inst, year,
            students: studentsSheet, staff: staffSheet,
            attendance: { classSummary: attClassSummary, students: attStudentsSheet, staff: attStaffSheet },
            marksClasses
        };
 
        const wb = _buildYearWorkbook(payload);
 
        const fileSafe = `${inst.name || 'institution'}_${year.name || 'year'}`
            .replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafe}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[year-export] FATAL:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
});



// =====================================================================
// === 8. CLASSES ======================================================
// =====================================================================
app.post('/api/admin/classes', async (req, res) => {
    const institutionId = req.auth.institutionId;          // TENANT: from token
    const { className, section } = req.body;
    try {
        await db.execute('INSERT INTO classes (className, section, institutionId) VALUES (?, ?, ?)', [className, section || null, institutionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.post('/api/admin/classes/bulk', async (req, res) => {
    const institutionId = req.auth.institutionId;          // TENANT: from token
    const { className, sections } = req.body;
    if (!className || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ error: 'className and a non-empty sections array are required.' });
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
        const [own] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [id]);
        if (own.length === 0) return res.status(404).json({ error: 'Class not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
 
        await db.execute('UPDATE classes SET className=?, section=? WHERE id=?', [className, section || null, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.delete('/api/admin/classes/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
 
        await db.execute('DELETE FROM classes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 9. STUDENT PROMOTION ============================================
// =====================================================================
app.post('/api/admin/promote', async (req, res) => {
    const instId = req.auth.institutionId;
    const { studentIds, targetClassId, targetSection } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ error: 'No students supplied' });
    try {
        const [cls] = await db.execute('SELECT id FROM classes WHERE id = ? AND institutionId = ?', [targetClassId, instId]);
        if (cls.length === 0) return res.status(403).json({ error: 'That class is not in your institution.' });
 
        const placeholders = studentIds.map(() => '?').join(',');
        const [r] = await db.execute(
            `UPDATE users SET class_id = ?, section = ? WHERE id IN (${placeholders}) AND institutionId = ?`,
            [targetClassId, targetSection || null, ...studentIds, instId]
        );
        res.json({ success: true, moved: r.affectedRows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 10. HEALTH CHECK ================================================
// =====================================================================
app.get('/', (req, res) => res.json({ status: 'ok', service: 'SmartEdz ERP', time: new Date().toISOString() }));




// =====================================================================
// === 11. TIMETABLE ===================================================
//
//   REPLACE your whole Section 11 block with this. Notifications added:
//     • entries/bulk          (class timetable saved) -> notify that
//                              class's active students.
//     • teacher-entries/bulk  (admin assigns a teacher) -> notify the
//                              teacher AND the students of every class
//                              the teacher was assigned to.
//   The single-cell `entry` route intentionally does NOT notify, so a
//   student isn't pinged on every cell change while a grid is built —
//   the bulk save is the "timetable updated" moment. Everything else is
//   unchanged.
//
//   Uses createNotifications / studentIdsForClass from Section 25.
//   'Timetable' is the module id from Screens/Modules.js. Each notify is
//   wrapped so it can never fail the underlying save.
// =====================================================================
async function resolveYearId(instId, requestedYearId) {
    if (requestedYearId) return parseInt(requestedYearId, 10);
    const [rows] = await db.execute('SELECT id FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
    return rows[0]?.id || null;
}

app.get('/api/admin/timetable/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
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

// ---------------------------------------------------------------------
//  11.b  PERSONAL TIMETABLE  ->  GET /api/timetable/my/:userId
// ---------------------------------------------------------------------
app.get('/api/timetable/my/:userId', async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, name, role, class_id, section, institutionId FROM users WHERE id = ? LIMIT 1',
            [req.params.userId]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found.' });
        const me = users[0];
        if (!sameTenant(req, me.institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });

        const role = (me.role || '').toLowerCase();
        const mode = role.includes('teacher') ? 'teacher' : 'student';

        const yearId = await resolveYearId(me.institutionId, req.query.yearId);
        if (!yearId) {
            return res.json({ mode, academic_year_id: null, days: [], periods: [], entries: [], class_label: null });
        }

        const [days]    = await db.execute('SELECT * FROM timetable_days WHERE institutionId = ? AND academic_year_id = ? ORDER BY day_index', [me.institutionId, yearId]);
        const [periods] = await db.execute('SELECT * FROM timetable_periods WHERE institutionId = ? AND academic_year_id = ? ORDER BY period_index', [me.institutionId, yearId]);

        let entries = [];
        let class_label = null;

        if (mode === 'teacher') {
            const [rows] = await db.execute(
                `SELECT e.day_id, e.period_id, e.room_no, e.class_id, e.subject_id,
                        c.className, c.section,
                        s.name AS subject_name
                   FROM timetable_entries e
                   LEFT JOIN classes  c ON c.id = e.class_id
                   LEFT JOIN subjects s ON s.id = e.subject_id
                  WHERE e.institutionId = ? AND e.academic_year_id = ? AND e.teacher_id = ?`,
                [me.institutionId, yearId, me.id]
            );
            entries = rows;
        } else {
            if (me.class_id) {
                const [crows] = await db.execute('SELECT className, section FROM classes WHERE id = ? LIMIT 1', [me.class_id]);
                if (crows.length) {
                    class_label = `${crows[0].className}${crows[0].section ? ' - ' + crows[0].section : ''}`;
                }
                const [rows] = await db.execute(
                    `SELECT e.day_id, e.period_id, e.room_no, e.subject_id, e.teacher_id,
                            s.name AS subject_name,
                            t.name AS teacher_name
                       FROM timetable_entries e
                       LEFT JOIN subjects s ON s.id = e.subject_id
                       LEFT JOIN users    t ON t.id = e.teacher_id
                      WHERE e.institutionId = ? AND e.academic_year_id = ? AND e.class_id = ?`,
                    [me.institutionId, yearId, me.class_id]
                );
                entries = rows;
            }
        }

        res.json({ mode, academic_year_id: yearId, days, periods, entries, class_label });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/timetable/days', async (req, res) => {
    const { days } = req.body;
    const institutionId = req.auth.institutionId;
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
    const { periods } = req.body;
    const institutionId = req.auth.institutionId;
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

// Single-cell upsert/clear. Intentionally does NOT notify (too granular —
// students would be pinged on every cell change). The bulk save below is
// the "timetable updated" notify point.
app.post('/api/admin/timetable/entry', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const { class_id, day_id, period_id, subject_id, teacher_id, room_no } = req.body;
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) return res.status(400).json({ error: 'No academic year. Create one first.' });
        if (!subject_id && !teacher_id && !room_no) {
            await db.execute(
                'DELETE FROM timetable_entries WHERE class_id = ? AND day_id = ? AND period_id = ? AND institutionId = ?',
                [class_id, day_id, period_id, institutionId]);
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
    const institutionId = req.auth.institutionId;
    const { class_id, entries } = req.body;
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');
        await conn.beginTransaction();
        await conn.execute('DELETE FROM timetable_entries WHERE class_id = ? AND academic_year_id = ? AND institutionId = ?', [class_id, yearId, institutionId]);
        for (const e of entries) {
            if (!e.subject_id && !e.teacher_id && !e.room_no) continue;
            await conn.execute(
                `INSERT INTO timetable_entries (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [institutionId, yearId, class_id, e.day_id, e.period_id, e.subject_id || null, e.teacher_id || null, e.room_no || null]);
        }
        await conn.commit();
        try {
            const recipients = await studentIdsForClass(class_id);
            await createNotifications({
                institutionId, recipientIds: recipients, type: 'timetable',
                title: 'Timetable updated', body: 'Your class timetable has been updated.',
                link: 'timetable', entity_id: class_id, actor_id: req.auth.userId
            });
        } catch (e) { console.warn('[notify timetable class]', e.message); }
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// ---------------------------------------------------------------------
//  11.c  TEACHER TIMETABLE SAVE  ->  POST /api/admin/timetable/teacher-entries/bulk
// ---------------------------------------------------------------------
app.post('/api/admin/timetable/teacher-entries/bulk', async (req, res) => {
    const { teacher_id, entries } = req.body;
    const institutionId = req.auth.institutionId;
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required.' });

    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No academic year. Create one first.');

        const list = Array.isArray(entries)
            ? entries.filter(e => e.class_id && e.day_id && e.period_id)
            : [];

        // Rule 1 — no double-booking of the teacher within the submitted set.
        const seenSlots = new Set();
        for (const e of list) {
            const slot = `${e.day_id}-${e.period_id}`;
            if (seenSlots.has(slot)) {
                return res.status(409).json({
                    error: 'This teacher is assigned to two classes in the same period. Please fix the clash and try again.'
                });
            }
            seenSlots.add(slot);
        }

        await conn.beginTransaction();

        await conn.execute(
            'UPDATE timetable_entries SET teacher_id = NULL WHERE institutionId = ? AND academic_year_id = ? AND teacher_id = ?',
            [institutionId, yearId, teacher_id]
        );
        await conn.execute(
            `DELETE FROM timetable_entries
              WHERE institutionId = ? AND academic_year_id = ?
                AND teacher_id IS NULL AND subject_id IS NULL AND (room_no IS NULL OR room_no = '')`,
            [institutionId, yearId]
        );

        // Rule 2 — target class period already taken by another teacher?
        const conflicts = [];
        for (const e of list) {
            const [rows] = await conn.execute(
                `SELECT te.teacher_id, u.name AS teacher_name, s.name AS subject_name
                   FROM timetable_entries te
                   LEFT JOIN users    u ON u.id = te.teacher_id
                   LEFT JOIN subjects s ON s.id = te.subject_id
                  WHERE te.institutionId = ? AND te.academic_year_id = ?
                    AND te.class_id = ? AND te.day_id = ? AND te.period_id = ?`,
                [institutionId, yearId, e.class_id, e.day_id, e.period_id]
            );
            const occ = rows[0];
            if (occ && occ.teacher_id && String(occ.teacher_id) !== String(teacher_id)) {
                conflicts.push({
                    class_id: e.class_id, day_id: e.day_id, period_id: e.period_id,
                    teacher_name: occ.teacher_name, subject_name: occ.subject_name
                });
            }
        }
        if (conflicts.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                error: 'Some periods are already assigned to another teacher.',
                conflicts
            });
        }

        for (const e of list) {
            await conn.execute(
                `INSERT INTO timetable_entries (institutionId, academic_year_id, class_id, day_id, period_id, subject_id, teacher_id, room_no)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id), teacher_id = VALUES(teacher_id), room_no = VALUES(room_no)`,
                [institutionId, yearId, e.class_id, e.day_id, e.period_id, e.subject_id || null, teacher_id, e.room_no || null]
            );
        }

        await conn.commit();

        // 🔔 Notify the assigned teacher, then the students of every class
        //    this teacher was just assigned to. Each wrapped so a notify
        //    issue can't fail the save.
        try {
            await createNotifications({
                institutionId, recipientIds: [teacher_id], type: 'timetable',
                title: 'Timetable updated',
                body: 'Your teaching timetable has been updated.',
                link: 'timetable', entity_id: teacher_id, actor_id: req.body.actor_id
            });
        } catch (e) { console.warn('[notify timetable teacher]', e.message); }

        try {
            const classIds = [...new Set(list.map(e => e.class_id).filter(Boolean))];
            let studentRecipients = [];
            for (const cid of classIds) {
                const ids = await studentIdsForClass(cid);
                studentRecipients = studentRecipients.concat(ids);
            }
            studentRecipients = [...new Set(studentRecipients)];
            if (studentRecipients.length) {
                await createNotifications({
                    institutionId, recipientIds: studentRecipients, type: 'timetable',
                    title: 'Timetable updated',
                    body: 'A teacher has been assigned to your class timetable.',
                    link: 'timetable', entity_id: null, actor_id: req.body.actor_id
                });
            }
        } catch (e) { console.warn('[notify timetable teacher-class]', e.message); }

        res.json({ success: true, saved: list.length });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});



// =====================================================================
// === 12. SUBJECTS ====================================================
// =====================================================================
app.post('/api/admin/subjects', async (req, res) => {
    const { name, class_ids } = req.body;
    const institutionId = req.auth.institutionId;
    // 👇 === BOUNCER FOR CREATION === 👇
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Subject name is required.' });
    }
    if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID is required.' });
    }
    // 👆 ============================ 👆
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
        const [own] = await conn.execute('SELECT institutionId FROM subjects WHERE id = ?', [subjectId]);
        if (own.length === 0) return res.status(404).json({ error: 'Subject not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This subject belongs to another institution.' });
 
        await conn.beginTransaction();
        await conn.execute('UPDATE subjects SET name = ? WHERE id = ?', [name, subjectId]);
        if (Array.isArray(class_ids)) {
            await conn.execute('DELETE FROM subject_classes WHERE subject_id = ?', [subjectId]);
            for (const cid of class_ids) {
                if (!cid) continue;
                await conn.execute('INSERT IGNORE INTO subject_classes (subject_id, class_id) VALUES (?, ?)', [subjectId, parseInt(cid, 10)]);
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
        const [own] = await db.execute('SELECT institutionId FROM subjects WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This subject belongs to another institution.' });
        await db.execute('DELETE FROM subjects WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 13. ACADEMIC CALENDAR ===========================================
// =====================================================================
app.get('/api/admin/calendar/:instId', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const [rows] = await db.execute('SELECT * FROM calendar_events WHERE institutionId = ? ORDER BY event_date ASC', [instId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/calendar', async (req, res) => {
    const { name, event_date, time, description, type, adminId } = req.body;
    const institutionId = req.auth.institutionId;
    try {
        await db.execute('INSERT INTO calendar_events (institutionId, name, event_date, time, description, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [institutionId, name, event_date, time || null, description || null, type, adminId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/calendar/:id', async (req, res) => {
    const { name, event_date, time, description, type } = req.body;
    try {
        const [own] = await db.execute('SELECT institutionId FROM calendar_events WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Event not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This event belongs to another institution.' });
        await db.execute('UPDATE calendar_events SET name=?, event_date=?, time=?, description=?, type=? WHERE id=?',
            [name, event_date, time || null, description || null, type, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/calendar/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM calendar_events WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This event belongs to another institution.' });
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
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile/:id', async (req, res) => {
    const { id } = req.params;
    if (String(id) !== String(req.auth.userId)) return res.status(403).json({ error: 'You can only edit your own profile.' });
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
//   Status codes: P (Present), A (Absent).
//
//   REPLACE your whole Section 15 block with this. Only 15.2 (bulk mark)
//   changed: each user is notified when their attendance is marked. To
//   avoid spamming on every re-save, a user is notified ONLY when their
//   row is newly created for that date OR their status actually changes.
//   Present and absent both notify, with a matching message.
//
//   Uses createNotifications from Section 25. 'Attendance' is the module
//   id from Screens/Modules.js. The notify is wrapped so it can never
//   fail the marking. The marker (actor_id) is excluded automatically.
//
//   >> Want ABSENT-ONLY notifications? Delete the `presentIds` block in
//      15.2 (clearly marked) — that's the only change needed.
//
//   (Migrations unchanged — Late removed, academic_year_id added.)
// =====================================================================

// --- 15.1 Roster for marking ---------------------------------------
app.get('/api/admin/attendance/roster/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { category = 'students', date, class_id } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
 
    try {
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        let where = 'u.institutionId = ?';
        const params = [parseInt(instId, 10)];
 
        if (category === 'students') {
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
        where += " AND (u.status IS NULL OR LOWER(TRIM(u.status)) = 'active')";
 
        const userSql = `
            SELECT u.id, u.name, u.username, u.role, u.profile_pic,
                   u.roll_no, u.class_id, u.section, u.status
              FROM users u
             WHERE ${where}
             ORDER BY u.name`;
 
        const [users] = await db.execute(userSql, params);
 
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
                     WHERE a.user_id IN (${placeholders})
                       AND a.attendance_date = ?
                       AND a.academic_year_id = ?`;
                const [att] = await db.execute(attSql, [...ids, targetDate, yearId]);
                att.forEach(r => { attMap[r.user_id] = r; });
            } catch (attErr) {
                console.warn('[attendance roster] attendance lookup failed:', attErr.message);
                attendanceWarning = attErr.message;
            }
        }
 
        const merged = users.map(u => ({ ...u, ...(attMap[u.id] || {}) }));
 
        console.log(`[attendance roster] inst=${instId} year=${yearId} category=${category} class_id=${class_id || '—'} date=${targetDate} → ${merged.length} users`);
 
        res.json({
            date: targetDate,
            academic_year_id: yearId,
            users: merged,
            count: merged.length,
            warning: attendanceWarning
        });
    } catch (err) {
        console.error('[attendance roster] FATAL:', err);
        res.status(500).json({ error: err.message, users: [] });
    }
});



// --- 15.2 Bulk mark / update attendance (+ notify marked users) -----
//   POST /api/admin/attendance/mark
//   Body: { institutionId, date, actor_id, entries: [{user_id, status}] }
//   status must be 'P' or 'A'. Upserts each row.
app.post('/api/admin/attendance/mark', async (req, res) => {
    const { date, entries } = req.body;
    const institutionId = req.auth.institutionId;   // from token
    const actor_id = req.auth.userId;               // marker = the logged-in user
               if (!date || !Array.isArray(entries)) {
                   return res.status(400).json({ error: 'date and entries[] are required.' });
             }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No active academic year. Create/activate one under Academics first.');

        // Collect users to notify — only those NEWLY marked or whose status
        // actually changed, so re-saving the roster doesn't re-ping everyone.
        const presentIds = [];
        const absentIds = [];

        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.user_id || !['P', 'A'].includes(e.status)) continue;

            // Does a row already exist for this user/date in this year?
            const [exists] = await conn.execute(
                'SELECT id, status FROM attendance WHERE user_id = ? AND attendance_date = ? AND academic_year_id = ?',
                [e.user_id, date, yearId]
            );

            if (exists.length === 0) {
                // First time this user gets attendance for this date
                await conn.execute(
                    `INSERT INTO attendance
                       (institutionId, academic_year_id, user_id, attendance_date, status, marked_by, marked_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [institutionId, yearId, e.user_id, date, e.status, actor_id, now]
                );
                (e.status === 'A' ? absentIds : presentIds).push(e.user_id);
            } else {
                // Row exists — record the edit, and flag for notify only if
                // the status actually changed.
                const changed = exists[0].status !== e.status;
                await conn.execute(
                    `UPDATE attendance
                        SET status = ?, updated_by = ?, updated_at = ?
                      WHERE user_id = ? AND attendance_date = ? AND academic_year_id = ?`,
                    [e.status, actor_id, now, e.user_id, date, yearId]
                );
                if (changed) (e.status === 'A' ? absentIds : presentIds).push(e.user_id);
            }
        }
        await conn.commit();

        // 🔔 Notify the marked users. Grouped by status (≤2 calls). Wrapped
        //    so a notify issue can't fail the marking; actor is excluded.
        try {
            if (absentIds.length) {
                await createNotifications({
                    institutionId, recipientIds: absentIds, type: 'attendance',
                    title: 'Marked absent',
                    body: `You were marked absent on ${date}.`,
                    link: 'attendance', entity_id: null, actor_id
                });
            }
            // --- ABSENT-ONLY? Delete from here ... ---
            if (presentIds.length) {
                await createNotifications({
                    institutionId, recipientIds: presentIds, type: 'attendance',
                    title: 'Attendance marked',
                    body: `You were marked present on ${date}.`,
                    link: 'attendance', entity_id: null, actor_id
                });
            }
            // --- ... to here, to stop notifying on Present. ---
        } catch (e) { console.warn('[notify attendance]', e.message); }

        res.json({ success: true, count: entries.length, academic_year_id: yearId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// --- 15.3 History for one user -------------------------------------
app.get('/api/admin/attendance/history/:userId', async (req, res) => {
    const { userId } = req.params;
    const { from, to } = req.query;
    try {
        const [uRows] = await db.execute('SELECT institutionId FROM users WHERE id = ? LIMIT 1', [userId]);
        const instId = uRows[0]?.institutionId;
        if (!uRows.length || !sameTenant(req, instId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        let where = 'a.user_id = ? AND a.academic_year_id = ?';
        const params = [userId, yearId];
        if (from && to) {
            where += ' AND a.attendance_date BETWEEN ? AND ?';
            params.push(from, to);
        }

        const [rows] = await db.execute(
            `SELECT a.id, DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date, a.status,
                    a.marked_by, a.marked_at, a.updated_by, a.updated_at,
                    mb.name AS marked_by_name, mb.role AS marked_by_role,
                    ub.name AS updated_by_name, ub.role AS updated_by_role
               FROM attendance a
               LEFT JOIN users mb ON mb.id = a.marked_by
               LEFT JOIN users ub ON ub.id = a.updated_by
              WHERE ${where}
              ORDER BY a.attendance_date DESC`,
            params
        );
        const summary = {
            total:   rows.length,
            present: rows.filter(r => r.status === 'P').length,
            absent:  rows.filter(r => r.status === 'A').length
        };
        summary.percentage = summary.total > 0
            ? ((summary.present / summary.total) * 100).toFixed(1)
            : '0.0';
        res.json({ academic_year_id: yearId, rows, summary });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 15.4 Teacher's marking scope ----------------------------------
app.get('/api/admin/attendance/teacher-classes/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [t] = await db.execute('SELECT institutionId FROM users WHERE id = ? LIMIT 1', [teacherId]);
        if (t.length === 0) return res.json([]);
        if (!sameTenant(req, t[0].institutionId)) return res.status(403).json({ error: 'This teacher belongs to another institution.' });
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


// --- 15.5 Category overview + analysis series ----------------------
app.get('/api/admin/attendance/overview/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { category = 'students', from, to, class_id } = req.query;

    try {
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        let where = 'u.institutionId = ?';
        const params = [parseInt(instId, 10)];
        if (category === 'students') {
            where += " AND LOWER(TRIM(u.role)) = 'student'";
            if (class_id) { where += ' AND u.class_id = ?'; params.push(parseInt(class_id, 10)); }
        } else if (category === 'teachers') {
            where += " AND LOWER(TRIM(u.role)) LIKE '%teacher%'";
        } else if (category === 'other') {
            where += " AND LOWER(TRIM(u.role)) NOT LIKE '%teacher%' "
                  +  " AND LOWER(TRIM(u.role)) NOT IN ('student','super admin','developer')";
        }
        where += " AND (u.status IS NULL OR LOWER(TRIM(u.status)) = 'active')";

        const [users] = await db.execute(`SELECT u.id FROM users u WHERE ${where}`, params);
        const userCount = users.length;

        const empty = {
            from, to, category, academic_year_id: yearId, user_count: userCount,
            working_days: 0, present: 0, absent: 0, total_marks: 0,
            avg_percentage: '0.0', series: [], per_user: []
        };
        if (userCount === 0) return res.json(empty);

        const ids = users.map(u => u.id);
        const ph = ids.map(() => '?').join(',');

        let attWhere = `user_id IN (${ph}) AND academic_year_id = ?`;
        const attParams = [...ids, yearId];
        if (from && to) {
            attWhere += ' AND attendance_date BETWEEN ? AND ?';
            attParams.push(from, to);
        }

        try {
            const [wd] = await db.execute(
                `SELECT COUNT(DISTINCT attendance_date) AS d
                   FROM attendance
                  WHERE ${attWhere}`,
                attParams
            );
            const working_days = Number(wd[0]?.d || 0);

            const [tot] = await db.execute(
                `SELECT SUM(status = 'P') AS p, SUM(status = 'A') AS a, COUNT(*) AS t
                   FROM attendance
                  WHERE ${attWhere}`,
                attParams
            );
            const present = Number(tot[0]?.p || 0);
            const absent  = Number(tot[0]?.a || 0);
            const total_marks = Number(tot[0]?.t || 0);

            const [ser] = await db.execute(
                `SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date,
                        SUM(status = 'P') AS present, SUM(status = 'A') AS absent,
                        COUNT(*) AS total
                   FROM attendance
                  WHERE ${attWhere}
                  GROUP BY attendance_date
                  ORDER BY attendance_date`,
                attParams
            );
            const series = ser.map(r => ({
                date: r.date,
                present: Number(r.present), absent: Number(r.absent),
                total: Number(r.total)
            }));

            const [pu] = await db.execute(
                `SELECT user_id,
                        SUM(status = 'P') AS present,
                        SUM(status = 'A') AS absent, COUNT(*) AS total
                   FROM attendance
                  WHERE ${attWhere}
                  GROUP BY user_id`,
                attParams
            );
            const per_user = pu.map(r => ({
                user_id: r.user_id,
                present: Number(r.present),
                absent: Number(r.absent), total: Number(r.total)
            }));

            const avg_percentage = total_marks > 0
                ? ((present / total_marks) * 100).toFixed(1)
                : '0.0';

            res.json({
                from, to, category, academic_year_id: yearId, user_count: userCount,
                working_days, present, absent, total_marks,
                avg_percentage, series, per_user
            });
        } catch (attErr) {
            console.warn('[attendance overview] lookup failed:', attErr.message);
            res.json({ ...empty, warning: attErr.message });
        }
    } catch (err) {
        console.error('[attendance overview] FATAL:', err);
        res.status(500).json({ error: err.message });
    }
});

// === 30.A ATTENDANCE EXPORT (per-module download) ====================

app.get('/api/admin/attendance-export/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const ExcelJS = require('exceljs');
 
        const BRAND = 'FF3284C7';
        const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = (v) => (v instanceof Date) ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
        const rollNum = (r) => { const n = parseInt(r, 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; };
 
        // ---- scope ----
        const scope = (req.query.scope || 'all').toString();
        const isClassScope = scope.startsWith('class:');
        const specificClass = isClassScope ? parseInt(scope.slice(6), 10) : null;
        const includeStudents = scope === 'all' || scope === 'students' || isClassScope;
        const includeTeachers = scope === 'all' || scope === 'teachers';
        const includeOther = scope === 'all' || scope === 'other';
 
        // ---- year ----
        let year;
        if (req.query.yearId) {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE id = ? AND institutionId = ?', [req.query.yearId, instId]);
            if (yr.length === 0) return res.status(404).json({ error: 'Academic year not found for this institution.' });
            year = yr[0];
        } else {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
            if (yr.length === 0) return res.status(400).json({ error: 'No active academic year to export.' });
            year = yr[0];
        }
        const yearId = year.id;
        const yLabel = year.name || '';
 
        const [instRows] = await db.execute('SELECT id, name FROM institutions WHERE id = ?', [instId]);
        const inst = instRows[0] || { name: 'Institution' };
 
        const [classes] = await db.execute('SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const classById = {}; classes.forEach(c => { classById[c.id] = c; });
        const labelOf = (cid) => { const c = classById[cid]; return c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : 'Unassigned'; };
 
        const [users] = await db.execute('SELECT id, name, role, roll_no, class_id FROM users WHERE institutionId = ?', [instId]);
        const userById = {}; users.forEach(u => { userById[u.id] = u; });
        const roleLc = (u) => (u.role || '').toLowerCase().trim();
        const isStudent = (u) => roleLc(u) === 'student';
        const isTeacher = (u) => roleLc(u).includes('teacher');
        const isAdmin = (u) => ['super admin', 'developer', 'group admin'].includes(roleLc(u));
 
        // Historical class (correct grouping for an old year); else current.
        const [hc] = await db.execute('SELECT DISTINCT student_id, class_id FROM student_marks WHERE institutionId = ? AND academic_year_id = ?', [instId, yearId]);
        const histClass = {}; hc.forEach(r => { if (histClass[r.student_id] == null) histClass[r.student_id] = r.class_id; });
        const classOf = (u) => (histClass[u.id] != null ? histClass[u.id] : u.class_id);
 
        // All attendance for the year, in one pass -> perUser[uid].months[YYYY-MM] = {p, t}
        const [att] = await db.execute('SELECT user_id, attendance_date, status FROM attendance WHERE institutionId = ? AND academic_year_id = ?', [instId, yearId]);
        const perUser = {};
        att.forEach(rw => {
            const mk = dateStr(rw.attendance_date).slice(0, 7);
            const pu = (perUser[rw.user_id] = perUser[rw.user_id] || { months: {} });
            const mm = (pu.months[mk] = pu.months[mk] || { p: 0, t: 0 });
            mm.t++; if (rw.status === 'P') mm.p++;
        });
 
        // Month columns from the academic year span; else from data range.
        const buildMonths = (start, end) => {
            const out = []; let d = new Date(start.getFullYear(), start.getMonth(), 1);
            const last = new Date(end.getFullYear(), end.getMonth(), 1); let g = 0;
            while (d <= last && g < 24) {
                const y = d.getFullYear(), m = d.getMonth();
                out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MON[m]}-${String(y).slice(2)}` });
                d.setMonth(d.getMonth() + 1); g++;
            }
            return out;
        };
        let start, end;
        if (year.startDate && year.endDate) { start = new Date(year.startDate); end = new Date(year.endDate); }
        else {
            const keys = [...new Set(att.map(a => dateStr(a.attendance_date).slice(0, 7)))].sort();
            if (keys.length) { start = new Date(keys[0] + '-01'); end = new Date(keys[keys.length - 1] + '-01'); }
            else { start = new Date(); end = new Date(); }
        }
        const months = buildMonths(start, end);
        const totalCols = 2 + months.length + 2; // id, name, months, Total, %
 
        // group rosters
        const studentsByClass = {};
        users.filter(isStudent).forEach(u => { const cid = classOf(u); (studentsByClass[cid] = studentsByClass[cid] || []).push(u); });
        Object.values(studentsByClass).forEach(list => list.sort((a, b) => rollNum(a.roll_no) - rollNum(b.roll_no) || (a.name || '').localeCompare(b.name || '')));
        const teacherUsers = users.filter(isTeacher).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const otherUsers = users.filter(u => !isStudent(u) && !isTeacher(u) && !isAdmin(u)).sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.name || '').localeCompare(b.name || ''));
 
        // ---- workbook ----
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz'; wb.created = new Date();
        const ws = wb.addWorksheet('Attendance Register');
        let r = 1;
 
        ws.mergeCells(r, 1, r, totalCols);
        const tt = ws.getCell(r, 1); tt.value = inst.name || 'Institution'; tt.font = { bold: true, size: 14, color: { argb: 'FF111827' } }; r++;
        ws.mergeCells(r, 1, r, totalCols);
        const sub = ws.getCell(r, 1); sub.value = `Attendance Register · ${yLabel}   (each cell = present / days marked)`; sub.font = { size: 10, color: { argb: 'FF6B7280' } }; r++;
        r++;
 
        const sectionHeading = (text) => {
            ws.mergeCells(r, 1, r, totalCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            c.alignment = { vertical: 'middle' }; ws.getRow(r).height = 20; r++;
        };
        const subHeading = (text) => {
            ws.mergeCells(r, 1, r, totalCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } }; r++;
        };
        const headerRow = (firstCol) => {
            const heads = [firstCol, 'Name', ...months.map(m => m.label), 'Total', '%'];
            const row = ws.getRow(r);
            heads.forEach((h, i) => {
                const c = row.getCell(i + 1); c.value = h;
                c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
                c.alignment = { vertical: 'middle', horizontal: (i < 2 ? 'left' : 'center'), wrapText: true };
            });
            row.height = 16; r++;
        };
        const dataRow = (idLabel, name, pu) => {
            const row = ws.getRow(r);
            const c1 = row.getCell(1); c1.value = idLabel; c1.alignment = { horizontal: 'left' };
            const c2 = row.getCell(2); c2.value = name; c2.alignment = { horizontal: 'left' };
            let tp = 0, tt2 = 0;
            months.forEach((m, i) => {
                const cell = row.getCell(3 + i);
                const d = pu && pu.months[m.key];
                if (d) { tp += d.p; tt2 += d.t; cell.value = `${d.p}/${d.t}`; } else cell.value = '—';
                cell.alignment = { horizontal: 'center' };
            });
            const totCell = row.getCell(2 + months.length + 1);
            totCell.value = tt2 > 0 ? `${tp}/${tt2}` : '—'; totCell.alignment = { horizontal: 'center' };
            const pctCell = row.getCell(2 + months.length + 2);
            const pct = tt2 > 0 ? Math.round((tp / tt2) * 1000) / 10 : null;
            pctCell.value = pct != null ? `${pct}%` : '—'; pctCell.alignment = { horizontal: 'center' };
            pctCell.font = { bold: true, size: 9, color: { argb: pct == null ? 'FF9CA3AF' : (pct >= 80 ? 'FF059669' : pct >= 50 ? 'FF2563EB' : 'FFDC2626') } };
            for (let i = 1; i <= totalCols; i++) { const c = row.getCell(i); if (!c.font) c.font = { size: 9, color: { argb: 'FF374151' } }; }
            r++;
        };
 
        if (includeStudents) {
            sectionHeading('STUDENTS');
            const cids = (specificClass != null ? [specificClass] : Object.keys(studentsByClass).map(Number))
                .filter(cid => studentsByClass[cid] && studentsByClass[cid].length)
                .sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { numeric: true }));
            if (cids.length === 0) { subHeading('No students found for this selection'); }
            cids.forEach(cid => {
                subHeading(labelOf(cid));
                headerRow('Roll');
                studentsByClass[cid].forEach(u => dataRow(u.roll_no || '—', u.name, perUser[u.id]));
                r++;
            });
        }
 
        if (includeTeachers) {
            sectionHeading('TEACHERS');
            headerRow('S.No');
            if (teacherUsers.length === 0) { const row = ws.getRow(r); row.getCell(2).value = 'No teachers found'; r++; }
            teacherUsers.forEach((u, i) => dataRow(String(i + 1), u.name, perUser[u.id]));
            r++;
        }
 
        if (includeOther) {
            sectionHeading('OTHER STAFF');
            headerRow('S.No');
            if (otherUsers.length === 0) { const row = ws.getRow(r); row.getCell(2).value = 'No other staff found'; r++; }
            otherUsers.forEach((u, i) => dataRow(String(i + 1), u.name, perUser[u.id]));
            r++;
        }
 
        // widths + freeze
        ws.getColumn(1).width = 8; ws.getColumn(2).width = 26;
        months.forEach((m, i) => { ws.getColumn(3 + i).width = 9; });
        ws.getColumn(2 + months.length + 1).width = 11;
        ws.getColumn(2 + months.length + 2).width = 8;
        ws.views = [{ state: 'frozen', xSplit: 2 }];
 
        const scopeTag = isClassScope ? `Class_${labelOf(specificClass)}` : scope.charAt(0).toUpperCase() + scope.slice(1);
        const fileSafe = `${inst.name || 'institution'}_Attendance_${scopeTag}_${year.name || 'year'}`
            .replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafe}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[attendance-export] FATAL:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
});



// =====================================================================
// === 16. EXAMS & EXAM SCHEDULES =======================================
//
//   REPLACE your whole Section 16 block with this. Notifications:
//     • 16.A.4 create exam schedule  -> notify the class/section students
//     • 16.A.5 EDIT exam schedule    -> re-notify them (date may change)
//     • 16.B.4 create online exam    -> notify them (only if published)
//     • 16.B.4 EDIT online exam      -> re-notify them (only if published)
//     • 16.C.6 grade an attempt      -> notify that ONE student (result)
//   Everything else (listing, attempts, auto-grade) is unchanged.
//
//   NO ACADEMIC-YEAR SCOPING. Exams & schedules are plain per-institution
//   records — they are NOT tied to the active academic year and there is
//   no resolveYearId() call anywhere here. The academic_year_id columns
//   in exam_schedules / online_exams are left nullable and unused; you can
//   keep or drop them, they no longer affect any query.
//
//   Uses createNotifications from Section 25. 'Exams' is the module id
//   from Screens/Modules.js — adjust the link string if your Exams tab
//   uses a different id. The 'result' type already exists in your
//   NotificationsScreen; 'exam' is new (icon added in the updated screen).
//
//   Two related features:
//     • exam_schedules: printable exam timetables (date/subject/time/room)
//     • online_exams:   actual assessments students attempt in-browser
//
//   ASSIGNED TEACHER: online_exams now carries a teacher_id (assigned
//   teacher, distinct from created_by). Run exams_add_teacher.sql once:
//     ALTER TABLE online_exams
//       ADD COLUMN teacher_id INT DEFAULT NULL AFTER subject_id,
//       ADD KEY idx_exam_teacher (teacher_id),
//       ADD CONSTRAINT fk_exam_teacher FOREIGN KEY (teacher_id)
//           REFERENCES users(id) ON DELETE SET NULL;
//   exam_schedules have no subject/teacher, so they only surface the
//   creator (created_by_name) — no teacher_id there.
//
//   TENANT SCOPING (same rules as the Homework backend): institutionId
//   and the actor (created_by / actor_id) always come from req.auth —
//   never trusted from the body. Every ownership check uses sameTenant().
//   Create/update additionally verify the targeted class belongs to your
//   institution before writing.
//
//   Both list/detail queries surface created_by (name), teacher (name)
//   and created_at so the UI can show the assigned teacher, "by <creator>"
//   and creation time (IST rendered client-side).
// =====================================================================

// Helper — does a JSON column have content? schedule_data comes back as
// a string or already-parsed array depending on MySQL version/driver.
const parseJsonSafe = (val, fallback = []) => {
    if (val === null || val === undefined) return fallback;
    if (Array.isArray(val) || typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const nowSQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// Which students an exam / schedule targets:
//   class_id NULL -> all active students in the institution (schedules)
//   class_id set  -> that class's active students (optionally one section)
async function examRecipientIds(institutionId, classId, section) {
    if (!institutionId) return [];
    let sql = `SELECT id FROM users
                WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
                  AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`;
    const params = [institutionId];
    if (classId) { sql += ' AND class_id = ?'; params.push(classId); }
    if (section) { sql += ' AND section = ?'; params.push(section); }
    const [rows] = await db.execute(sql, params);
    return rows.map(r => r.id);
}


// =====================================================================
// === 16.A  EXAM SCHEDULES  (TENANT-SCOPED, academic-year removed) =====
//
//   • Every route takes the institution from the JWT (req.auth) — never
//     from the URL — so one school can't see another's schedules. This
//     fixes the leak where other schools' exam schedules were showing.
//     (A Developer may pass an explicit :instId to view a chosen school.)
//   • academic_year_id is no longer written or read. The column stays in
//     the table (nullable), so NO migration is needed — new rows just
//     leave it NULL and existing rows are ignored.
//   • List responses carry created_at + created_by_name so the UI can
//     show the creation time and the creator/teacher name.
//
//   Reuses: sameTenant() (Part 1), parseJsonSafe(), examRecipientIds()
//   and createNotifications() (already in your backend).
// =====================================================================

// --- 16.A.1  POST /api/admin/exam-schedules  (create) ----------------
//   institutionId + created_by come from the token. No academic year.
app.post('/api/admin/exam-schedules', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by    = req.auth.userId;
    const { title, subtitle, exam_type, class_id, section, schedule_data } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required.' });
    try {
        const [result] = await db.execute(
            `INSERT INTO exam_schedules
               (institutionId, title, subtitle, exam_type, class_id, section, schedule_data, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, subtitle || null, exam_type || 'Internal',
             class_id || null, section || null,
             JSON.stringify(schedule_data || []), created_by]
        );

        try {
            const recipients = await examRecipientIds(institutionId, class_id || null, section || null);
            await createNotifications({
                institutionId, recipientIds: recipients, type: 'exam',
                title: 'New exam timetable', body: title,
                link: 'Exams', entity_id: result.insertId, actor_id: created_by
            });
        } catch (e) { console.warn('[notify exam-schedule create]', e.message); }

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 16.A.2  GET /api/admin/exam-schedules/:instId  (teacher/admin list)
//   Institution ALWAYS from the token (Developer may target via URL).
//   Optional ?class_id=<id> narrows to one class ("All classes" omits it).
app.get('/api/admin/exam-schedules/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer'
        ? req.params.instId
        : req.auth.institutionId;

    const { class_id } = req.query;
    try {
        let sql = `
            SELECT es.id, es.institutionId, es.title, es.subtitle, es.exam_type,
                   es.class_id, es.section, es.schedule_data,
                   es.created_by, es.created_at,
                   c.className,
                   u.name AS created_by_name
              FROM exam_schedules es
              LEFT JOIN classes c ON c.id = es.class_id
              LEFT JOIN users   u ON u.id = es.created_by
             WHERE es.institutionId = ?`;
        const params = [instId];

        if (class_id && class_id !== 'all') {
            sql += ' AND es.class_id = ?';
            params.push(class_id);
        }
        sql += ' ORDER BY es.created_at DESC';

        const [rows] = await db.execute(sql, params);
        res.json(rows.map(r => ({ ...r, schedule_data: parseJsonSafe(r.schedule_data, []) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 16.A.3  GET /api/admin/exam-schedules/student/:id  (own class) --
//   Institution + class come from the STUDENT record, then guarded by
//   sameTenant so a crafted id can't reach another school. Returns the
//   student's class schedules plus school-wide ones (class_id NULL).
app.get('/api/admin/exam-schedules/student/:id', async (req, res) => {
    try {
        const [u] = await db.execute(
            'SELECT institutionId, class_id FROM users WHERE id = ?',
            [req.params.id]
        );
        if (!u.length) return res.json([]);

        const { institutionId, class_id } = u[0];
        if (!sameTenant(req, institutionId)) {
            return res.status(403).json({ error: 'This student belongs to another institution.' });
        }

        const [rows] = await db.execute(
            `SELECT es.id, es.title, es.subtitle, es.exam_type,
                    es.class_id, es.section, es.schedule_data,
                    es.created_by, es.created_at,
                    c.className,
                    u2.name AS created_by_name
               FROM exam_schedules es
               LEFT JOIN classes c  ON c.id = es.class_id
               LEFT JOIN users   u2 ON u2.id = es.created_by
              WHERE es.institutionId = ?
                AND (es.class_id = ? OR es.class_id IS NULL)
              ORDER BY es.created_at DESC`,
            [institutionId, class_id]
        );
        res.json(rows.map(r => ({ ...r, schedule_data: parseJsonSafe(r.schedule_data, []) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 16.A.4  GET /api/admin/exam-schedules/single/:id  (ownership) ---
app.get('/api/admin/exam-schedules/single/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT s.*, c.className, u.name AS created_by_name
               FROM exam_schedules s
               LEFT JOIN classes c ON c.id = s.class_id
               LEFT JOIN users   u ON u.id = s.created_by
              WHERE s.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This schedule belongs to another institution.' });
        const r = rows[0];
        res.json({ ...r, schedule_data: parseJsonSafe(r.schedule_data, []) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 16.A.5  PUT /api/admin/exam-schedules/:id  (ownership) ----------
//   No academic_year write.
app.put('/api/admin/exam-schedules/:id', async (req, res) => {
    const { title, subtitle, exam_type, class_id, section, schedule_data } = req.body;
    try {
        const [own] = await db.execute('SELECT institutionId FROM exam_schedules WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Schedule not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This schedule belongs to another institution.' });

        await db.execute(
            `UPDATE exam_schedules
                SET title = ?, subtitle = ?, exam_type = ?, class_id = ?, section = ?, schedule_data = ?
              WHERE id = ?`,
            [title, subtitle || null, exam_type || 'Internal',
             class_id || null, section || null, JSON.stringify(schedule_data || []), req.params.id]
        );

        try {
            const instId = own[0].institutionId;
            const recipients = await examRecipientIds(instId, class_id || null, section || null);
            await createNotifications({
                institutionId: instId, recipientIds: recipients, type: 'exam',
                title: 'Exam timetable updated', body: title,
                link: 'Exams', entity_id: req.params.id, actor_id: req.auth.userId
            });
        } catch (e) { console.warn('[notify exam-schedule update]', e.message); }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 16.A.6  DELETE /api/admin/exam-schedules/:id  (ownership) -------
app.delete('/api/admin/exam-schedules/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM exam_schedules WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This schedule belongs to another institution.' });
        await db.execute('DELETE FROM exam_schedules WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 16.B ONLINE EXAMS ===============================================
// =====================================================================

// --- 16.B.1 List exams created by/visible to a teacher ------------
app.get('/api/admin/exams/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [users] = await db.execute('SELECT id, role, institutionId FROM users WHERE id = ?', [teacherId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        if (!sameTenant(req, me.institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        let sql, params;
        if (isAdmin) {
            sql = `SELECT e.*, c.className, sub.name AS subject_name,
                          u.name AS created_by_name, t.name AS teacher_name,
                          (SELECT COUNT(*) FROM online_exam_attempts a WHERE a.exam_id = e.id) AS submission_count,
                          (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count
                     FROM online_exams e
                     LEFT JOIN classes c   ON c.id = e.class_id
                     LEFT JOIN subjects sub ON sub.id = e.subject_id
                     LEFT JOIN users u     ON u.id = e.created_by
                     LEFT JOIN users t     ON t.id = e.teacher_id
                    WHERE e.institutionId = ?
                    ORDER BY e.created_at DESC`;
            params = [me.institutionId];
        } else {
            sql = `SELECT e.*, c.className, sub.name AS subject_name,
                          u.name AS created_by_name, t.name AS teacher_name,
                          (SELECT COUNT(*) FROM online_exam_attempts a WHERE a.exam_id = e.id) AS submission_count,
                          (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count
                     FROM online_exams e
                     LEFT JOIN classes c   ON c.id = e.class_id
                     LEFT JOIN subjects sub ON sub.id = e.subject_id
                     LEFT JOIN users u     ON u.id = e.created_by
                     LEFT JOIN users t     ON t.id = e.teacher_id
                    WHERE e.created_by = ?
                    ORDER BY e.created_at DESC`;
            params = [teacherId];
        }
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.B.2 List exams for a student to take ----------------------
//   Now also returns the creator/teacher name and created_at so the
//   student list can show "by <teacher>" + creation time.
app.get('/api/admin/exams/student/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [u] = await db.execute('SELECT institutionId, class_id, section FROM users WHERE id = ?', [studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        const { institutionId, class_id, section } = u[0];
        if (!sameTenant(req, institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });

        const [rows] = await db.execute(
            `SELECT e.id AS exam_id, e.title, e.description, e.time_limit_mins, e.total_marks,
                    e.class_id, e.section, e.status AS exam_status, e.created_at,
                    c.className, sub.name AS subject_name,
                    cu.name AS created_by_name, t.name AS teacher_name,
                    (SELECT COUNT(*) FROM online_exam_questions q WHERE q.exam_id = e.id) AS question_count,
                    a.id AS attempt_id, a.status AS attempt_status, a.final_score, a.submitted_at
               FROM online_exams e
               LEFT JOIN classes c    ON c.id = e.class_id
               LEFT JOIN subjects sub ON sub.id = e.subject_id
               LEFT JOIN users cu     ON cu.id = e.created_by
               LEFT JOIN users t      ON t.id = e.teacher_id
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
            `SELECT e.*, c.className, sub.name AS subject_name,
                    u.name AS created_by_name, t.name AS teacher_name
               FROM online_exams e
               LEFT JOIN classes c   ON c.id = e.class_id
               LEFT JOIN subjects sub ON sub.id = e.subject_id
               LEFT JOIN users u     ON u.id = e.created_by
               LEFT JOIN users t     ON t.id = e.teacher_id
              WHERE e.id = ?`,
            [req.params.examId]
        );
        if (exam.length === 0) return res.status(404).json({ error: 'Exam not found' });
        if (!sameTenant(req, exam[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });

        const [questions] = await db.execute(
            'SELECT * FROM online_exam_questions WHERE exam_id = ? ORDER BY question_order, id',
            [req.params.examId]
        );
        const qList = questions.map(q => ({ ...q, options: parseJsonSafe(q.options, null) }));
        res.json({ ...exam[0], questions: qList });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.B.4 Create exam (+ notify students if published) ----------
app.post('/api/admin/exams', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;                 // actor from token, not body
    const {
        title, description, class_id, section, subject_id, teacher_id,
        time_limit_mins, status, questions = []
    } = req.body;
    if (!title || !class_id) {
        return res.status(400).json({ error: 'title and class_id are required.' });
    }
    const conn = await db.getConnection();
    try {
        // The class must belong to your institution.
        const [c] = await conn.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
        if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
            return res.status(403).json({ error: 'That class belongs to another institution.' });
        }
        await conn.beginTransaction();
        const totalMarks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        const [result] = await conn.execute(
            `INSERT INTO online_exams
              (institutionId, title, description, class_id, section, subject_id, teacher_id,
               time_limit_mins, total_marks, created_by, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, description || null, class_id, section || null,
             subject_id || null, teacher_id || null, parseInt(time_limit_mins, 10) || 0, totalMarks,
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

        // 🔔 Notify the class/section students — only if the exam is live.
        //    Own try/catch so a notify issue can't fail the create.
        try {
            if ((status || 'published') === 'published') {
                const recipients = await examRecipientIds(institutionId, class_id, section || null);
                await createNotifications({
                    institutionId, recipientIds: recipients, type: 'exam',
                    title: 'New exam available', body: title,
                    link: 'Exams', entity_id: examId, actor_id: created_by
                });
            }
        } catch (e) { console.warn('[notify exam]', e.message); }

        res.json({ success: true, id: examId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.put('/api/admin/exams/:examId', async (req, res) => {
    const {
        title, description, class_id, section, subject_id, teacher_id,
        time_limit_mins, status, questions = []
    } = req.body;
    const actor_id = req.auth.userId;                   // actor from token, not body
    const conn = await db.getConnection();
    try {
         const [exOwn] = await conn.execute('SELECT institutionId FROM online_exams WHERE id = ?', [req.params.examId]);
         if (exOwn.length === 0) return res.status(404).json({ error: 'Exam not found' });
         if (!sameTenant(req, exOwn[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });
         if (class_id) {
             const [c] = await conn.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
             if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                 return res.status(403).json({ error: 'That class belongs to another institution.' });
             }
         }
        await conn.beginTransaction();
        const totalMarks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);

        await conn.execute(
            `UPDATE online_exams
                SET title = ?, description = ?, class_id = ?, section = ?, subject_id = ?, teacher_id = ?,
                    time_limit_mins = ?, total_marks = ?, status = ?
              WHERE id = ?`,
            [title, description || null, class_id, section || null, subject_id || null, teacher_id || null,
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

        // 🔔 Re-notify the class/section students if the exam is published.
        //    institutionId isn't in the body, so read it from the row.
        try {
            if ((status || 'published') === 'published') {
                const [rows] = await db.execute(
                    'SELECT institutionId FROM online_exams WHERE id = ?', [req.params.examId]);
                if (rows.length) {
                    const instId = rows[0].institutionId;
                    const recipients = await examRecipientIds(instId, class_id, section || null);
                    await createNotifications({
                        institutionId: instId, recipientIds: recipients, type: 'exam',
                        title: 'Exam updated', body: title,
                        link: 'Exams', entity_id: req.params.examId, actor_id
                    });
                }
            }
        } catch (e) { console.warn('[notify exam update]', e.message); }

        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.delete('/api/admin/exams/:examId', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM online_exams WHERE id = ?', [req.params.examId]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });
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
        const [own] = await db.execute('SELECT institutionId FROM online_exams WHERE id = ?', [req.params.examId]);
        if (own.length === 0) return res.status(404).json({ error: 'Exam not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });
        const [questions] = await db.execute(
            `SELECT id, question_text, question_type, options, marks, question_order
               FROM online_exam_questions
              WHERE exam_id = ?
              ORDER BY question_order, id`,
            [req.params.examId]
        );
        const qList = questions.map(q => ({ ...q, options: parseJsonSafe(q.options, null) }));
        res.json(qList);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 16.C.2 Start (or resume) an attempt --------------------------
app.post('/api/admin/exams/:examId/start', async (req, res) => {
    const { examId } = req.params;
    const student_id = req.auth.userId;                    // start as yourself only
    try {
        const [own] = await db.execute('SELECT institutionId FROM online_exams WHERE id = ?', [examId]);
        if (own.length === 0) return res.status(404).json({ error: 'Exam not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });

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
app.post('/api/admin/attempts/:attemptId/submit', async (req, res) => {
    const { attemptId } = req.params;
    const { answers = {} } = req.body;
    const student_id = req.auth.userId;   // submit as yourself only
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
        const [own] = await db.execute('SELECT institutionId FROM online_exams WHERE id = ?', [req.params.examId]);
        if (own.length === 0) return res.json([]);
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam belongs to another institution.' });
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
            `SELECT a.*, e.title AS exam_title, e.total_marks, e.class_id, e.institutionId,
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
        if (!sameTenant(req, att[0].institutionId)) return res.status(403).json({ error: 'This attempt belongs to another institution.' });

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

// --- 16.C.6 Save grade for one attempt (+ notify the student) -----
app.post('/api/admin/attempts/:attemptId/grade', async (req, res) => {
    const { attemptId } = req.params;
    const { graded_answers = [], teacher_feedback } = req.body;
    const graded_by = req.auth.userId;     // grader = the logged-in user

    const conn = await db.getConnection();
    try {
        const [atOwn] = await conn.execute(
                        'SELECT e.institutionId FROM online_exam_attempts a JOIN online_exams e ON e.id = a.exam_id WHERE a.id = ?',
             [attemptId]);
         if (atOwn.length === 0) return res.status(404).json({ error: 'Attempt not found' });
        if (!sameTenant(req, atOwn[0].institutionId)) return res.status(403).json({ error: 'This attempt belongs to another institution.' });
        await conn.beginTransaction();

        // 1. Save the new manual grades provided by the teacher FIRST
        for (const g of graded_answers) {
            const marks = parseFloat(g.marks_awarded);
            const safe = isNaN(marks) ? 0 : marks;

            await conn.execute(
                `INSERT INTO online_exam_answers (attempt_id, question_id, marks_awarded)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks_awarded = VALUES(marks_awarded)`,
                [attemptId, g.question_id, safe]
            );
        }

        // 2. Ask the database for the true total of ALL answers (auto + manual)
        const [sumResult] = await conn.execute(
            `SELECT SUM(marks_awarded) as true_total FROM online_exam_answers WHERE attempt_id = ?`,
            [attemptId]
        );
        const finalTotal = parseFloat(sumResult[0].true_total) || 0;

        // 3. Update the attempt record with the secure database total
        await conn.execute(
            `UPDATE online_exam_attempts
                SET status = 'graded', final_score = ?, graded_at = ?, graded_by = ?, teacher_feedback = ?
              WHERE id = ?`,
            [finalTotal, nowSQL(), graded_by, teacher_feedback || null, attemptId]
        );

        await conn.commit();

        // 4. Notify the student using the secure total
        try {
            const [info] = await db.execute(
                `SELECT a.student_id, a.exam_id, e.institutionId, e.title AS exam_title, e.total_marks
                   FROM online_exam_attempts a
                   JOIN online_exams e ON e.id = a.exam_id
                  WHERE a.id = ?`,
                [attemptId]
            );
            if (info.length) {
                const r = info[0];
                await createNotifications({
                    institutionId: r.institutionId, recipientIds: [r.student_id], type: 'result',
                    title: 'Your result is ready',
                    body: r.total_marks
                        ? `${r.exam_title}: ${finalTotal}/${r.total_marks}`
                        : `${r.exam_title}: ${finalTotal} marks`,
                    link: 'Exams', entity_id: r.exam_id, actor_id: graded_by
                });
            }
        } catch (e) { console.warn('[notify result]', e.message); }

        res.json({ success: true, final_score: finalTotal });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});



// =====================================================================
// === 17. REPORTS — Offline Exams, Marks Entry & Report Cards =========
//   TENANT-SCOPED build. institutionId always comes from req.auth; by-id
//   routes verify ownership; marks/max-marks writes are allowlisted to
//   this institution's students/subjects/exam-types/classes (their unique
//   keys don't include institutionId, so a foreign id could otherwise
//   overwrite another school's rows).
//   (Migrations unchanged — see your existing header block.)
// =====================================================================

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

function buildMaxMarksMap(rows) {
    const maxMarks = {};
    (rows || []).forEach(r => {
        const et = r.exam_type_id;
        if (!maxMarks[et]) maxMarks[et] = { default: null, bySubject: {} };
        if (Number(r.subject_id) === 0) maxMarks[et].default = r.max_marks;
        else maxMarks[et].bySubject[r.subject_id] = r.max_marks;
    });
    return maxMarks;
}


// =====================================================================
// === 17.A EXAM TYPES =================================================
// =====================================================================

app.get('/api/admin/exam-types/:instId', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const [rows] = await db.execute(
            'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/exam-types', async (req, res) => {
    const { name, exam_order } = req.body;
    const institutionId = req.auth.institutionId;
    if (!name) return res.status(400).json({ error: 'name required.' });
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

app.put('/api/admin/exam-types/:id', async (req, res) => {
    const { name, exam_order } = req.body;
    try {
        const [own] = await db.execute('SELECT institutionId FROM exam_types WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Exam type not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam type belongs to another institution.' });
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

app.delete('/api/admin/exam-types/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM exam_types WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This exam type belongs to another institution.' });
        await db.execute('DELETE FROM exam_types WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 17.B MAX MARKS (per exam-type + class + subject) ================
// =====================================================================

app.get('/api/admin/exam-max-marks/:instId', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const [rows] = await db.execute(
            `SELECT m.id, m.exam_type_id, m.class_id, m.subject_id, m.max_marks,
                    t.name AS exam_type_name, c.className, c.section
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
               JOIN classes c    ON c.id = m.class_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/exam-max-marks', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const { entries = [] } = req.body;
    const conn = await db.getConnection();
    try {
        // The unique key has no institutionId, so allow writes only to this
        // institution's own exam types + classes.
        const [vExam] = await conn.execute('SELECT id FROM exam_types WHERE institutionId = ?', [institutionId]);
        const examOk = new Set(vExam.map(r => r.id));
        const [vClass] = await conn.execute('SELECT id FROM classes WHERE institutionId = ?', [institutionId]);
        const classOk = new Set(vClass.map(r => r.id));

        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.exam_type_id || !e.class_id) continue;
            if (!examOk.has(Number(e.exam_type_id)) || !classOk.has(Number(e.class_id))) continue;
            const subjectId = (e.subject_id === undefined || e.subject_id === null || e.subject_id === '')
                ? 0 : parseInt(e.subject_id, 10);
            const max = (e.max_marks === '' || e.max_marks === null || e.max_marks === undefined)
                ? null : parseInt(e.max_marks, 10);
            if (max === null) {
                await conn.execute(
                    'DELETE FROM exam_max_marks WHERE exam_type_id = ? AND class_id = ? AND subject_id = ?',
                    [e.exam_type_id, e.class_id, subjectId]
                );
            } else {
                await conn.execute(
                    `INSERT INTO exam_max_marks (exam_type_id, class_id, subject_id, max_marks)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE max_marks = VALUES(max_marks)`,
                    [e.exam_type_id, e.class_id, subjectId, max]
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

app.get('/api/admin/subject-teachers/:classId', async (req, res) => {
    try {
        const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [req.params.classId]);
        if (c.length === 0) return res.json([]);
        if (!sameTenant(req, c[0].institutionId)) return res.status(403).json({ error: 'That class belongs to another institution.' });
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

app.post('/api/admin/subject-teachers', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const { class_id, subject_id, teacher_id } = req.body;
    if (!class_id || !subject_id || !teacher_id) {
        return res.status(400).json({ error: 'class_id, subject_id, teacher_id required.' });
    }
    try {
        const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
        if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
            return res.status(403).json({ error: 'That class belongs to another institution.' });
        }
        await db.execute(
            `INSERT INTO subject_teacher_map (institutionId, class_id, subject_id, teacher_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
            [institutionId, class_id, subject_id, teacher_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/subject-teachers/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM subject_teacher_map WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This assignment belongs to another institution.' });
        await db.execute('DELETE FROM subject_teacher_map WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =====================================================================
// === 17.D MARKS ENTRY ================================================
// =====================================================================

app.get('/api/admin/reports/class-data/:classId', async (req, res) => {
    const { classId } = req.params;
    try {
        const [cls] = await db.execute('SELECT * FROM classes WHERE id = ?', [classId]);
        if (cls.length === 0) return res.status(404).json({ error: 'Class not found' });
        const instId = cls[0].institutionId;
        if (!sameTenant(req, instId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        const [students] = await db.execute(
            `SELECT id, name, roll_no, section
               FROM users
              WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
              ORDER BY roll_no, name`,
            [classId]
        );

        const [allSubjects] = await db.execute(
            'SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name',
            [instId]
        );

        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
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

        const [assignments] = await db.execute(
            `SELECT stm.subject_id, stm.teacher_id, u.name AS teacher_name
               FROM subject_teacher_map stm
               JOIN users u ON u.id = stm.teacher_id
              WHERE stm.class_id = ?`,
            [classId]
        );
        const assignMap = {};
        assignments.forEach(a => { assignMap[a.subject_id] = a; });

        const [examTypes] = await db.execute(
            'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );
        const [maxRows] = await db.execute(
            `SELECT m.exam_type_id, m.subject_id, m.max_marks
               FROM exam_max_marks m
              WHERE m.class_id = ?`,
            [classId]
        );
        const maxMarks = buildMaxMarksMap(maxRows);

        const examTypesForClass = examTypes
            .filter(t => maxMarks[t.id] !== undefined)
            .map(t => ({ ...t, max_marks: maxMarks[t.id]?.default ?? null }));

        const subjectsForClass = subjects.map(s => ({
            ...s,
            teacher_id:   assignMap[s.id]?.teacher_id || null,
            teacher_name: assignMap[s.id]?.teacher_name || null
        }));

        const [marks] = await db.execute(
            `SELECT student_id, subject_id, exam_type_id, marks_obtained
               FROM student_marks
              WHERE class_id = ? AND academic_year_id = ?`,
            [classId, yearId]
        );

        res.json({
            class: cls[0],
            academic_year_id: yearId,
            students,
            subjects: subjectsForClass,
            examTypes: examTypesForClass,
            maxMarks,
            marks
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reports/marks/bulk', async (req, res) => {
    const { class_id, entries = [] } = req.body;
    const institutionId = req.auth.institutionId;
    const actor_id = req.auth.userId;
    if (!class_id || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'class_id and entries[] required.' });
    }
    const conn = await db.getConnection();
    try {
        const yearId = await resolveYearId(institutionId, req.body.academic_year_id);
        if (!yearId) throw new Error('No active academic year. Activate one under Academics first.');

        // student_marks' unique key is (student,subject,exam,year) — NO
        // institutionId — so a foreign student_id could overwrite another
        // school's marks. Only write rows whose student/subject/exam belong
        // to THIS institution (and the student to THIS class).
        const [vStu] = await conn.execute(
            "SELECT id FROM users WHERE institutionId = ? AND class_id = ? AND LOWER(TRIM(role)) = 'student'",
            [institutionId, class_id]);
        const stuOk = new Set(vStu.map(r => r.id));
        const [vSub] = await conn.execute('SELECT id FROM subjects WHERE institutionId = ?', [institutionId]);
        const subOk = new Set(vSub.map(r => r.id));
        const [vExam] = await conn.execute('SELECT id FROM exam_types WHERE institutionId = ?', [institutionId]);
        const examOk = new Set(vExam.map(r => r.id));

        await conn.beginTransaction();
        let saved = 0;
        for (const e of entries) {
            if (!e.student_id || !e.subject_id || !e.exam_type_id) continue;
            if (!stuOk.has(Number(e.student_id)) || !subOk.has(Number(e.subject_id)) || !examOk.has(Number(e.exam_type_id))) continue;
            const val = (e.marks_obtained === '' || e.marks_obtained === null || e.marks_obtained === undefined)
                ? null : parseFloat(e.marks_obtained);
            await conn.execute(
                `INSERT INTO student_marks
                   (institutionId, academic_year_id, student_id, class_id, subject_id, exam_type_id, marks_obtained, entered_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained),
                                         entered_by = VALUES(entered_by)`,
                [institutionId, yearId, e.student_id, class_id, e.subject_id, e.exam_type_id, val, actor_id]
            );
            saved++;
        }
        await conn.commit();

        try {
            const studentIds = [...new Set(entries.map(e => e.student_id).filter(id => stuOk.has(Number(id))))];
            if (studentIds.length) {
                await createNotifications({
                    institutionId, recipientIds: studentIds, type: 'result',
                    title: 'Report card updated',
                    body: 'Your marks have been updated.',
                    link: 'reports', entity_id: class_id, actor_id
                });
            }
        } catch (e) { console.warn('[notify marks]', e.message); }

        res.json({ success: true, count: saved, academic_year_id: yearId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});


// =====================================================================
// === 17.E CLASS LIST + SUMMARIES =====================================
// =====================================================================

app.get('/api/admin/reports/class-summaries/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const yearId = await resolveYearId(instId, req.query.academic_year_id);
        const [classes] = await db.execute(
            'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section',
            [instId]
        );

        const summaries = [];
        for (const c of classes) {
            const [totalRow] = await db.execute(
                `SELECT COALESCE(SUM(sm.marks_obtained), 0) AS total
                   FROM student_marks sm
                   JOIN users u ON u.id = sm.student_id
                  WHERE sm.class_id = ? AND sm.academic_year_id = ?
                    AND (u.status IS NULL OR LOWER(TRIM(u.status)) <> 'alumni')`,
                [c.id, yearId]
            );

            const [topStudent] = await db.execute(
                `SELECT u.name, COALESCE(SUM(sm.marks_obtained), 0) AS marks
                   FROM users u
                   LEFT JOIN student_marks sm
                     ON sm.student_id = u.id AND sm.class_id = ? AND sm.academic_year_id = ?
                  WHERE u.class_id = ? AND LOWER(TRIM(u.role)) = 'student'
                    AND (u.status IS NULL OR LOWER(TRIM(u.status)) <> 'alumni')
                  GROUP BY u.id, u.name
                  ORDER BY marks DESC
                  LIMIT 1`,
                [c.id, yearId, c.id]
            );

            const [topSubject] = await db.execute(
                `SELECT sub.name, COALESCE(SUM(sm.marks_obtained), 0) AS marks
                   FROM student_marks sm
                   JOIN subjects sub ON sub.id = sm.subject_id
                   JOIN users u ON u.id = sm.student_id
                  WHERE sm.class_id = ? AND sm.academic_year_id = ?
                    AND (u.status IS NULL OR LOWER(TRIM(u.status)) <> 'alumni')
                  GROUP BY sub.id, sub.name
                  ORDER BY marks DESC
                  LIMIT 1`,
                [c.id, yearId]
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

    const [instRows] = await db.execute(
        'SELECT id, name, logo, school_email, phone, type FROM institutions WHERE id = ?',
        [student.institutionId]
    );
    const institution = instRows[0] || null;

    const [yearRows] = await db.execute(
        `SELECT * FROM academic_years
          WHERE institutionId = ? AND isActive = 1 LIMIT 1`,
        [student.institutionId]
    );
    const academicYear = yearRows[0] || null;

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
        'SELECT exam_type_id, subject_id, max_marks FROM exam_max_marks WHERE class_id = ?',
        [student.class_id]
    );
    const maxMarks = buildMaxMarksMap(maxRows);
    const examTypesForClass = examTypes
        .filter(t => maxMarks[t.id] !== undefined)
        .map(t => ({ ...t, max_marks: maxMarks[t.id]?.default ?? null }));

    let marks = [];
    if (academicYear) {
        const [mRows] = await db.execute(
            `SELECT subject_id, exam_type_id, marks_obtained
               FROM student_marks
              WHERE student_id = ? AND academic_year_id = ?`,
            [studentId, academicYear.id]
        );
        marks = mRows;
    }

    let attendance = [];
    if (academicYear) {
        try {
            const [wRows] = await db.execute(
                `SELECT DATE_FORMAT(a.attendance_date, '%Y-%m') AS ym,
                        COUNT(DISTINCT a.attendance_date) AS working
                   FROM attendance a
                   JOIN users u ON u.id = a.user_id
                  WHERE u.class_id = ? AND a.academic_year_id = ?
                  GROUP BY ym`,
                [student.class_id, academicYear.id]
            );
            const [pRows] = await db.execute(
                `SELECT DATE_FORMAT(attendance_date, '%Y-%m') AS ym,
                        COUNT(*) AS present
                   FROM attendance
                  WHERE user_id = ? AND academic_year_id = ? AND status IN ('P','L')
                  GROUP BY ym`,
                [studentId, academicYear.id]
            );

            const monthNames = ['January','February','March','April','May','June',
                                'July','August','September','October','November','December'];
            const wMap = {}; wRows.forEach(r => { wMap[r.ym] = Number(r.working) || 0; });
            const pMap = {}; pRows.forEach(r => { pMap[r.ym] = Number(r.present) || 0; });

            const months = Array.from(new Set([...Object.keys(wMap), ...Object.keys(pMap)])).sort();
            attendance = months.map(ym => {
                const m = parseInt(ym.slice(5, 7), 10);
                return {
                    month: monthNames[m - 1] || ym,
                    working_days: wMap[ym] || 0,
                    present_days: pMap[ym] || 0
                };
            });
        } catch {
            attendance = [];
        }
    }

    return {
        student,
        institution,
        academicYear: academicYear ? academicYear.name : '',
        subjects,
        examTypes: examTypesForClass,
        maxMarks,
        marks,
        attendance
    };
}

app.get('/api/admin/reports/student/:studentId', async (req, res) => {
    try {
        const card = await buildReportCard(req.params.studentId);
        if (!card) return res.status(404).json({ error: 'Student not found' });
        if (!sameTenant(req, card.student.institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });
        res.json(card);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/my-report-card/:studentId', async (req, res) => {
    try {
        const card = await buildReportCard(req.params.studentId);
        if (!card) return res.status(404).json({ error: 'Student not found' });
        if (!sameTenant(req, card.student.institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });
        res.json(card);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reports/class-cards/:classId', async (req, res) => {
    try {
        const [co] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [req.params.classId]);
        if (co.length === 0) return res.json([]);
        if (!sameTenant(req, co[0].institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
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


// === 15.9 MARKS EXPORT — class-wise register (self-contained) ========

app.get('/api/admin/marks-export/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const ExcelJS = require('exceljs');

        const BRAND = 'FF3284C7';
        const rollNum = (r) => { const n = parseInt(r, 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; };
        const fmtNum = (v) => {
            if (v === null || v === undefined || v === '') return '';
            const n = Number(v);
            if (isNaN(n)) return String(v);
            return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
        };
        const buildMaxMarksMap = (rows) => {
            const mm = {};
            (rows || []).forEach(r => {
                const et = r.exam_type_id;
                if (!mm[et]) mm[et] = { default: null, bySubject: {} };
                if (Number(r.subject_id) === 0) mm[et].default = r.max_marks;
                else mm[et].bySubject[r.subject_id] = r.max_marks;
            });
            return mm;
        };

        const scope = (req.query.scope || 'all').toString();
        const isClassScope = scope.startsWith('class:');
        const specificClass = isClassScope ? parseInt(scope.slice(6), 10) : null;

        let year;
        if (req.query.yearId) {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE id = ? AND institutionId = ?', [req.query.yearId, instId]);
            if (yr.length === 0) return res.status(404).json({ error: 'Academic year not found for this institution.' });
            year = yr[0];
        } else {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
            if (yr.length === 0) return res.status(400).json({ error: 'No active academic year to export.' });
            year = yr[0];
        }
        const yearId = year.id;
        const yLabel = year.name || '';

        const [instRows] = await db.execute('SELECT id, name FROM institutions WHERE id = ?', [instId]);
        const inst = instRows[0] || { name: 'Institution' };

        const [classes] = await db.execute('SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const classById = {}; classes.forEach(c => { classById[c.id] = c; });
        const labelOf = (cid) => { const c = classById[cid]; return c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : 'Unassigned'; };

        const [students] = await db.execute(
            `SELECT id, name, roll_no, class_id, section FROM users
              WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) <> 'alumni')`, [instId]);

        const [allSubjects] = await db.execute('SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name', [instId]);
        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
        const linkMap = {};
        scRows.forEach(r => { (linkMap[r.subject_id] = linkMap[r.subject_id] || new Set()).add(r.class_id); });
        const subjectsForClass = (cid) => allSubjects.filter(s => {
            const links = linkMap[s.id];
            if (!links || links.size === 0) return true;
            return links.has(cid);
        });

        const [examTypes] = await db.execute('SELECT id, name, exam_order FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id', [instId]);
        const [maxAll] = await db.execute(
            `SELECT m.exam_type_id, m.class_id, m.subject_id, m.max_marks
               FROM exam_max_marks m JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`, [instId]);
        const maxByClass = {};
        maxAll.forEach(r => { (maxByClass[r.class_id] = maxByClass[r.class_id] || []).push(r); });
        const maxMapByClass = {};
        Object.keys(maxByClass).forEach(cid => { maxMapByClass[cid] = buildMaxMarksMap(maxByClass[cid]); });
        const maxFor = (cid, etId, subId) => {
            const m = maxMapByClass[cid] && maxMapByClass[cid][etId];
            if (!m) return undefined;
            const sp = m.bySubject ? m.bySubject[subId] : undefined;
            if (sp !== undefined && sp !== null) return Number(sp);
            if (m.default !== undefined && m.default !== null) return Number(m.default);
            return undefined;
        };
        const examTypesForClass = (cid) => examTypes.filter(t => maxMapByClass[cid] && maxMapByClass[cid][t.id] !== undefined);

        const [marks] = await db.execute(
            'SELECT student_id, class_id, subject_id, exam_type_id, marks_obtained FROM student_marks WHERE institutionId = ? AND academic_year_id = ?',
            [instId, yearId]);
        const markMap = {};
        const histClass = {};
        const classExamHasData = {};
        marks.forEach(r => {
            markMap[`${r.student_id}:${r.subject_id}:${r.exam_type_id}`] = r.marks_obtained;
            if (histClass[r.student_id] == null) histClass[r.student_id] = r.class_id;
            classExamHasData[`${r.class_id}:${r.exam_type_id}`] = true;
        });
        const classOf = (u) => (histClass[u.id] != null ? histClass[u.id] : u.class_id);
        const studentHasAnyMark = (sid) => marks.some(r => r.student_id === sid);

        const studentsByClass = {};
        students.forEach(u => { const cid = classOf(u); (studentsByClass[cid] = studentsByClass[cid] || []).push(u); });
        Object.values(studentsByClass).forEach(list => list.sort((a, b) => rollNum(a.roll_no) - rollNum(b.roll_no) || (a.name || '').localeCompare(b.name || '')));

        const pctColor = (p) => p == null ? 'FF9CA3AF' : (p >= 80 ? 'FF059669' : p >= 50 ? 'FF2563EB' : 'FFDC2626');

        let widestSubjects = 0;
        const cids = (specificClass != null ? [specificClass] : Object.keys(studentsByClass).map(Number))
            .filter(cid => studentsByClass[cid] && studentsByClass[cid].length)
            .sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { numeric: true }));
        cids.forEach(cid => { widestSubjects = Math.max(widestSubjects, subjectsForClass(cid).length); });
        const maxCols = 3 + widestSubjects + 2;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz'; wb.created = new Date();
        const ws = wb.addWorksheet('Marks Register');
        let r = 1;

        ws.mergeCells(r, 1, r, maxCols);
        const tt = ws.getCell(r, 1); tt.value = inst.name || 'Institution'; tt.font = { bold: true, size: 14, color: { argb: 'FF111827' } }; r++;
        ws.mergeCells(r, 1, r, maxCols);
        const sb = ws.getCell(r, 1); sb.value = `Marks Register · ${yLabel}   (each cell = marks obtained / max)`; sb.font = { size: 10, color: { argb: 'FF6B7280' } }; r++;
        r++;

        const subHeading = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            c.alignment = { vertical: 'middle' }; ws.getRow(r).height = 20; r++;
        };
        const noteRow = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text; c.font = { italic: true, size: 10, color: { argb: 'FF9CA3AF' } }; r++;
        };
        const headerRow = (subjNames) => {
            const heads = ['Roll', 'Name', 'Exam', ...subjNames, 'Total', '%'];
            const row = ws.getRow(r);
            heads.forEach((h, i) => {
                const c = row.getCell(i + 1); c.value = h;
                c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
                c.alignment = { vertical: 'middle', horizontal: (i < 2 ? 'left' : 'center'), wrapText: true };
            });
            row.height = 24; r++;
            return subjNames.length;
        };
        const bodyRow = (roll, name, examLabel, subjCells, totalCell, pct, opts = {}) => {
            const row = ws.getRow(r);
            row.getCell(1).value = roll; row.getCell(1).alignment = { horizontal: 'left' };
            row.getCell(2).value = name; row.getCell(2).alignment = { horizontal: 'left' };
            row.getCell(3).value = examLabel; row.getCell(3).alignment = { horizontal: 'center' };
            subjCells.forEach((v, i) => { const c = row.getCell(4 + i); c.value = v; c.alignment = { horizontal: 'center' }; });
            const totIdx = 3 + subjCells.length + 1;
            row.getCell(totIdx).value = totalCell; row.getCell(totIdx).alignment = { horizontal: 'center' };
            const pctIdx = totIdx + 1;
            const pc = row.getCell(pctIdx); pc.value = pct != null ? `${pct}%` : '—'; pc.alignment = { horizontal: 'center' };
            pc.font = { bold: true, size: 9, color: { argb: pctColor(pct) } };
            const baseFont = { size: 9, color: { argb: opts.bold ? 'FF111827' : 'FF374151' }, bold: !!opts.bold };
            for (let i = 1; i <= 3 + subjCells.length + 1; i++) { const c = row.getCell(i); if (!(i === pctIdx)) c.font = baseFont; }
            if (opts.fill) { for (let i = 1; i <= pctIdx; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }; }
            r++;
        };

        if (cids.length === 0) noteRow('No classes with students for this selection.');

        cids.forEach(cid => {
            const subjects = subjectsForClass(cid);
            const subjNames = subjects.map(s => s.name);
            subHeading(labelOf(cid));
            headerRow(subjNames);

            const examsUsed = examTypesForClass(cid).filter(t => classExamHasData[`${cid}:${t.id}`]);
            const roster = studentsByClass[cid];

            if (examsUsed.length === 0) { noteRow('No marks entered for this class yet.'); r++; return; }

            roster.forEach(stu => {
                if (!studentHasAnyMark(stu.id)) {
                    bodyRow(stu.roll_no || '—', stu.name, '—', subjects.map(() => '—'), '—', null);
                    return;
                }
                let firstRow = true;
                examsUsed.forEach(et => {
                    let tObt = 0, tMx = 0, anyObt = false;
                    const cells = subjects.map(s => {
                        const obt = markMap[`${stu.id}:${s.id}:${et.id}`];
                        const mx = maxFor(cid, et.id, s.id);
                        if (obt != null) { tObt += Number(obt); anyObt = true; }
                        if (mx) tMx += mx;
                        return obt != null ? (mx ? `${fmtNum(obt)}/${fmtNum(mx)}` : fmtNum(obt)) : '—';
                    });
                    const pct = (tMx > 0 && anyObt) ? Math.round((tObt / tMx) * 1000) / 10 : null;
                    bodyRow(firstRow ? (stu.roll_no || '—') : '', firstRow ? stu.name : '', et.name,
                        cells, anyObt ? `${fmtNum(tObt)}/${fmtNum(tMx)}` : '—', pct);
                    firstRow = false;
                });
                let gObt = 0, gMx = 0, gAny = false;
                const oCells = subjects.map(s => {
                    let o = 0, m = 0, any = false;
                    examsUsed.forEach(et => {
                        const obt = markMap[`${stu.id}:${s.id}:${et.id}`];
                        const mx = maxFor(cid, et.id, s.id);
                        if (obt != null) { o += Number(obt); any = true; gAny = true; }
                        if (mx) m += mx;
                    });
                    gObt += o; gMx += m;
                    return any ? (m ? `${fmtNum(o)}/${fmtNum(m)}` : fmtNum(o)) : '—';
                });
                const oPct = (gMx > 0 && gAny) ? Math.round((gObt / gMx) * 1000) / 10 : null;
                bodyRow('', '', 'OVERALL', oCells, gAny ? `${fmtNum(gObt)}/${fmtNum(gMx)}` : '—', oPct, { bold: true, fill: 'FFEFF3F8' });
            });
            r++;
        });

        ws.getColumn(1).width = 7; ws.getColumn(2).width = 24; ws.getColumn(3).width = 12;
        for (let i = 0; i < widestSubjects; i++) ws.getColumn(4 + i).width = 11;
        ws.getColumn(3 + widestSubjects + 1).width = 12;
        ws.getColumn(3 + widestSubjects + 2).width = 8;
        ws.views = [{ state: 'frozen', xSplit: 3 }];

        const scopeTag = isClassScope ? `Class_${labelOf(specificClass)}` : 'All';
        const fileSafe = `${inst.name || 'institution'}_Marks_${scopeTag}_${yLabel}`.replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafe}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[marks-export] FATAL:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
});



// =====================================================================
//  BACKEND — Section 18: PERFORMANCE ANALYTICS  (TENANT-SCOPED)
//
//  institutionId comes from req.auth. Class/student/teacher reads verify
//  the target belongs to the caller's institution via sameTenant.
//  Reads entirely from the Reports tables (no new tables).
// =====================================================================

function buildExamMaxMap(rows) {
    const map = {};
    (rows || []).forEach(r => {
        const et = r.exam_type_id;
        if (!map[et]) map[et] = { default: null, bySubject: {} };
        if (Number(r.subject_id) === 0) map[et].default = r.max_marks;
        else map[et].bySubject[r.subject_id] = r.max_marks;
    });
    return map;
}
function resolveExamMax(examMax, subjectId) {
    if (!examMax) return undefined;
    const sp = examMax.bySubject ? examMax.bySubject[subjectId] : undefined;
    if (sp !== undefined && sp !== null) return Number(sp);
    if (examMax.default !== undefined && examMax.default !== null) return Number(examMax.default);
    return undefined;
}

async function loadClassPerformance(classId, requestedYearId) {
    const [cls] = await db.execute('SELECT * FROM classes WHERE id = ?', [classId]);
    if (cls.length === 0) return null;
    const instId = cls[0].institutionId;
    const yearId = await resolveYearId(instId, requestedYearId);

    const [students] = await db.execute(
        `SELECT id, name, roll_no, section
           FROM users
          WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
          ORDER BY roll_no, name`,
        [classId]
    );

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

    const [examTypes] = await db.execute(
        'SELECT * FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
        [instId]
    );
    const [maxRows] = await db.execute(
        'SELECT exam_type_id, subject_id, max_marks FROM exam_max_marks WHERE class_id = ?',
        [classId]
    );
    const maxMarks = buildExamMaxMap(maxRows);
    const examTypesForClass = examTypes
        .filter(t => maxMarks[t.id] !== undefined)
        .map(t => ({ ...t, max_marks: maxMarks[t.id]?.default ?? null }));

    const [assignments] = await db.execute(
        `SELECT stm.subject_id, stm.teacher_id, u.name AS teacher_name, u.email AS teacher_email
           FROM subject_teacher_map stm
           JOIN users u ON u.id = stm.teacher_id
          WHERE stm.class_id = ?`,
        [classId]
    );

    const [marks] = await db.execute(
        `SELECT student_id, subject_id, exam_type_id, marks_obtained
           FROM student_marks
          WHERE class_id = ? AND academic_year_id = ?`,
        [classId, yearId]
    );

    return {
        class: cls[0],
        academic_year_id: yearId,
        students,
        subjects,
        examTypes: examTypesForClass,
        maxMarks,
        assignments,
        marks
    };
}


// --- 18.1 Class list for a school (performance dropdowns) ------------
app.get('/api/admin/performance/classes/:instId', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const { teacher_id } = req.query;
        let rows;
        if (teacher_id) {
            [rows] = await db.execute(
                `SELECT DISTINCT c.id, c.className, c.section
                   FROM classes c
                   JOIN subject_teacher_map stm ON stm.class_id = c.id
                  WHERE c.institutionId = ? AND stm.teacher_id = ?
                  ORDER BY c.className, c.section`,
                [instId, teacher_id]
            );
        } else {
            [rows] = await db.execute(
                'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section',
                [instId]
            );
        }
        res.json(rows.map(c => ({
            id: c.id,
            className: c.className,
            section: c.section,
            class_group: `${c.className}${c.section ? ' - ' + c.section : ''}`
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.2 Full performance dataset for one class --------------------
app.get('/api/admin/performance/class/:classId', async (req, res) => {
    try {
        const data = await loadClassPerformance(req.params.classId, req.query.academic_year_id);
        if (!data) return res.status(404).json({ error: 'Class not found' });
        if (!sameTenant(req, data.class.institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.3 One student's own performance bundle --------------------
app.get('/api/admin/performance/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute(
            'SELECT id, name, class_id, institutionId FROM users WHERE id = ?',
            [req.params.studentId]
        );
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!sameTenant(req, u[0].institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });
        if (!u[0].class_id) {
            return res.json({ me: u[0], class: null, students: [], subjects: [], examTypes: [], maxMarks: {}, assignments: [], marks: [] });
        }
        const data = await loadClassPerformance(u[0].class_id, req.query.academic_year_id);
        if (!data) return res.status(404).json({ error: 'Class not found' });
        res.json({ me: u[0], ...data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.4 Teacher performance across the whole school ---------------
app.get('/api/admin/performance/teachers/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        const [examTypeRows] = await db.execute(
            'SELECT id, name, exam_order FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );

        const [assignments] = await db.execute(
            `SELECT stm.class_id, stm.subject_id, stm.teacher_id,
                    u.name AS teacher_name, u.email AS teacher_email,
                    sub.name AS subject_name,
                    c.className, c.section
               FROM subject_teacher_map stm
               JOIN users u    ON u.id = stm.teacher_id
               JOIN subjects sub ON sub.id = stm.subject_id
               JOIN classes c  ON c.id = stm.class_id
              WHERE stm.institutionId = ?`,
            [instId]
        );

        const [maxRows] = await db.execute(
            `SELECT m.class_id, m.exam_type_id, m.subject_id, m.max_marks
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        const maxByClass = {};
        maxRows.forEach(r => {
            if (!maxByClass[r.class_id]) maxByClass[r.class_id] = {};
            const et = r.exam_type_id;
            if (!maxByClass[r.class_id][et]) maxByClass[r.class_id][et] = { default: null, bySubject: {} };
            if (Number(r.subject_id) === 0) maxByClass[r.class_id][et].default = r.max_marks;
            else maxByClass[r.class_id][et].bySubject[r.subject_id] = r.max_marks;
        });

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

        const [allMarks] = await db.execute(
            `SELECT sm.class_id, sm.subject_id, sm.exam_type_id, sm.marks_obtained
               FROM student_marks sm
              WHERE sm.institutionId = ? AND sm.academic_year_id = ?`,
            [instId, yearId]
        );

        const agg = {};
        allMarks.forEach(m => {
            const max = resolveExamMax(maxByClass[m.class_id]?.[m.exam_type_id], m.subject_id);
            if (max === undefined || max === null) return;
            const val = parseFloat(m.marks_obtained);
            if (isNaN(val)) return;
            const k = `${m.class_id}:${m.subject_id}:${m.exam_type_id}`;
            if (!agg[k]) agg[k] = { obtained: 0, possible: 0 };
            agg[k].obtained += val;
            agg[k].possible += max;
        });

        const teachers = {};
        for (const a of assignments) {
            if (!teachers[a.teacher_id]) {
                teachers[a.teacher_id] = {
                    teacher_id: a.teacher_id,
                    teacher_name: a.teacher_name,
                    teacher_email: a.teacher_email || null,
                    detail: []
                };
            }
            const exams = examTypeRows.map(t => {
                const e = agg[`${a.class_id}:${a.subject_id}:${t.id}`] || { obtained: 0, possible: 0 };
                return {
                    exam_type_id: t.id,
                    exam_name: t.name,
                    obtained: e.obtained,
                    possible: e.possible
                };
            }).filter(e => e.possible > 0);

            teachers[a.teacher_id].detail.push({
                class_id: a.class_id,
                class_group: `${a.className}${a.section ? ' - ' + a.section : ''}`,
                subject_id: a.subject_id,
                subject_name: a.subject_name,
                student_count: studentCountMap[a.class_id] || 0,
                exams
            });
        }

        res.json({
            examTypes: examTypeRows.map(t => ({ id: t.id, name: t.name })),
            teachers: Object.values(teachers)
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 18.5 One teacher's own performance -----------------------------
app.get('/api/admin/performance/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const [u] = await db.execute(
            'SELECT id, name, email, institutionId FROM users WHERE id = ?',
            [teacherId]
        );
        if (u.length === 0) return res.status(404).json({ error: 'Teacher not found' });
        const instId = u[0].institutionId;
        if (!sameTenant(req, instId)) return res.status(403).json({ error: 'This teacher belongs to another institution.' });
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        const [examTypeRows] = await db.execute(
            'SELECT id, name, exam_order FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );

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
            `SELECT m.class_id, m.exam_type_id, m.subject_id, m.max_marks
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        const maxByClass = {};
        maxRows.forEach(r => {
            if (!maxByClass[r.class_id]) maxByClass[r.class_id] = {};
            const et = r.exam_type_id;
            if (!maxByClass[r.class_id][et]) maxByClass[r.class_id][et] = { default: null, bySubject: {} };
            if (Number(r.subject_id) === 0) maxByClass[r.class_id][et].default = r.max_marks;
            else maxByClass[r.class_id][et].bySubject[r.subject_id] = r.max_marks;
        });

        const detail = [];
        let overallObtained = 0, overallPossible = 0;

        for (const a of assignments) {
            const [marks] = await db.execute(
                `SELECT exam_type_id, marks_obtained
                   FROM student_marks
                  WHERE class_id = ? AND subject_id = ? AND academic_year_id = ?`,
                [a.class_id, a.subject_id, yearId]
            );
            const exams = examTypeRows.map(t => {
                let o = 0, p = 0;
                const max = resolveExamMax(maxByClass[a.class_id]?.[t.id], a.subject_id);
                marks.forEach(m => {
                    if (m.exam_type_id !== t.id) return;
                    const val = parseFloat(m.marks_obtained);
                    if (isNaN(val)) return;
                    if (max === undefined || max === null) return;
                    o += val; p += max;
                });
                return { exam_type_id: t.id, exam_name: t.name, obtained: o, possible: p };
            }).filter(e => e.possible > 0);

            const o = exams.reduce((s, e) => s + e.obtained, 0);
            const p = exams.reduce((s, e) => s + e.possible, 0);
            detail.push({
                class_id: a.class_id,
                class_group: `${a.className}${a.section ? ' - ' + a.section : ''}`,
                subject_id: a.subject_id,
                subject_name: a.subject_name,
                exams,
                total_obtained: o,
                total_possible: p,
                percentage: p > 0 ? (o / p) * 100 : null
            });
            overallObtained += o;
            overallPossible += p;
        }

        res.json({
            teacher_id: u[0].id,
            teacher_name: u[0].name,
            teacher_email: u[0].email || null,
            overall_obtained: overallObtained,
            overall_possible: overallPossible,
            overall_percentage: overallPossible > 0
                ? (overallObtained / overallPossible) * 100 : null,
            examTypes: examTypeRows.map(t => ({ id: t.id, name: t.name })),
            detail
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// === 15.10 PERFORMANCE EXPORT — students + teachers (self-contained) ==
app.get('/api/admin/performance-export/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const ExcelJS = require('exceljs');

        const BRAND = 'FF3284C7';
        const rollNum = (r) => { const n = parseInt(r, 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; };
        const r1 = (n) => Math.round(n * 10) / 10;
        const buildMaxMarksMap = (rows) => {
            const mm = {};
            (rows || []).forEach(r => {
                const et = r.exam_type_id;
                if (!mm[et]) mm[et] = { default: null, bySubject: {} };
                if (Number(r.subject_id) === 0) mm[et].default = r.max_marks;
                else mm[et].bySubject[r.subject_id] = r.max_marks;
            });
            return mm;
        };

        const scope = (req.query.scope || 'all').toString();
        const isClassScope = scope.startsWith('class:');
        const specificClass = isClassScope ? parseInt(scope.slice(6), 10) : null;
        const includeStudents = scope === 'all' || scope === 'students' || isClassScope;
        const includeTeachers = scope === 'all' || scope === 'teachers';

        let year;
        if (req.query.yearId) {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE id = ? AND institutionId = ?', [req.query.yearId, instId]);
            if (yr.length === 0) return res.status(404).json({ error: 'Academic year not found for this institution.' });
            year = yr[0];
        } else {
            const [yr] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1', [instId]);
            if (yr.length === 0) return res.status(400).json({ error: 'No active academic year to export.' });
            year = yr[0];
        }
        const yearId = year.id;
        const yLabel = year.name || '';

        const [instRows] = await db.execute('SELECT id, name FROM institutions WHERE id = ?', [instId]);
        const inst = instRows[0] || { name: 'Institution' };

        const [classes] = await db.execute('SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section', [instId]);
        const classById = {}; classes.forEach(c => { classById[c.id] = c; });
        const labelOf = (cid) => { const c = classById[cid]; return c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : 'Unassigned'; };

        const [students] = await db.execute(
            `SELECT id, name, roll_no, class_id FROM users
              WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
                AND (status IS NULL OR LOWER(TRIM(status)) <> 'alumni')`, [instId]);

        const [allSubjects] = await db.execute('SELECT id, name FROM subjects WHERE institutionId = ? ORDER BY name', [instId]);
        const subjectName = {}; allSubjects.forEach(s => { subjectName[s.id] = s.name; });
        const [scRows] = await db.execute(
            `SELECT sc.subject_id, sc.class_id FROM subject_classes sc
               JOIN subjects s ON s.id = sc.subject_id WHERE s.institutionId = ?`, [instId]);
        const linkMap = {};
        scRows.forEach(r => { (linkMap[r.subject_id] = linkMap[r.subject_id] || new Set()).add(r.class_id); });
        const subjectsForClass = (cid) => allSubjects.filter(s => {
            const links = linkMap[s.id];
            if (!links || links.size === 0) return true;
            return links.has(cid);
        });

        const [examTypes] = await db.execute('SELECT id, name, exam_order FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id', [instId]);
        const examName = {}; examTypes.forEach(t => { examName[t.id] = t.name; });

        const [maxAll] = await db.execute(
            `SELECT m.exam_type_id, m.class_id, m.subject_id, m.max_marks
               FROM exam_max_marks m JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`, [instId]);
        const maxByClass = {};
        maxAll.forEach(r => { (maxByClass[r.class_id] = maxByClass[r.class_id] || []).push(r); });
        const maxMapByClass = {};
        Object.keys(maxByClass).forEach(cid => { maxMapByClass[cid] = buildMaxMarksMap(maxByClass[cid]); });
        const maxFor = (cid, etId, subId) => {
            const m = maxMapByClass[cid] && maxMapByClass[cid][etId];
            if (!m) return undefined;
            const sp = m.bySubject ? m.bySubject[subId] : undefined;
            if (sp !== undefined && sp !== null) return Number(sp);
            if (m.default !== undefined && m.default !== null) return Number(m.default);
            return undefined;
        };

        const [marks] = await db.execute(
            'SELECT student_id, class_id, subject_id, exam_type_id, marks_obtained FROM student_marks WHERE institutionId = ? AND academic_year_id = ?',
            [instId, yearId]);
        const markMap = {};
        const histClass = {};
        const stuExamSet = {};
        const examHasDataSchool = {};
        marks.forEach(r => {
            markMap[`${r.student_id}:${r.subject_id}:${r.exam_type_id}`] = r.marks_obtained;
            if (histClass[r.student_id] == null) histClass[r.student_id] = r.class_id;
            (stuExamSet[r.student_id] = stuExamSet[r.student_id] || new Set()).add(r.exam_type_id);
            examHasDataSchool[r.exam_type_id] = true;
        });
        const classOf = (u) => (histClass[u.id] != null ? histClass[u.id] : u.class_id);

        const studentsByClass = {};
        students.forEach(u => { const cid = classOf(u); (studentsByClass[cid] = studentsByClass[cid] || []).push(u); });
        Object.values(studentsByClass).forEach(list => list.sort((a, b) => rollNum(a.roll_no) - rollNum(b.roll_no) || (a.name || '').localeCompare(b.name || '')));

        const aggCSE = {};
        marks.forEach(m => {
            const mx = maxFor(m.class_id, m.exam_type_id, m.subject_id);
            const val = parseFloat(m.marks_obtained);
            if (mx === undefined || mx === null || isNaN(val)) return;
            const k = `${m.class_id}:${m.subject_id}:${m.exam_type_id}`;
            if (!aggCSE[k]) aggCSE[k] = { obtained: 0, possible: 0 };
            aggCSE[k].obtained += val; aggCSE[k].possible += mx;
        });
        const [assignments] = await db.execute(
            `SELECT stm.teacher_id, stm.class_id, stm.subject_id, u.name AS teacher_name
               FROM subject_teacher_map stm JOIN users u ON u.id = stm.teacher_id
              WHERE stm.institutionId = ?`, [instId]);

        const pctColor = (p) => p == null ? 'FF9CA3AF' : (p >= 80 ? 'FF059669' : p >= 50 ? 'FF2563EB' : 'FFDC2626');

        const teacherExamCols = examTypes.filter(t => examHasDataSchool[t.id]);

        const cids = (specificClass != null ? [specificClass] : Object.keys(studentsByClass).map(Number))
            .filter(cid => studentsByClass[cid] && studentsByClass[cid].length)
            .sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { numeric: true }));
        let widestSubjects = 0;
        cids.forEach(cid => { widestSubjects = Math.max(widestSubjects, subjectsForClass(cid).length); });
        const studentCols = 3 + widestSubjects + 1;
        const teacherCols = 4 + teacherExamCols.length + 1;
        const maxCols = Math.max(studentCols, teacherCols, 6);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz'; wb.created = new Date();
        const ws = wb.addWorksheet('Performance');
        let r = 1;

        ws.mergeCells(r, 1, r, maxCols);
        const tt = ws.getCell(r, 1); tt.value = inst.name || 'Institution'; tt.font = { bold: true, size: 14, color: { argb: 'FF111827' } }; r++;
        ws.mergeCells(r, 1, r, maxCols);
        const sb = ws.getCell(r, 1); sb.value = `Performance · ${yLabel}   (each cell = % · green >=80, blue 50-80, red <50)`; sb.font = { size: 10, color: { argb: 'FF6B7280' } }; r++;
        r++;

        const heading = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            c.alignment = { vertical: 'middle' }; ws.getRow(r).height = 20; r++;
        };
        const subHeading = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text;
            c.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } }; r++;
        };
        const noteRow = (text) => {
            ws.mergeCells(r, 1, r, maxCols);
            const c = ws.getCell(r, 1); c.value = text; c.font = { italic: true, size: 10, color: { argb: 'FF9CA3AF' } }; r++;
        };
        const headerRow = (heads, leftCount) => {
            const row = ws.getRow(r);
            heads.forEach((h, i) => {
                const c = row.getCell(i + 1); c.value = h;
                c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
                c.alignment = { vertical: 'middle', horizontal: (i < leftCount ? 'left' : 'center'), wrapText: true };
            });
            row.height = 26; r++;
        };
        const pctRow = (leftVals, pcts, overall, opts = {}) => {
            const row = ws.getRow(r);
            leftVals.forEach((v, i) => {
                const c = row.getCell(i + 1); c.value = v;
                c.alignment = { horizontal: i < (opts.leftAlign || 2) ? 'left' : 'center' };
                c.font = { size: 9, bold: !!opts.bold, color: { argb: opts.bold ? 'FF111827' : (i === 1 ? 'FF111827' : 'FF374151') } };
                if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
            });
            const base = leftVals.length;
            pcts.forEach((p, i) => {
                const c = row.getCell(base + i + 1);
                c.value = p != null ? `${p}%` : '—';
                c.alignment = { horizontal: 'center' };
                c.font = { size: 9, bold: p != null && (opts.bold || opts.boldPct), color: { argb: pctColor(p) } };
                if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
            });
            const oc = row.getCell(base + pcts.length + 1);
            oc.value = overall != null ? `${overall}%` : '—';
            oc.alignment = { horizontal: 'center' };
            oc.font = { size: 9, bold: true, color: { argb: pctColor(overall) } };
            if (opts.fill) oc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
            r++;
        };

        if (includeStudents) {
            heading('STUDENTS');
            if (cids.length === 0) noteRow('No students with marks for this selection.');
            cids.forEach(cid => {
                const subjects = subjectsForClass(cid);
                subHeading(labelOf(cid));
                headerRow(['Roll', 'Name', 'Exam', ...subjects.map(s => s.name), 'Overall %'], 2);

                studentsByClass[cid].forEach(stu => {
                    const myExams = examTypes.filter(t => (stuExamSet[stu.id] || new Set()).has(t.id));
                    if (myExams.length === 0) {
                        pctRow([stu.roll_no || '—', stu.name, '—'], subjects.map(() => null), null);
                        return;
                    }
                    const subjAcc = subjects.map(() => ({ o: 0, p: 0, any: false }));
                    let gObt = 0, gPos = 0, gAny = false;
                    let first = true;
                    myExams.forEach(et => {
                        let eObt = 0, ePos = 0, eAny = false;
                        const cells = subjects.map((s, si) => {
                            const obt = markMap[`${stu.id}:${s.id}:${et.id}`];
                            const mx = maxFor(cid, et.id, s.id);
                            if (obt == null || mx === undefined || mx === null) return null;
                            const val = parseFloat(obt); if (isNaN(val)) return null;
                            eObt += val; ePos += mx; eAny = true;
                            subjAcc[si].o += val; subjAcc[si].p += mx; subjAcc[si].any = true;
                            return r1((val / mx) * 100);
                        });
                        if (eAny) { gObt += eObt; gPos += ePos; gAny = true; }
                        pctRow([first ? (stu.roll_no || '—') : '', first ? stu.name : '', et.name],
                            cells, eAny && ePos > 0 ? r1((eObt / ePos) * 100) : null);
                        first = false;
                    });
                    const oCells = subjAcc.map(a => a.any && a.p > 0 ? r1((a.o / a.p) * 100) : null);
                    pctRow(['', '', 'OVERALL'], oCells, gAny && gPos > 0 ? r1((gObt / gPos) * 100) : null,
                        { bold: true, fill: 'FFEFF3F8' });
                });
                r++;
            });
        }

        if (includeTeachers) {
            heading('TEACHERS');
            headerRow(['S.No', 'Teacher', 'Class', 'Subject', ...teacherExamCols.map(t => t.name), 'Overall %'], 4);

            const byTeacher = {};
            assignments.forEach(a => { (byTeacher[a.teacher_id] = byTeacher[a.teacher_id] || { name: a.teacher_name, rows: [] }).rows.push(a); });
            const teacherIds = Object.keys(byTeacher).sort((x, y) => (byTeacher[x].name || '').localeCompare(byTeacher[y].name || ''));
            if (teacherIds.length === 0) noteRow('No teacher assignments found.');
            let sno = 0;
            teacherIds.forEach(tid => {
                const t = byTeacher[tid];
                sno++;
                t.rows.sort((a, b) => labelOf(a.class_id).localeCompare(labelOf(b.class_id), undefined, { numeric: true }) || (subjectName[a.subject_id] || '').localeCompare(subjectName[b.subject_id] || ''));
                const examAcc = teacherExamCols.map(() => ({ o: 0, p: 0, any: false }));
                let gObt = 0, gPos = 0, gAny = false, first = true;
                t.rows.forEach(a => {
                    let rObt = 0, rPos = 0, rAny = false;
                    const cells = teacherExamCols.map((et, ei) => {
                        const e = aggCSE[`${a.class_id}:${a.subject_id}:${et.id}`];
                        if (!e || e.possible <= 0) return null;
                        rObt += e.obtained; rPos += e.possible; rAny = true;
                        examAcc[ei].o += e.obtained; examAcc[ei].p += e.possible; examAcc[ei].any = true;
                        return r1((e.obtained / e.possible) * 100);
                    });
                    if (rAny) { gObt += rObt; gPos += rPos; gAny = true; }
                    pctRow([first ? sno : '', first ? t.name : '', labelOf(a.class_id), subjectName[a.subject_id] || '—'],
                        cells, rAny && rPos > 0 ? r1((rObt / rPos) * 100) : null, { leftAlign: 2 });
                    first = false;
                });
                const oCells = examAcc.map(a => a.any && a.p > 0 ? r1((a.o / a.p) * 100) : null);
                pctRow(['', '', 'OVERALL', ''], oCells, gAny && gPos > 0 ? r1((gObt / gPos) * 100) : null,
                    { bold: true, fill: 'FFEFF3F8', leftAlign: 2 });
                r++;
            });
        }

        ws.getColumn(1).width = 8; ws.getColumn(2).width = 24;
        for (let i = 3; i <= maxCols; i++) ws.getColumn(i).width = 12;
        ws.views = [{ state: 'frozen', xSplit: 2 }];

        const scopeTag = isClassScope ? `Class_${labelOf(specificClass)}` : scope.charAt(0).toUpperCase() + scope.slice(1);
        const fileSafe = `${inst.name || 'institution'}_Performance_${scopeTag}_${yLabel}`.replace(/[^a-z0-9\-_ ]/gi, '_').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafe}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[performance-export] FATAL:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
});




// =====================================================================
// === 19. GALLERY =====================================================
//   TENANT-SCOPED. institutionId from req.auth; media stream + delete
//   verify the row's institution. Album delete uses the real (token) role.
//
//   ⚠ gallery/media/:id is under the /api auth gate — it only works if the
//     frontend FETCHES it (interceptor adds the token) and renders a blob.
//     A raw <img src>/<video src> sends no token and 401s. If media renders
//     today you're already fetching blobs and this is fine.
//
//   19.7 (new): export the gallery as a ZIP of real folders — one folder per
//   album; for "all years" the albums are nested under a per-year folder.
//   Streamed via archiver; the frontend fetches it as a blob so the token
//   rides along (a plain download link wouldn't). Photos AND videos can't go
//   in a spreadsheet, so ZIP is the natural "download the whole gallery"
//   format. Requires:  npm install archiver
// =====================================================================

const galleryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB per file
});

// --- 19.1 Get all albums (grouped by title) --------------------------
app.get('/api/admin/gallery/:instId', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const [rows] = await db.execute(
            `SELECT title,
                    event_date,
                    COUNT(*) AS item_count,
                    MAX(id)  AS newest_id,
                    MAX(CASE WHEN file_type = 'photo' THEN id END) AS newest_photo_id
               FROM gallery
              WHERE institutionId = ?
              GROUP BY title, event_date
              ORDER BY event_date DESC`,
            [instId]
        );

        const albums = rows.map(r => {
            const hasPhoto = r.newest_photo_id != null;
            return {
                title:      r.title,
                event_date: r.event_date,
                item_count: r.item_count,
                cover_id:   hasPhoto ? r.newest_photo_id : null,
                cover_type: hasPhoto ? 'photo' : 'none'
            };
        });
        res.json(albums);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 19.2 Get items in a specific album ------------------------------
app.get('/api/admin/gallery/album/:instId/:title', async (req, res) => {
    try {
        const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
        const [rows] = await db.execute(
            `SELECT id, institutionId, title, file_type, mime_type,
                    event_date, created_by, created_at
               FROM gallery
              WHERE institutionId = ? AND title = ?
              ORDER BY created_at DESC`,
            [instId, req.params.title]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 19.7 Export the gallery as a ZIP of album folders ---------------
//   ?year=YYYY -> that year only, zip layout:  <Album>/<file>
//   ?year=all  -> every year,     zip layout:  <Year>/<Album>/<file>
//   Two path segments (:instId + export) — never collides with the
//   one-segment '/:instId' album-list route. Files are pulled one at a
//   time (metadata first, then each blob) so memory stays flat.
app.get('/api/admin/gallery/:instId/export', async (req, res) => {
    const archiver = require('archiver'); // local require; add via: npm install archiver
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { year } = req.query;
    const yr = parseInt(year, 10);
    const singleYear = year && year !== 'all' && !isNaN(yr);

    // Make a string safe to use as a folder / file name inside the zip.
    const safe = (s, fallback) => {
        let v = String(s == null ? '' : s).trim()
            .replace(/[\/\\:*?"<>|]+/g, '_')   // illegal path chars
            .replace(/\s+/g, ' ')
            .replace(/\.+$/, '')               // no trailing dots (Windows)
            .trim();
        return v || fallback;
    };
    const extFromMime = (mime, fileType) => {
        const map = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
            'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp',
            'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
            'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/3gpp': '3gp'
        };
        if (mime && map[mime]) return map[mime];
        if (mime && mime.includes('/')) {
            const part = mime.split('/')[1].split(';')[0].trim();
            if (part) return part;
        }
        return fileType === 'video' ? 'mp4' : 'jpg';
    };

    try {
        // Metadata only (no blobs yet) so we know the folder structure.
        let where = 'institutionId = ?';
        const params = [instId];
        if (singleYear) { where += ' AND YEAR(event_date) = ?'; params.push(yr); }
        const [rows] = await db.execute(
            `SELECT id, title, file_type, mime_type, event_date,
                    YEAR(event_date) AS yr
               FROM gallery
              WHERE ${where}
              ORDER BY YEAR(event_date) DESC, event_date DESC, title, created_at`,
            params
        );

        const zipName = singleYear ? `Gallery_${yr}.zip` : 'Gallery_AllYears.zip';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 1 } }); // media is already compressed
        archive.on('warning', (err) => { if (err.code !== 'ENOENT') console.warn('archive warning:', err.message); });
        archive.on('error', (err) => {
            console.error('Gallery zip error:', err);
            try { res.destroy(err); } catch (_) {}
        });
        archive.pipe(res);

        if (rows.length === 0) {
            archive.append(
                'No media found for this selection.\n',
                { name: 'README.txt' }
            );
        } else {
            // Per-file counter so names never collide inside one folder.
            for (const r of rows) {
                const [mrows] = await db.execute(
                    'SELECT file_data, mime_type FROM gallery WHERE id = ?', [r.id]);
                if (!mrows.length || !mrows[0].file_data) continue;

                const album = safe(r.title, 'Untitled Album');
                const ext = extFromMime(mrows[0].mime_type || r.mime_type, r.file_type);
                const fileName = `${r.file_type === 'video' ? 'video' : 'photo'}-${r.id}.${ext}`;

                const folder = singleYear
                    ? album
                    : `${safe(r.yr, 'Unknown Year')}/${album}`;

                archive.append(mrows[0].file_data, { name: `${folder}/${fileName}` });
            }
        }

        await archive.finalize();
    } catch (err) {
        console.error('Gallery export failed:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else { try { res.end(); } catch (_) {} }
    }
});

// --- 19.3 Upload media -> store bytes in the DB ----------------------
app.post('/api/admin/gallery/upload', galleryUpload.single('media'), async (req, res) => {
    const institutionId = req.auth.institutionId;
    const adminId = req.auth.userId;
    const { title, event_date } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mime = req.file.mimetype || 'application/octet-stream';
    const file_type = mime.startsWith('image') ? 'photo' : 'video';

    try {
        let isNewAlbum = false;
        try {
            const [exist] = await db.execute(
                'SELECT COUNT(*) AS c FROM gallery WHERE institutionId = ? AND title = ?',
                [institutionId, title]
            );
            isNewAlbum = !exist.length || Number(exist[0].c) === 0;
        } catch (_) { isNewAlbum = false; }

        const [result] = await db.execute(
            `INSERT INTO gallery
               (institutionId, title, file_path, file_data, mime_type, file_type, event_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, null, req.file.buffer, mime, file_type, event_date, adminId]
        );

        if (isNewAlbum) {
            try {
                const recipients = await allActiveUserIds(institutionId);
                await createNotifications({
                    institutionId, recipientIds: recipients, type: 'gallery',
                    title: 'New gallery album', body: title,
                    link: 'Gallery', entity_id: result.insertId, actor_id: adminId
                });
            } catch (e) { console.warn('[notify gallery]', e.message); }
        }

        res.json({ success: true, insertId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 19.4 Stream a single media item (image OR video) ----------------
app.get('/api/admin/gallery/media/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT file_data, mime_type, file_type, institutionId FROM gallery WHERE id = ?',
            [req.params.id]
        );
        if (!rows.length || !rows[0].file_data) return res.status(404).send('Not found');
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).send('Forbidden');

        const data = rows[0].file_data;
        const mime = rows[0].mime_type || (rows[0].file_type === 'photo' ? 'image/jpeg' : 'video/mp4');
        const total = data.length;

        if (req.query.download) {
            const ext = mime.split('/')[1] || 'bin';
            res.setHeader('Content-Disposition', `attachment; filename="media-${req.params.id}.${ext}"`);
        }

        const range = req.headers.range;
        if (range) {
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
app.delete('/api/admin/gallery/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM gallery WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This item belongs to another institution.' });
        await db.execute('DELETE FROM gallery WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 19.6 Delete a whole album (Super Admin only) --------------------
app.delete('/api/admin/gallery/album/:instId/:title', async (req, res) => {
    if (req.auth.role !== 'Super Admin' && req.auth.role !== 'Developer') {
        return res.status(403).json({ error: "You don't have permission to delete albums." });
    }
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        await db.execute('DELETE FROM gallery WHERE institutionId = ? AND title = ?',
            [instId, req.params.title]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — HOMEWORK  (TENANT-SCOPED — NO academic-year scoping)
//   institutionId/actor from req.auth. Create/update require the class to
//   belong to your institution. Student read is institution + class
//   scoped. Submit = as yourself; submission delete = owner or staff;
//   grade = grader from token.
//
//   Academic-year logic has been REMOVED from Homework. The
//   `homework.academic_year_id` column is left NULL for new rows and
//   ignored on reads (every homework shows until it is deleted). No
//   migration needed; you may drop that column later if you wish.
// =====================================================================

// --- 19.1 List homework for a teacher/admin -------------------------
app.get('/api/admin/homework/teacher/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [users] = await db.execute(
            'SELECT id, role, institutionId FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        if (!sameTenant(req, me.institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        const baseSelect = `
            SELECT h.id, h.title, h.description, h.homework_type,
                   h.class_id, h.subject_id, h.teacher_id, h.due_date, h.questions,
                   h.created_by, h.created_at,
                   c.className, c.section,
                   sub.name AS subject_name,
                   u.name  AS created_by_name,
                   tu.name AS teacher_name,
                   (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id) AS submission_count
              FROM homework h
              LEFT JOIN classes  c   ON c.id = h.class_id
              LEFT JOIN subjects sub ON sub.id = h.subject_id
              LEFT JOIN users    u   ON u.id = h.created_by
              LEFT JOIN users    tu  ON tu.id = h.teacher_id`;

        let rows;
        if (isAdmin) {
            [rows] = await db.execute(
                `${baseSelect}
                  WHERE h.institutionId = ?`,
                [me.institutionId]);
        } else {
            [rows] = await db.execute(
                `${baseSelect}
                  WHERE h.created_by = ?`,
                [userId]);
        }
        const decorated = rows.map(r => ({
            ...r,
            questions: parseJsonSafe(r.questions, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        }));
        // Sort newest-created first in JS. Sorting in SQL here would make MySQL
        // filesort over the (potentially large) JSON columns and could overflow
        // the sort buffer ("Out of sort memory"). No sort buffer is used now.
        decorated.sort((a, b) => {
            const ta = new Date(a.created_at).getTime();
            const tb = new Date(b.created_at).getTime();
            return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
        });
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.2 List homework for a student -------------------------------
app.get('/api/admin/homework/student/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [u] = await db.execute(
            'SELECT institutionId, class_id FROM users WHERE id = ?', [studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!sameTenant(req, u[0].institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });
        if (!u[0].class_id) return res.json([]);

        const [rows] = await db.execute(
            `SELECT h.id, h.title, h.description, h.homework_type,
                    h.class_id, h.subject_id, h.due_date, h.questions, h.attachments,
                    h.created_at, h.created_by,
                    c.className, c.section, sub.name AS subject_name,
                    cu.name AS created_by_name,
                    s.id AS submission_id, s.written_answer, s.files AS submission_files,
                    s.submitted_at, s.grade, s.remarks
               FROM homework h
               LEFT JOIN classes  c   ON c.id = h.class_id
               LEFT JOIN subjects sub ON sub.id = h.subject_id
               LEFT JOIN users    cu  ON cu.id = h.created_by
               LEFT JOIN homework_submissions s
                      ON s.homework_id = h.id AND s.student_id = ?
              WHERE h.class_id = ? AND h.institutionId = ?`,
            [studentId, u[0].class_id, u[0].institutionId]
        );
        const decorated = rows.map(r => ({
            ...r,
            questions:        parseJsonSafe(r.questions, []),
            attachments:      parseJsonSafe(r.attachments, []),
            submission_files: parseJsonSafe(r.submission_files, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`,
            status: r.submission_id ? (r.grade ? 'Graded' : 'Submitted') : 'Pending'
        }));
        // Newest-due first, sorted in JS. This query returns big base64 columns
        // (homework attachments + submission files); doing ORDER BY in SQL made
        // MySQL filesort carry those huge values in the sort buffer and fail
        // with "Out of sort memory". Sorting here uses no sort buffer, so it
        // can't recur no matter how large the files get.
        decorated.sort((a, b) => {
            const ta = new Date(a.due_date).getTime();
            const tb = new Date(b.due_date).getTime();
            return (isNaN(tb) ? -Infinity : tb) - (isNaN(ta) ? -Infinity : ta);
        });
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.3 Single homework (with attachments) ------------------------
app.get('/api/admin/homework/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT h.*, c.className, c.section, sub.name AS subject_name,
                    tu.name AS teacher_name
               FROM homework h
               LEFT JOIN classes  c   ON c.id = h.class_id
               LEFT JOIN subjects sub ON sub.id = h.subject_id
               LEFT JOIN users    tu  ON tu.id = h.teacher_id
              WHERE h.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Homework not found' });
        const r = rows[0];
        if (!sameTenant(req, r.institutionId)) return res.status(403).json({ error: 'This homework belongs to another institution.' });
        res.json({
            ...r,
            questions:   parseJsonSafe(r.questions, []),
            attachments: parseJsonSafe(r.attachments, []),
            class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}`
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.4 Create homework (+ notify the class's active students) ----
app.post('/api/admin/homework', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    const {
        title, description, homework_type,
        class_id, subject_id, teacher_id, due_date, questions, attachments
    } = req.body;
    if (!title || !class_id || !due_date) {
        return res.status(400).json({ error: 'title, class_id and due_date are required.' });
    }
    try {
        const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
        if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
            return res.status(403).json({ error: 'That class belongs to another institution.' });
        }

        const [result] = await db.execute(
            `INSERT INTO homework
               (institutionId, title, description, homework_type,
                class_id, subject_id, teacher_id, due_date, questions, attachments, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, title, description || null, homework_type || 'PDF',
             class_id, subject_id || null, teacher_id || null, due_date,
             JSON.stringify(questions || []), JSON.stringify(attachments || []),
             created_by]
        );

        const recipients = await studentIdsForClass(class_id);
        await createNotifications({
            institutionId, recipientIds: recipients, type: 'homework',
            title: 'New homework assigned', body: title,
            link: 'Homework', entity_id: result.insertId, actor_id: created_by
        });

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.5 Update homework -------------------------------------------
app.put('/api/admin/homework/:id', async (req, res) => {
    const {
        title, description, homework_type,
        class_id, subject_id, teacher_id, due_date, questions, attachments
    } = req.body;
    try {
        const [own] = await db.execute('SELECT institutionId FROM homework WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Homework not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This homework belongs to another institution.' });
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }
        await db.execute(
            `UPDATE homework
                SET title = ?, description = ?, homework_type = ?, class_id = ?,
                    subject_id = ?, teacher_id = ?, due_date = ?, questions = ?, attachments = ?
              WHERE id = ?`,
            [title, description || null, homework_type || 'PDF', class_id,
             subject_id || null, teacher_id || null, due_date,
             JSON.stringify(questions || []), JSON.stringify(attachments || []),
             req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.6 Delete homework -------------------------------------------
app.delete('/api/admin/homework/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM homework WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This homework belongs to another institution.' });
        await db.execute('DELETE FROM homework WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.7 Roster of submissions for one homework (teacher view) -----
app.get('/api/admin/homework/:id/submissions', async (req, res) => {
    try {
        const [hw] = await db.execute(
            'SELECT class_id, institutionId FROM homework WHERE id = ?', [req.params.id]);
        if (hw.length === 0) return res.status(404).json({ error: 'Homework not found' });
        if (!sameTenant(req, hw[0].institutionId)) return res.status(403).json({ error: 'This homework belongs to another institution.' });

        const [rows] = await db.execute(
            `SELECT u.id AS student_id, u.name AS student_name, u.roll_no,
                    s.id AS submission_id, s.written_answer, s.files,
                    s.submitted_at, s.grade, s.remarks
               FROM users u
               LEFT JOIN homework_submissions s
                      ON s.student_id = u.id AND s.homework_id = ?
              WHERE u.class_id = ? AND LOWER(TRIM(u.role)) = 'student'
                AND (u.status IS NULL OR LOWER(TRIM(u.status)) = 'active')`,
            [req.params.id, hw[0].class_id]
        );
        // Roll-number order (numeric first, missing/non-numeric last), then
        // name — done in JS. This query returns each submission's base64 files;
        // sorting in SQL made MySQL filesort over them and could overflow the
        // sort buffer ("Out of sort memory"). No sort buffer is used now.
        const rollVal = (v) => {
            const n = parseInt(v, 10);
            return isNaN(n) ? Number.POSITIVE_INFINITY : n;
        };
        const decorated = rows
            .map(r => ({ ...r, files: parseJsonSafe(r.files, []) }))
            .sort((a, b) => {
                const ra = rollVal(a.roll_no), rb = rollVal(b.roll_no);
                if (ra !== rb) return ra - rb;
                return String(a.student_name || '').localeCompare(String(b.student_name || ''));
            });
        res.json(decorated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.8 Student submits (or resubmits) homework -------------------
app.post('/api/admin/homework/:id/submit', async (req, res) => {
    const { id } = req.params;
    const { written_answer, files } = req.body;
    const student_id = req.auth.userId;
    try {
        const [hw] = await db.execute('SELECT institutionId FROM homework WHERE id = ?', [id]);
        if (hw.length === 0) return res.status(404).json({ error: 'Homework not found' });
        if (!sameTenant(req, hw[0].institutionId)) return res.status(403).json({ error: 'This homework belongs to another institution.' });
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
        const [s] = await db.execute(
            `SELECT s.student_id, h.institutionId
               FROM homework_submissions s JOIN homework h ON h.id = s.homework_id
              WHERE s.id = ?`,
            [req.params.submissionId]);
        if (s.length === 0) return res.json({ success: true });
        if (!sameTenant(req, s[0].institutionId)) return res.status(403).json({ error: 'This submission belongs to another institution.' });
        const isOwner = String(s[0].student_id) === String(req.auth.userId);
        const isStudent = String(req.auth.role || '').toLowerCase() === 'student';
        if (isStudent && !isOwner) return res.status(403).json({ error: 'You can only delete your own submission.' });
        await db.execute('DELETE FROM homework_submissions WHERE id = ?', [req.params.submissionId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 19.10 Teacher grades a submission ------------------------------
app.put('/api/admin/homework/grade/:submissionId', async (req, res) => {
    const { grade, remarks } = req.body;
    const graded_by = req.auth.userId;
    try {
        const [s] = await db.execute(
            `SELECT h.institutionId
               FROM homework_submissions s JOIN homework h ON h.id = s.homework_id
              WHERE s.id = ?`,
            [req.params.submissionId]);
        if (s.length === 0) return res.status(404).json({ error: 'Submission not found' });
        if (!sameTenant(req, s[0].institutionId)) return res.status(403).json({ error: 'This submission belongs to another institution.' });
        await db.execute(
            `UPDATE homework_submissions
                SET grade = ?, remarks = ?, graded_by = ?, graded_at = ?
              WHERE id = ?`,
            [grade || null, remarks || null, graded_by, nowSQL(),
             req.params.submissionId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 20: MEALS  (TENANT-SCOPED)
//   institutionId/actor from req.auth. Slots are scoped by institutionId;
//   the weekly menu only writes to this institution's own slot ids
//   (slot_id is global and the menu's unique key is slot-based).
//
//   AUDIT: the weekly menu now records created_by + updated_by (and a
//   created_at) so EVERY user can see when the food menu was last updated
//   and by whom. Run meal_menu_add_audit.sql once. 20.1 returns a
//   `menuMeta` block with the latest update + first creation; 20.3 stamps
//   the acting user on every upsert.
// =====================================================================

// --- 20.1 Full meals data for a school ------------------------------
app.get('/api/admin/meals/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [slots] = await db.execute(
            'SELECT * FROM meal_slots WHERE institutionId = ? ORDER BY slot_order, id',
            [instId]
        );
        const [menu] = await db.execute(
            `SELECT m.id, m.slot_id, m.day_index, m.items,
                    m.created_at, m.updated_at,
                    cu.name AS created_by_name,
                    uu.name AS updated_by_name
               FROM meal_menu m
               LEFT JOIN users cu ON cu.id = m.created_by
               LEFT JOIN users uu ON uu.id = m.updated_by
              WHERE m.institutionId = ?`,
            [instId]
        );

        // Roll the per-cell audit up into one "last updated" + "first created"
        // for the whole menu (the UI shows a single line to every user).
        let lastUpdated = null, firstCreated = null;
        for (const r of menu) {
            if (r.updated_at &&
                (!lastUpdated || new Date(r.updated_at) > new Date(lastUpdated.at))) {
                lastUpdated = { at: r.updated_at, by: r.updated_by_name || null };
            }
            if (r.created_at &&
                (!firstCreated || new Date(r.created_at) < new Date(firstCreated.at))) {
                firstCreated = { at: r.created_at, by: r.created_by_name || null };
            }
        }

        res.json({ slots, menu, menuMeta: { lastUpdated, firstCreated } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 20.2 Save the school's meal slots ------------------------------
app.post('/api/admin/meals/slots', async (req, res) => {
    const { slots } = req.body;
    const institutionId = req.auth.institutionId;
    if (!Array.isArray(slots)) {
        return res.status(400).json({ error: 'slots[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const keepIds = slots.filter(s => s.id).map(s => parseInt(s.id, 10));
        const [existing] = await conn.execute(
            'SELECT id FROM meal_slots WHERE institutionId = ?', [institutionId]);

        for (const row of existing) {
            if (!keepIds.includes(row.id)) {
                await conn.execute('DELETE FROM meal_slots WHERE id = ?', [row.id]);
            }
        }

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


// --- 20.3 Save the weekly menu (+ notify all active users) ----------
//   Every upserted cell is stamped with the acting user:
//     • new cell  -> created_by = updated_by = actor
//     • edited    -> updated_by = actor (created_by/created_at untouched)
app.post('/api/admin/meals/menu', async (req, res) => {
    const { entries } = req.body;
    const institutionId = req.auth.institutionId;
    const actor_id = req.auth.userId;
    if (!Array.isArray(entries)) {
        return res.status(400).json({ error: 'entries[] required.' });
    }
    const conn = await db.getConnection();
    try {
        // slot_id is a global id; only let this school write to its own slots.
        const [vSlot] = await conn.execute('SELECT id FROM meal_slots WHERE institutionId = ?', [institutionId]);
        const slotOk = new Set(vSlot.map(r => r.id));

        await conn.beginTransaction();
        for (const e of entries) {
            if (!e.slot_id || e.day_index === undefined || e.day_index === null) continue;
            if (!slotOk.has(Number(e.slot_id))) continue;
            const items = (e.items || '').trim();
            if (items === '') {
                await conn.execute(
                    'DELETE FROM meal_menu WHERE slot_id = ? AND day_index = ?',
                    [e.slot_id, e.day_index]
                );
            } else {
                await conn.execute(
                    `INSERT INTO meal_menu (institutionId, slot_id, day_index, items, created_by, updated_by)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE items = VALUES(items),
                                             updated_by = VALUES(updated_by)`,
                    [institutionId, e.slot_id, e.day_index, items, actor_id, actor_id]
                );
            }
        }
        await conn.commit();

        try {
            const recipients = await allActiveUserIds(institutionId);
            await createNotifications({
                institutionId, recipientIds: recipients, type: 'meals',
                title: 'Food menu updated',
                body: 'The weekly food menu has been updated.',
                link: 'Meals', entity_id: null, actor_id
            });
        } catch (e) { console.warn('[notify meals]', e.message); }

        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});



// =====================================================================
// === 21. PARENT TEACHER MEETINGS (PTM)  (TENANT-SCOPED) ==============
//   List uses identity from the token; create/update take institutionId
//   + actor from the token; update/delete verify ownership. The recipient
//   helper is institution-filtered, so a stray class_id can't reach
//   another school.
//
//   List queries now also join the creator so the UI can show
//   "Created by <name>" + creation time (created_at, IST rendered
//   client-side). No migration needed — created_by / created_at already
//   exist on ptm_meetings.
// =====================================================================

async function ptmRecipientIds(institutionId, classId, section) {
    if (!institutionId) return [];
    let sql = `SELECT id FROM users
                WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
                  AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`;
    const params = [institutionId];
    if (classId) { sql += ' AND class_id = ?'; params.push(classId); }
    if (section) { sql += ' AND section = ?'; params.push(section); }
    const [rows] = await db.execute(sql, params);
    return rows.map(r => r.id);
}

// --- 21.1 List PTMs for a School (Admin/Teacher view) ---
app.get('/api/admin/ptm/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const userId = req.auth.userId;
    const userRole = req.auth.role;
    try {
        const isSystemAdmin = (userRole === 'Super Admin' || userRole === 'Developer' || userRole === 'Admin');

        let sql, params;
        if (isSystemAdmin) {
            sql = `SELECT p.*, c.className, t.name AS teacher_name, cb.name AS created_by_name
                     FROM ptm_meetings p
                     LEFT JOIN classes c ON c.id = p.class_id
                     LEFT JOIN users t ON t.id = p.teacher_id
                     LEFT JOIN users cb ON cb.id = p.created_by
                    WHERE p.institutionId = ?
                    ORDER BY p.meeting_datetime DESC`;
            params = [instId];
        } else {
            sql = `SELECT p.*, c.className, t.name AS teacher_name, cb.name AS created_by_name
                     FROM ptm_meetings p
                     LEFT JOIN classes c ON c.id = p.class_id
                     LEFT JOIN users t ON t.id = p.teacher_id
                     LEFT JOIN users cb ON cb.id = p.created_by
                    WHERE p.institutionId = ? AND p.teacher_id = ?
                    ORDER BY p.meeting_datetime DESC`;
            params = [instId, userId];
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
        if (!sameTenant(req, institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });

        const [rows] = await db.execute(
            `SELECT p.*, c.className, t.name AS teacher_name, cb.name AS created_by_name
               FROM ptm_meetings p
               LEFT JOIN classes c ON c.id = p.class_id
               LEFT JOIN users t ON t.id = p.teacher_id
               LEFT JOIN users cb ON cb.id = p.created_by
              WHERE p.institutionId = ?
                AND (p.class_id IS NULL OR p.class_id = ?)
                AND (p.section IS NULL OR p.section = ?)
              ORDER BY p.meeting_datetime DESC`,
            [institutionId, class_id || 0, section || '']
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.3 Create PTM (+ notify targeted students) ---
app.post('/api/admin/ptm', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    const {
        meeting_datetime, teacher_id, class_id,
        section, subject_focus, notes, meeting_link, status
    } = req.body;

    if (!meeting_datetime || !teacher_id || !subject_focus) {
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
                status || 'Scheduled', created_by
            ]
        );

        try {
            const recipients = await ptmRecipientIds(institutionId, class_id || null, section || null);
            await createNotifications({
                institutionId, recipientIds: recipients, type: 'ptm',
                title: 'Parent-teacher meeting scheduled',
                body: subject_focus || 'A PTM has been scheduled.',
                link: 'PTM', entity_id: result.insertId, actor_id: created_by
            });
        } catch (e) { console.warn('[notify ptm]', e.message); }

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.4 Update PTM (+ re-notify; time may have changed) ---
app.put('/api/admin/ptm/:id', async (req, res) => {
    const {
        meeting_datetime, teacher_id, class_id, section,
        subject_focus, notes, meeting_link, status
    } = req.body;
    const actor_id = req.auth.userId;
    try {
        const [own] = await db.execute('SELECT institutionId FROM ptm_meetings WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Meeting not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This meeting belongs to another institution.' });

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

        try {
            const instId = own[0].institutionId;
            const recipients = await ptmRecipientIds(instId, class_id || null, section || null);
            await createNotifications({
                institutionId: instId, recipientIds: recipients, type: 'ptm',
                title: 'PTM updated',
                body: subject_focus || 'A PTM has been updated.',
                link: 'PTM', entity_id: req.params.id, actor_id
            });
        } catch (e) { console.warn('[notify ptm]', e.message); }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.5 Delete PTM ---
app.delete('/api/admin/ptm/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM ptm_meetings WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This meeting belongs to another institution.' });
        await db.execute('DELETE FROM ptm_meetings WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});




// =====================================================================
// === 22. ONLINE CLASSES  (TENANT-SCOPED) =============================
//   List uses identity from token; create/update take institutionId +
//   actor from token and require the class (when given) to be yours;
//   update/delete verify ownership; video stream verifies tenant.
//
//   List queries also join the creator so the UI can show
//   "Created by <name>" + creation time (created_at, IST rendered
//   client-side). No migration needed — created_by / created_at already
//   exist on online_classes. (created_by is the scheduler for a live class
//   and the uploader for a recorded one.)
//
//   ⚠ online-classes/video/:id is under the /api auth gate — only works if
//     the frontend FETCHES it (token via interceptor) and renders a blob.
// =====================================================================

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

async function onlineClassRecipientIds(institutionId, classId) {
    if (classId) return studentIdsForClass(classId);
    if (!institutionId) return [];
    const [rows] = await db.execute(
        `SELECT id FROM users
          WHERE institutionId = ? AND LOWER(TRIM(role)) = 'student'
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`,
        [institutionId]
    );
    return rows.map(r => r.id);
}

// --- 22.1 List Classes for Admin/Teacher ---
app.get('/api/admin/online-classes/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const userId = req.auth.userId;
    const roleName = req.auth.role;
    try {
        const isSystemAdmin = (roleName === 'Super Admin' || roleName === 'Developer');

        const query = isSystemAdmin
            ? `SELECT o.id, o.title, o.class_type, o.class_id, o.subject_id, o.teacher_id,
                       o.class_datetime, o.meet_link, o.topic, o.description, o.created_by, o.created_at,
                       IF(o.video_data IS NOT NULL, 1, 0) as has_video_data,
                       c.className, c.section, s.name AS subject_name, t.name AS teacher_name,
                       cb.name AS created_by_name
                  FROM online_classes o
                  LEFT JOIN classes c ON c.id = o.class_id
                  LEFT JOIN subjects s ON s.id = o.subject_id
                  LEFT JOIN users t ON t.id = o.teacher_id
                  LEFT JOIN users cb ON cb.id = o.created_by
                 WHERE o.institutionId = ?
                 ORDER BY o.class_datetime DESC`
            : `SELECT o.id, o.title, o.class_type, o.class_id, o.subject_id, o.teacher_id,
                       o.class_datetime, o.meet_link, o.topic, o.description, o.created_by, o.created_at,
                       IF(o.video_data IS NOT NULL, 1, 0) as has_video_data,
                       c.className, c.section, s.name AS subject_name, t.name AS teacher_name,
                       cb.name AS created_by_name
                  FROM online_classes o
                  LEFT JOIN classes c ON c.id = o.class_id
                  LEFT JOIN subjects s ON s.id = o.subject_id
                  LEFT JOIN users t ON t.id = o.teacher_id
                  LEFT JOIN users cb ON cb.id = o.created_by
                 WHERE o.institutionId = ? AND o.created_by = ?
                 ORDER BY o.class_datetime DESC`;

        const params = isSystemAdmin ? [instId] : [instId, userId];
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.2 List Classes for Student ---
app.get('/api/admin/online-classes/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0) return res.status(404).json({ error: 'Student not found' });
        if (!sameTenant(req, u[0].institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });

        const [rows] = await db.execute(
            `SELECT o.id, o.title, o.class_type, o.class_id, o.subject_id, o.teacher_id,
                    o.class_datetime, o.meet_link, o.topic, o.description, o.created_by, o.created_at,
                    IF(o.video_data IS NOT NULL, 1, 0) as has_video_data,
                    c.className, c.section, s.name AS subject_name, t.name AS teacher_name,
                    cb.name AS created_by_name
               FROM online_classes o
               LEFT JOIN classes c ON c.id = o.class_id
               LEFT JOIN subjects s ON s.id = o.subject_id
               LEFT JOIN users t ON t.id = o.teacher_id
               LEFT JOIN users cb ON cb.id = o.created_by
              WHERE o.institutionId = ? AND (o.class_id IS NULL OR o.class_id = ?)
              ORDER BY o.class_datetime DESC`,
            [u[0].institutionId, u[0].class_id || 0]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.3 Stream Video Bytes from DB ---
app.get('/api/admin/online-classes/video/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT video_data, mime_type, institutionId FROM online_classes WHERE id = ?', [req.params.id]);
        if (!rows.length || !rows[0].video_data) return res.status(404).send('Not found');
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).send('Forbidden');

        const data = rows[0].video_data;
        const mime = rows[0].mime_type || 'video/mp4';
        const total = data.length;

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
            const chunk = data.slice(start, end + 1);
            res.status(206).set({
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunk.length,
                'Content-Type': mime,
            });
            return res.end(chunk);
        }
        res.set({ 'Content-Length': total, 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
        return res.end(data);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 22.4 Create Class (+ notify students) ---
app.post('/api/admin/online-classes', memoryUpload.single('videoFile'), async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    const { title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, topic, description } = req.body;
    try {
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }
        const [result] = await db.execute(
            `INSERT INTO online_classes
               (institutionId, title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, video_data, mime_type, topic, description, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                institutionId, title, class_type, class_id || null, subject_id, teacher_id,
                class_datetime, meet_link || null, req.file ? req.file.buffer : null,
                req.file ? req.file.mimetype : null, topic || null, description || null, created_by
            ]
        );

        const recipients = await onlineClassRecipientIds(institutionId, class_id || null);
        await createNotifications({
            institutionId, recipientIds: recipients, type: 'online_class',
            title: 'New online class scheduled', body: title,
            link: 'OnlineClasses', entity_id: result.insertId, actor_id: created_by
        });

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.5 Update Class (+ re-notify students; time/link may have changed) ---
app.put('/api/admin/online-classes/:id', memoryUpload.single('videoFile'), async (req, res) => {
    const { title, class_type, class_id, subject_id, teacher_id, class_datetime, meet_link, topic, description, clear_video } = req.body;
    const actor_id = req.auth.userId;
    try {
        const [own] = await db.execute('SELECT institutionId FROM online_classes WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Class not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }

        let sql = `UPDATE online_classes SET title=?, class_type=?, class_id=?, subject_id=?, teacher_id=?, class_datetime=?, meet_link=?, topic=?, description=?`;
        let params = [title, class_type, class_id || null, subject_id, teacher_id, class_datetime, meet_link || null, topic || null, description || null];

        if (req.file) {
            sql += `, video_data=?, mime_type=?`;
            params.push(req.file.buffer, req.file.mimetype);
        } else if (clear_video === 'true') {
            sql += `, video_data=NULL, mime_type=NULL`;
        }

        sql += ` WHERE id=?`;
        params.push(req.params.id);

        await db.execute(sql, params);

        const instId = own[0].institutionId;
        const recipients = await onlineClassRecipientIds(instId, class_id || null);
        await createNotifications({
            institutionId: instId, recipientIds: recipients, type: 'online_class',
            title: 'Online class updated', body: title,
            link: 'OnlineClasses', entity_id: req.params.id, actor_id
        });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22.6 Delete Class ---
app.delete('/api/admin/online-classes/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM online_classes WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This class belongs to another institution.' });
        await db.execute('DELETE FROM online_classes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
// === 21. DIGITAL LABS  (TENANT-SCOPED) ===============================
//   institutionId/actor from token; create/update require the class to be
//   yours and (on edit) the lab to be yours; student read is institution-
//   filtered; resource stream verifies tenant via the parent lab; delete
//   verifies ownership. (lab_resources.url-nullable migration unchanged.)
//
//   AUDIT: labs now track created_by + updated_by (with created_at /
//   updated_at) so the UI can show "Created by ..." and "Updated by ..."
//   with times. Run digital_labs_add_updated.sql once. Every read query
//   returns both names + timestamps; the create/update endpoint stamps
//   the acting user on the lab row.
//
//   ⚠ labs/resource/:id is under the /api auth gate — only works if the
//     frontend FETCHES it (token via interceptor) and renders a blob.
// =====================================================================

const labUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// --- 21.1 List labs for a teacher/admin ---
app.get('/api/admin/labs/teacher/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [users] = await db.execute('SELECT id, role, institutionId FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const me = users[0];
        if (!sameTenant(req, me.institutionId)) return res.status(403).json({ error: 'This user belongs to another institution.' });
        const isAdmin = me.role === 'Super Admin' || me.role === 'Developer';

        const baseSelect = `
            SELECT l.id, l.title, l.description, l.class_id, l.subject_id,
                   l.created_by, l.created_at, l.updated_by, l.updated_at,
                   c.className, c.section,
                   sub.name AS subject_name,
                   u.name  AS created_by_name,
                   uu.name AS updated_by_name,
                   (SELECT COUNT(*) FROM lab_resources r WHERE r.lab_id = l.id) AS resource_count
              FROM digital_labs l
              LEFT JOIN classes  c  ON c.id = l.class_id
              LEFT JOIN subjects sub ON sub.id = l.subject_id
              LEFT JOIN users    u  ON u.id = l.created_by
              LEFT JOIN users    uu ON uu.id = l.updated_by`;

        let rows;
        if (isAdmin) {
            [rows] = await db.execute(`${baseSelect} WHERE l.institutionId = ? ORDER BY l.created_at DESC`, [me.institutionId]);
        } else {
            [rows] = await db.execute(`${baseSelect} WHERE l.created_by = ? ORDER BY l.created_at DESC`, [userId]);
        }
        res.json(rows.map(r => ({ ...r, class_group: `${r.className || ''}${r.section ? ' - ' + r.section : ''}` })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.2 List labs for a student ---
app.get('/api/admin/labs/student/:studentId', async (req, res) => {
    try {
        const [u] = await db.execute('SELECT institutionId, class_id FROM users WHERE id = ?', [req.params.studentId]);
        if (u.length === 0 || !u[0].class_id) return res.json([]);
        if (!sameTenant(req, u[0].institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });

        const [labs] = await db.execute(
            `SELECT l.*, sub.name AS subject_name,
                    usr.name AS created_by_name, uu.name AS updated_by_name
               FROM digital_labs l
               LEFT JOIN subjects sub ON sub.id = l.subject_id
               LEFT JOIN users usr ON usr.id = l.created_by
               LEFT JOIN users uu  ON uu.id = l.updated_by
              WHERE l.class_id = ? AND l.institutionId = ? ORDER BY l.created_at DESC`,
            [u[0].class_id, u[0].institutionId]);

        if (labs.length === 0) return res.json([]);

        const labIds = labs.map(l => l.id);
        const [resources] = await db.execute(
            `SELECT id, lab_id, resource_type, title, url, IF(file_data IS NOT NULL, 1, 0) as has_file
               FROM lab_resources WHERE lab_id IN (${labIds.map(() => '?').join(',')})`, labIds);

        res.json(labs.map(l => ({ ...l, resources: resources.filter(r => r.lab_id === l.id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 21.3 Stream Resource File (Video/PDF) ---
app.get('/api/admin/labs/resource/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT r.file_data, r.mime_type, l.institutionId
               FROM lab_resources r JOIN digital_labs l ON l.id = r.lab_id
              WHERE r.id = ?`, [req.params.id]);
        if (!rows.length || !rows[0].file_data) return res.status(404).send('Not found');
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).send('Forbidden');

        const data = rows[0].file_data;
        const mime = rows[0].mime_type || 'application/octet-stream';

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', data.length);
        res.send(data);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 21.4 Create/Update Lab (Multipart via Multer) ---
app.post('/api/admin/labs', labUpload.any(), async (req, res) => {
    const institutionId = req.auth.institutionId;
    const actor_id = req.auth.userId;                 // creator / last-updater from token
    const { id, title, description, class_id, subject_id, resources: resourcesRaw } = req.body;

    // Ownership + class guards run on the pool BEFORE we take a transaction
    // connection, so there's no transaction/connection to leak on a 403.
    try {
        if (class_id) {
            const [cc] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (cc.length === 0 || !sameTenant(req, cc[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }
        if (id) {
            const [lo] = await db.execute('SELECT institutionId FROM digital_labs WHERE id = ?', [id]);
            if (lo.length === 0) return res.status(404).json({ error: 'Lab not found' });
            if (!sameTenant(req, lo[0].institutionId)) return res.status(403).json({ error: 'This lab belongs to another institution.' });
        }
    } catch (err) { return res.status(500).json({ error: err.message }); }

    const resources = JSON.parse(resourcesRaw || '[]');
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();
        let labId = id;
        let existingResources = [];

        if (id) {
            await conn.execute(
                `UPDATE digital_labs
                    SET title=?, description=?, class_id=?, subject_id=?,
                        updated_by=?, updated_at=CURRENT_TIMESTAMP
                  WHERE id=?`,
                [title, description, class_id, subject_id || null, actor_id, id]
            );

            const [oldRes] = await conn.execute(
                'SELECT id, file_data, mime_type FROM lab_resources WHERE lab_id=?',
                [id]
            );
            existingResources = oldRes;

            await conn.execute('DELETE FROM lab_resources WHERE lab_id=?', [id]);
        } else {
            const [resData] = await conn.execute(
                `INSERT INTO digital_labs (institutionId, title, description, class_id, subject_id, created_by, updated_by)
                 VALUES (?,?,?,?,?,?,?)`,
                [institutionId, title, description, class_id, subject_id || null, actor_id, actor_id]
            );
            labId = resData.insertId;
        }

        for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            const file = req.files && req.files.find(f => f.fieldname === `file_${i}`);
            const oldResource = existingResources.find(old => String(old.id) === String(r.id));

            let finalBuffer = null;
            let finalMime = null;

            if (file) {
                finalBuffer = file.buffer;
                finalMime = file.mimetype;
            } else if (oldResource && r.source === 'file') {
                finalBuffer = oldResource.file_data;
                finalMime = oldResource.mime_type;
            }

            await conn.execute(
                `INSERT INTO lab_resources (lab_id, resource_type, title, url, file_data, mime_type, scheduled_at, resource_order) VALUES (?,?,?,?,?,?,?,?)`,
                [labId, r.resource_type, r.title, r.url || null, finalBuffer, finalMime, r.scheduled_at || null, i]
            );
        }

        {
            const recipients = await studentIdsForClass(class_id);
            await createNotifications({
                institutionId, recipientIds: recipients, type: 'lab',
                title: id ? 'Digital lab updated' : 'New digital lab posted',
                body: title,
                link: 'DigitalLabs', entity_id: labId, actor_id
            }, conn);
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- 21.5 Get Single Lab Details ---
app.get('/api/admin/labs/:id', async (req, res) => {
    try {
        const labId = req.params.id;

        const [labs] = await db.execute(
            `SELECT l.*, sub.name AS subject_name,
                    usr.name AS created_by_name, uu.name AS updated_by_name,
                    c.className, c.section
             FROM digital_labs l
             LEFT JOIN subjects sub ON sub.id = l.subject_id
             LEFT JOIN users usr ON usr.id = l.created_by
             LEFT JOIN users uu  ON uu.id = l.updated_by
             LEFT JOIN classes c ON c.id = l.class_id
             WHERE l.id = ?`,
            [labId]
        );

        if (labs.length === 0) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        const lab = labs[0];
        if (!sameTenant(req, lab.institutionId)) return res.status(403).json({ error: 'This lab belongs to another institution.' });

        const [resources] = await db.execute(
            `SELECT id, lab_id, resource_type, title, url, scheduled_at, resource_order,
                    IF(file_data IS NOT NULL, 1, 0) as has_file
             FROM lab_resources
             WHERE lab_id = ?
             ORDER BY resource_order ASC`,
            [labId]
        );

        lab.resources = resources;
        res.json(lab);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 21.6 Delete Lab ---
app.delete('/api/admin/labs/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const [own] = await conn.execute('SELECT institutionId FROM digital_labs WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This lab belongs to another institution.' });
        await conn.beginTransaction();
        await conn.execute('DELETE FROM lab_resources WHERE lab_id = ?', [req.params.id]);
        await conn.execute('DELETE FROM digital_labs WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});



// =====================================================================
// === 23. ADMISSIONS — Pre-Admissions  (TENANT-SCOPED) ====
//   instId/userId/role from req.auth; create takes institutionId + the
//   creator from the token; update/delete verify ownership. Calendar-year
//   filter unchanged.
//
//   AUDIT (needs preadmissions_add_audit.sql once — created_by, verified_by,
//   verified_at):
//     • created_by  — stamped on create (the user who entered the form) and
//       BACKFILLED on the first edit of a legacy row (so old rows stop
//       showing a blank name).
//     • verified_by / verified_at — stamped by the PUT when status moves to
//       Approved or Rejected; cleared if it moves back to Pending.
//   submission_date remains the "created at" time. List + export surface
//   created_by_name / verified_by_name.
// =====================================================================

// --- 23.0 Distinct submission years (for the year-filter dropdown) ---
app.get('/api/admin/preadmissions/:instId/years', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [rows] = await db.query(
            `SELECT DISTINCT YEAR(submission_date) AS yr
               FROM pre_admissions
              WHERE institutionId = ? AND submission_date IS NOT NULL
              ORDER BY yr DESC`,
            [instId]
        );
        res.status(200).json(rows.map(r => r.yr).filter(Boolean));
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch submission years." });
    }
});

// --- 23.1 GET all records (Secured, calendar-year scoped) -----------
app.get('/api/admin/preadmissions/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { search, year } = req.query;
    const roleName = req.auth.role;
    try {
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
        let whereClauses = ["pa.institutionId = ?"];
        const queryParams = [instId];
        const yr = parseInt(year, 10);
        if (year && year !== 'all' && !isNaN(yr)) {
            whereClauses.push("YEAR(pa.submission_date) = ?");
            queryParams.push(yr);
        }
        if (search) {
            whereClauses.push("(pa.student_name LIKE ? OR pa.admission_no LIKE ? OR pa.previous_institute LIKE ?)");
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }
        const query = `
            SELECT pa.*,
                   cu.name AS created_by_name,
                   vu.name AS verified_by_name
              FROM pre_admissions pa
              LEFT JOIN users cu ON cu.id = pa.created_by
              LEFT JOIN users vu ON vu.id = pa.verified_by
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY pa.submission_date DESC
             LIMIT 1000`;
        const [records] = await db.query(query, queryParams);
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch admission records." });
    }
});

// --- 23.5 Export the list to Excel ----------------------------------
//   ?year=YYYY -> only that submission year (one section).
//   ?year=all  -> every year, grouped under a heading per year.
app.get('/api/admin/preadmissions/:instId/export', async (req, res) => {
    const ExcelJS = require('exceljs'); // local require avoids any top-level name clash
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const roleName = req.auth.role;
    const { year } = req.query;
    try {
        // Same read-permission gate as the list route.
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
        let whereClauses = ["pa.institutionId = ?"];
        const queryParams = [instId];
        const yr = parseInt(year, 10);
        const singleYear = year && year !== 'all' && !isNaN(yr);
        if (singleYear) { whereClauses.push("YEAR(pa.submission_date) = ?"); queryParams.push(yr); }
        const sql = `SELECT pa.*, YEAR(pa.submission_date) AS cal_year,
                            cu.name AS created_by_name,
                            vu.name AS verified_by_name
                       FROM pre_admissions pa
                       LEFT JOIN users cu ON cu.id = pa.created_by
                       LEFT JOIN users vu ON vu.id = pa.verified_by
                      WHERE ${whereClauses.join(' AND ')}
                      ORDER BY YEAR(pa.submission_date) DESC, pa.student_name`;
        const [rows] = await db.query(sql, queryParams);
        // Column order for the sheet. photo_url is a base64 image -> omitted.
        const columns = [
            { header: 'Student Name',          width: 24 },
            { header: 'Admission No',          width: 16 },
            { header: 'Joining Grade',         width: 14 },
            { header: 'Status',                width: 12 },
            { header: 'Date of Birth',         width: 14 },
            { header: 'Student Phone',         width: 16 },
            { header: 'Pen No',                width: 14 },
            { header: 'Aadhar No',             width: 16 },
            { header: 'Parent Name',           width: 20 },
            { header: 'Parent Phone',          width: 16 },
            { header: 'Previous Institute',    width: 26 },
            { header: 'Previous Grade',        width: 14 },
            { header: 'School Joined Date',    width: 16 },
            { header: 'School Joined Grade',   width: 16 },
            { header: 'School Outgoing Date',  width: 18 },
            { header: 'School Outgoing Grade', width: 18 },
            { header: 'TC Issued Date',        width: 14 },
            { header: 'TC Number',             width: 14 },
            { header: 'Address',               width: 30 },
            { header: 'Created At',            width: 18 },
            { header: 'Created By',            width: 20 },
            { header: 'Verified By',           width: 20 },
            { header: 'Verified At',           width: 18 },
        ];
        const NCOLS = columns.length;
        const dmy = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const p = (n) => String(n).padStart(2, '0');
            return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
        };
        // IST date-time for audit stamps (Railway stores UTC).
        const istDT = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            return dt.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        };
        const rowValues = (r) => ([
            r.student_name || '', r.admission_no || '', r.joining_grade || '', r.status || '',
            dmy(r.dob), r.phone_no || '', r.pen_no || '', r.aadhar_no || '',
            r.parent_name || '', r.parent_phone || '', r.previous_institute || '',
            r.previous_grade || '', dmy(r.school_joined_date), r.school_joined_grade || '',
            dmy(r.school_outgoing_date), r.school_outgoing_grade || '', dmy(r.tc_issued_date),
            r.tc_number || '', r.address || '',
            istDT(r.submission_date), r.created_by_name || '',
            r.verified_by_name || '', istDT(r.verified_at)
        ]);
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz';
        wb.created = new Date();
        const ws = wb.addWorksheet('Pre-Admissions');
        ws.columns = columns.map(c => ({ width: c.width })); // widths only, no auto header row
        const PRIMARY = 'FF3284C7';
        const ACCENT  = 'FFF29132';
        const addTitleRow = (text) => {
            const row = ws.addRow([text]);
            ws.mergeCells(row.number, 1, row.number, NCOLS);
            const cell = row.getCell(1);
            cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            row.height = 24;
        };
        const addYearHeading = (text) => {
            const row = ws.addRow([text]);
            ws.mergeCells(row.number, 1, row.number, NCOLS);
            const cell = row.getCell(1);
            cell.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FA' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            row.height = 20;
        };
        const addColumnHeader = () => {
            const row = ws.addRow(columns.map(c => c.header));
            row.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
                cell.alignment = { vertical: 'middle' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFB8CCE0' } } };
            });
            row.height = 18;
        };
        const addDataRow = (r) => {
            const row = ws.addRow(rowValues(r));
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'top', wrapText: false };
                cell.font = { size: 10, color: { argb: 'FF27272A' } };
            });
        };
        const scopeLabel = singleYear ? `Year ${yr}` : 'All Years';
        addTitleRow(`Pre-Admissions — ${scopeLabel}`);
        ws.addRow([]); // spacer
        if (rows.length === 0) {
            const r = ws.addRow(['No applications found for this selection.']);
            ws.mergeCells(r.number, 1, r.number, NCOLS);
            r.getCell(1).font = { italic: true, color: { argb: 'FF71717A' } };
        } else if (singleYear) {
            addColumnHeader();
            rows.forEach(addDataRow);
        } else {
            let currentYear = null;
            let first = true;
            for (const r of rows) {
                if (r.cal_year !== currentYear) {
                    currentYear = r.cal_year;
                    if (!first) ws.addRow([]);
                    first = false;
                    const groupRows = rows.filter(x => x.cal_year === currentYear).length;
                    addYearHeading(`Year ${currentYear || '—'}  (${groupRows} applications)`);
                    addColumnHeader();
                }
                addDataRow(r);
            }
        }
        const safeScope = singleYear ? String(yr) : 'AllYears';
        const filename = `PreAdmissions_${safeScope}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Pre-admissions export failed:', error);
        if (!res.headersSent) res.status(500).json({ message: "Failed to export records." });
        else res.end();
    }
});

// --- 23.2 POST new record (creator from token) ----------------------
app.post('/api/admin/preadmissions', async (req, res) => {
    const fields = req.body;
    fields.institutionId = req.auth.institutionId; // tenant from token
    const created_by = req.auth.userId;            // creator from token
    if (!fields.admission_no || !fields.student_name || !fields.joining_grade) {
        return res.status(400).json({ message: "Admission No, Name, and Grade are required." });
    }

    // If created already decided (Approved/Rejected), the creator is also the
    // verifier at creation time.
    const startStatus = fields.status || 'Pending';
    const decided = (startStatus === 'Approved' || startStatus === 'Rejected');
    const verified_by = decided ? created_by : null;
    const verified_at = decided ? new Date() : null;

    const query = `
        INSERT INTO pre_admissions (
            institutionId, admission_no, student_name, photo_url, dob, pen_no, phone_no, aadhar_no,
            parent_name, parent_phone, previous_institute, previous_grade, joining_grade,
            school_joined_date, school_joined_grade, school_outgoing_date, school_outgoing_grade,
            tc_issued_date, tc_number, address, status, created_by, verified_by, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const v = (val) => (val === '' || val === 'null' || val === undefined ? null : val);
    const params = [
        fields.institutionId,
        fields.admission_no,
        fields.student_name,
        fields.photo_url || null,
        v(fields.dob),
        v(fields.pen_no),
        v(fields.phone_no),
        v(fields.aadhar_no),
        v(fields.parent_name),
        v(fields.parent_phone),
        v(fields.previous_institute),
        v(fields.previous_grade),
        fields.joining_grade,
        v(fields.school_joined_date),
        v(fields.school_joined_grade),
        v(fields.school_outgoing_date),
        v(fields.school_outgoing_grade),
        v(fields.tc_issued_date),
        v(fields.tc_number),
        v(fields.address),
        startStatus,
        created_by,
        verified_by,
        verified_at
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

// --- 23.3 PUT update record (ownership; backfill creator; stamp verifier) --
app.put('/api/admin/preadmissions/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let setClauses = [];
    let params = [];
    const updatableFields = [
        'admission_no', 'student_name', 'photo_url', 'dob', 'pen_no', 'phone_no', 'aadhar_no',
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
    try {
        const [own] = await db.execute('SELECT institutionId, status, created_by FROM pre_admissions WHERE id = ?', [id]);
        if (own.length === 0) return res.status(404).json({ message: "Record not found." });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ message: "This record belongs to another institution." });

        // Backfill the creator on the first edit of a legacy row (one created
        // before created_by existed) so the name shows instead of "—".
        // Only sets it when currently NULL — never overwrites a real creator.
        if (own[0].created_by === null || own[0].created_by === undefined) {
            setClauses.push('created_by = ?');
            params.push(req.auth.userId);
        }

        // Verifier stamping: only when the status is part of this update.
        // Moving to Approved/Rejected records who decided + when; moving back
        // to Pending clears the verification.
        if (fields.status !== undefined) {
            const newStatus = fields.status;
            const prevStatus = own[0].status;
            if ((newStatus === 'Approved' || newStatus === 'Rejected') && newStatus !== prevStatus) {
                setClauses.push('verified_by = ?'); params.push(req.auth.userId);
                setClauses.push('verified_at = ?'); params.push(new Date());
            } else if (newStatus === 'Pending') {
                setClauses.push('verified_by = ?'); params.push(null);
                setClauses.push('verified_at = ?'); params.push(null);
            }
        }

        if (setClauses.length === 0) return res.status(400).json({ message: "No fields to update." });

        const query = `UPDATE pre_admissions SET ${setClauses.join(', ')} WHERE id = ?`;
        params.push(id);
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found." });
        res.status(200).json({ message: "Updated successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to update record." });
    }
});

// --- 23.4 DELETE record (ownership) ---------------------------------
app.delete('/api/admin/preadmissions/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM pre_admissions WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ message: "Record not found." });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ message: "This record belongs to another institution." });
        const [result] = await db.query("DELETE FROM pre_admissions WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found." });
        res.status(200).json({ message: "Deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete record." });
    }
});



// =====================================================================
// === 24. STUDY MATERIALS  (TENANT-SCOPED) ============================
//   instId/userId/role/uploader from req.auth; create/update require the
//   class (when given) to be yours; student read is institution-filtered;
//   update/delete verify ownership.
// =====================================================================

// --- 24.1 List Materials (Admin/Teacher) ---
app.get('/api/admin/study-materials/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const userId = req.auth.userId;
    const roleName = req.auth.role;
    try {
        const isSystemAdmin = (roleName === 'Super Admin' || roleName === 'Developer');

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

        let query = `
            SELECT m.*, c.className, c.section, s.name AS subject_name, u.name AS uploaded_by_name
              FROM study_materials m
              LEFT JOIN classes c ON c.id = m.class_id
              LEFT JOIN subjects s ON s.id = m.subject_id
              LEFT JOIN users u ON u.id = m.uploaded_by
             WHERE m.institutionId = ?
        `;
        let params = [instId];

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
        if (!sameTenant(req, u[0].institutionId)) return res.status(403).json({ error: 'This student belongs to another institution.' });

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

// --- 24.3 Create Material (+ notify the class's students) ---
app.post('/api/admin/study-materials', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const uploaded_by = req.auth.userId;
    const {
        title, description, class_id, subject_id,
        material_type, external_link, materialFile
    } = req.body;

    try {
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }

        const [result] = await db.execute(
            `INSERT INTO study_materials
               (institutionId, title, description, class_id, subject_id, material_type, file_path, external_link, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                institutionId, title, description || null, class_id, subject_id || null,
                material_type || 'Notes', materialFile || null, external_link || null, uploaded_by
            ]
        );

        try {
            if (class_id) {
                const recipients = await studentIdsForClass(class_id);
                await createNotifications({
                    institutionId, recipientIds: recipients, type: 'study_material',
                    title: 'New study material', body: title,
                    link: 'StudyMaterials', entity_id: result.insertId, actor_id: uploaded_by
                });
            }
        } catch (e) { console.warn('[notify study material]', e.message); }

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24.4 Update Material (ownership + class ownership) ---
app.put('/api/admin/study-materials/:id', async (req, res) => {
    const {
        title, description, class_id, subject_id,
        material_type, external_link, materialFile
    } = req.body;

    try {
        const [own] = await db.execute('SELECT institutionId FROM study_materials WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Material not found.' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This material belongs to another institution.' });
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }

        let updateQuery = `
            UPDATE study_materials
               SET title=?, description=?, class_id=?, subject_id=?, material_type=?, external_link=?
        `;
        let params = [
            title, description || null, class_id, subject_id || null,
            material_type || 'Notes', external_link || null
        ];

        if (materialFile !== undefined) {
            updateQuery += `, file_path=?`;
            params.push(materialFile || null);
        }

        updateQuery += ` WHERE id=?`;
        params.push(req.params.id);

        await db.execute(updateQuery, params);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24.5 Delete Material (ownership) ---
app.delete('/api/admin/study-materials/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM study_materials WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This material belongs to another institution.' });
        await db.execute('DELETE FROM study_materials WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 22: SYLLABUS  (v5 — TENANT-SCOPED, no academic year)
//   Detection/slicing helpers unchanged except a wider TOC text scan
//   (20 -> 40 pages). Every route verifies the syllabus/chapter/keyword
//   belongs to the caller's institution. Create/update require the class
//   to be yours so the fan-out notify can't reach another school.
//   Academic-year logic removed: create no longer stamps academic_year_id
//   (the column is left NULL; no read filters by it).
//
//   ⚠ syllabus/chapter/:id/pdf is loaded by the viewer — it's under the
//     /api gate, so the frontend FETCHES it (token via interceptor) and
//     renders a blob URL, not a raw <iframe src>.
//
//   Requires: npm install pdfjs-dist@3.11.174 pdf-lib --save
//   Reuses nowSQL() (Section 16), studentIdsForClass/createNotifications (25).
// =====================================================================

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');

// ---- tenant helpers: resolve a syllabus' institution from any id ----
async function _sylInstBySyllabus(id) {
    const [r] = await db.execute('SELECT institutionId FROM syllabus WHERE id = ?', [id]);
    return r.length ? r[0].institutionId : null;
}
async function _sylInstByChapter(id) {
    const [r] = await db.execute(
        `SELECT s.institutionId FROM syllabus_chapters c
           JOIN syllabus s ON s.id = c.syllabus_id WHERE c.id = ?`, [id]);
    return r.length ? r[0].institutionId : null;
}
async function _sylInstByKeyword(id) {
    const [r] = await db.execute(
        `SELECT s.institutionId FROM syllabus_keywords k
           JOIN syllabus_chapters c ON c.id = k.chapter_id
           JOIN syllabus s ON s.id = c.syllabus_id WHERE k.id = ?`, [id]);
    return r.length ? r[0].institutionId : null;
}

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
    // A single outline entry (often just the file/title) is not a usable
    // chapter list — fall back to TOC-text detection instead.
    if (items.length < 2) return [];
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
    const scan = Math.min(total, 40);
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
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
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


// --- 22.2 Create a syllabus (no academic-year stamp) ----------------
app.post('/api/admin/syllabus', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    const { class_id, subject_id, teacher_id } = req.body;
    if (!class_id || !subject_id) {
        return res.status(400).json({ error: 'class_id and subject_id are required.' });
    }
    try {
        const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
        if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
            return res.status(403).json({ error: 'That class belongs to another institution.' });
        }
        const [result] = await db.execute(
            `INSERT INTO syllabus
               (institutionId, class_id, subject_id, teacher_id, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [institutionId, class_id, subject_id, teacher_id || null, created_by]
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
        const inst = await _sylInstBySyllabus(req.params.id);
        if (inst === null) return res.status(404).json({ error: 'Syllabus not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });
        if (class_id) {
            const [c] = await db.execute('SELECT institutionId FROM classes WHERE id = ?', [class_id]);
            if (c.length === 0 || !sameTenant(req, c[0].institutionId)) {
                return res.status(403).json({ error: 'That class belongs to another institution.' });
            }
        }
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
        const inst = await _sylInstBySyllabus(req.params.id);
        if (inst === null) return res.json({ success: true });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });
        await db.execute('DELETE FROM syllabus WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.5 Resolve a syllabus by class + subject ---------------------
app.get('/api/admin/syllabus/resolve/:instId/:classId/:subjectId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { classId, subjectId } = req.params;
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
        const inst = await _sylInstBySyllabus(req.params.syllabusId);
        if (inst === null) return res.json([]);
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });
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
            `SELECT institutionId, doc_name, doc_pages, page_offset, (doc_data IS NOT NULL) AS has_book
               FROM syllabus WHERE id = ?`,
            [req.params.syllabusId]
        );
        if (!rows.length) return res.json({ has_book: 0 });
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });
        const { doc_name, doc_pages, page_offset, has_book } = rows[0];
        res.json({ doc_name, doc_pages, page_offset, has_book });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.8 Upload textbook -> detect chapters -> pre-slice each ------
app.put('/api/admin/syllabus/:syllabusId/book', async (req, res) => {
    const { doc_name, doc_data, page_offset } = req.body;
    const actor_id = req.auth.userId;
    const syllabusId = req.params.syllabusId;
    if (!doc_data) return res.status(400).json({ error: 'doc_data is required.' });

    try {
        const inst = await _sylInstBySyllabus(syllabusId);
        if (inst === null) return res.status(404).json({ error: 'Syllabus not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });

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

        try {
            const [info] = await db.execute(
                `SELECT s.institutionId, s.class_id, sub.name AS subject_name
                   FROM syllabus s
                   LEFT JOIN subjects sub ON sub.id = s.subject_id
                  WHERE s.id = ?`,
                [syllabusId]
            );
            if (info.length && info[0].class_id) {
                const recipients = await studentIdsForClass(info[0].class_id);
                await createNotifications({
                    institutionId: info[0].institutionId, recipientIds: recipients, type: 'syllabus',
                    title: 'Syllabus material updated',
                    body: info[0].subject_name
                        ? `New material is available for ${info[0].subject_name}.`
                        : 'New syllabus material is available.',
                    link: 'Syllabus', entity_id: syllabusId, actor_id
                });
            }
        } catch (e) { console.warn('[notify syllabus]', e.message); }

        res.json({ success: true, total_pages: total, chapters: chapters.length });
    } catch (err) {
        console.error('Textbook detection failed:', err);
        res.status(500).json({ error: 'Could not read this PDF: ' + err.message });
    }
});


// --- 22.9 Change page offset -> re-slice all chapters ---------------
app.put('/api/admin/syllabus/:syllabusId/book/offset', async (req, res) => {
    try {
        const sid = req.params.syllabusId;
        const inst = await _sylInstBySyllabus(sid);
        if (inst === null) return res.status(404).json({ error: 'Syllabus not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });

        const offset = parseInt(req.body.page_offset, 10) || 0;
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


// --- 22.10 A chapter as a real PDF file (viewer loads this) ---------
app.get('/api/admin/syllabus/chapter/:id/pdf', async (req, res) => {
    try {
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.status(404).send('No document');
        if (!sameTenant(req, inst)) return res.status(403).send('Forbidden');
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
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.json({});
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'Forbidden' });
        const [rows] = await db.execute(
            'SELECT doc_name, doc_data, doc_pages FROM syllabus_chapters WHERE id = ?', [req.params.id]);
        if (!rows.length || !rows[0].doc_data) return res.json({});
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.11 Create a chapter (manual) -> slice it --------------------
app.post('/api/admin/syllabus/chapters', async (req, res) => {
    const { syllabus_id, title, page_from, page_to } = req.body;
    const actor_id = req.auth.userId;
    if (!syllabus_id || !title) {
        return res.status(400).json({ error: 'syllabus_id and title are required.' });
    }
    try {
        const inst = await _sylInstBySyllabus(syllabus_id);
        if (inst === null) return res.status(404).json({ error: 'Syllabus not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This syllabus belongs to another institution.' });

        const [[{ maxOrder }]] = await db.execute(
            `SELECT COALESCE(MAX(chapter_order), -1) + 1 AS maxOrder
               FROM syllabus_chapters WHERE syllabus_id = ?`, [syllabus_id]);
        const [result] = await db.execute(
            `INSERT INTO syllabus_chapters (syllabus_id, chapter_order, title, page_from, page_to)
             VALUES (?, ?, ?, ?, ?)`,
            [syllabus_id, maxOrder, title, page_from || null, page_to || null]);
        await resliceChapter(result.insertId);
        await db.execute('UPDATE syllabus SET updated_at = ? WHERE id = ?', [nowSQL(), syllabus_id]);

        try {
            const [info] = await db.execute(
                `SELECT s.institutionId, s.class_id, sub.name AS subject_name
                   FROM syllabus s
                   LEFT JOIN subjects sub ON sub.id = s.subject_id
                  WHERE s.id = ?`,
                [syllabus_id]
            );
            if (info.length && info[0].class_id) {
                const recipients = await studentIdsForClass(info[0].class_id);
                await createNotifications({
                    institutionId: info[0].institutionId, recipientIds: recipients, type: 'syllabus',
                    title: 'New chapter added',
                    body: info[0].subject_name ? `${title} — ${info[0].subject_name}` : title,
                    link: 'Syllabus', entity_id: syllabus_id, actor_id
                });
            }
        } catch (e) { console.warn('[notify syllabus chapter]', e.message); }

        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.12 Update a chapter -> re-slice it --------------------------
app.put('/api/admin/syllabus/chapters/:id', async (req, res) => {
    const { title, page_from, page_to } = req.body;
    try {
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.status(404).json({ error: 'Chapter not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This chapter belongs to another institution.' });
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
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.json({ success: true });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This chapter belongs to another institution.' });
        await db.execute('DELETE FROM syllabus_chapters WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.14 Update lesson-period schedule ----------------------------
app.put('/api/admin/syllabus/chapter/:id/periods', async (req, res) => {
    const { periods, start_date, end_date } = req.body;
    try {
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.status(404).json({ error: 'Chapter not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This chapter belongs to another institution.' });
        await db.execute(
            `UPDATE syllabus_chapters SET periods = ?, start_date = ?, end_date = ? WHERE id = ?`,
            [periods || 0, start_date || null, end_date || null, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.15 Keywords for a chapter -----------------------------------
app.get('/api/admin/syllabus/chapter/:id/keywords', async (req, res) => {
    try {
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.json([]);
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This chapter belongs to another institution.' });
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
        const inst = await _sylInstByChapter(req.params.id);
        if (inst === null) return res.status(404).json({ error: 'Chapter not found.' });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This chapter belongs to another institution.' });
        const [result] = await db.execute(
            'INSERT INTO syllabus_keywords (chapter_id, term, definition, example) VALUES (?, ?, ?, ?)',
            [req.params.id, term.trim(), definition || null, example || null]);
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 22.17 Delete a keyword -----------------------------------------
app.delete('/api/admin/syllabus/keywords/:keywordId', async (req, res) => {
    try {
        const inst = await _sylInstByKeyword(req.params.keywordId);
        if (inst === null) return res.json({ success: true });
        if (!sameTenant(req, inst)) return res.status(403).json({ error: 'This keyword belongs to another institution.' });
        await db.execute('DELETE FROM syllabus_keywords WHERE id = ?', [req.params.keywordId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// ====================================================================
// === GROUP CHAT MODULE  (TENANT-SCOPED) =============================
//   Actor identity (userId/role/institutionId) now comes from req.auth,
//   not from the body/query. Every group route verifies the group belongs
//   to the actor's institution; member/list queries are scoped to the
//   actor's institution.
//
//   ⚠ SOCKET.IO AUTH GAP — IMPORTANT:
//     Socket.IO connections do NOT pass through the Express /api JWT gate,
//     so the socket handlers below still trust the `userId` in each event
//     payload. The institution cross-checks added here stop a *truthful*
//     user from reaching another tenant's group, but a client could still
//     spoof `userId`. The real fix is to authenticate the socket HANDSHAKE
//     (verify the JWT in an io.use() middleware and read socket.user.id
//     instead of payload.userId). That needs the frontend to send the
//     token when it connects. Say the word and I'll wire up both sides.
// ====================================================================

// --- 1. Unified Helper for Group Permissions ---
//   Identity from the token. When the route targets a specific group, the
//   group must belong to the actor's institution (cross-tenant 403).
const checkGroupPermission = (action) => async (req, res, next) => {
    try {
        const userId = req.auth.userId;
        const role = req.auth.role;
        const institutionId = req.auth.institutionId;

        // If this action targets a specific group, it must be in our tenant.
        if (req.params.groupId) {
            const [grp] = await db.execute(
                'SELECT created_by, institutionId FROM `groups` WHERE id = ?',
                [req.params.groupId]
            );
            if (grp.length === 0) return res.status(404).json({ message: 'Group not found.' });
            if (!sameTenant(req, grp[0].institutionId)) {
                return res.status(403).json({ message: 'This group belongs to another institution.' });
            }
            req._groupCreatedBy = grp[0].created_by;
        }

        const isSystemAdmin = (role === 'Super Admin' || role === 'Developer');
        if (isSystemAdmin) {
            req.isAdminEquivalent = true;
            req.actorRole = role;
            req.actorInstId = institutionId;
            return next();
        }

        const [perms] = await db.execute(`
            SELECT p.can_${action}
              FROM permissions p
              JOIN roles r ON p.role_id = r.id
             WHERE r.role_name = ? AND r.institutionId = ? AND p.module_name = 'GroupChat'
        `, [role, institutionId]);

        if (perms.length > 0 && perms[0][`can_${action}`]) {
            req.isAdminEquivalent = true;
            req.actorRole = role;
            req.actorInstId = institutionId;
            return next();
        }

        // Creator of the group can still edit/delete their own group
        if ((action === 'edit' || action === 'delete') && req.params.groupId) {
            if (String(req._groupCreatedBy) === String(userId)) {
                req.isAdminEquivalent = false;
                req.actorRole = role;
                req.actorInstId = institutionId;
                return next();
            }
        }

        return res.status(403).json({ message: `Access denied. Requires ${action} permission for GroupChat.` });
    } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({ message: 'Server error verifying permissions.' });
    }
};

// --- 2. Group Options (classes + roles for group creation UI) ---
app.get('/api/groups/options', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? (req.query.instId || req.auth.institutionId) : req.auth.institutionId;
    try {
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

// --- 2.1 Get Users for Specific Selection ---
app.get('/api/groups/users-options', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? (req.query.instId || req.auth.institutionId) : req.auth.institutionId;
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.role, 
                u.profile_pic,
                CASE 
                    WHEN c.section IS NOT NULL AND c.section != '' THEN CONCAT(c.className, ' - ', c.section)
                    ELSE c.className 
                END AS class_name
            FROM users u
            LEFT JOIN classes c ON u.class_id = c.id
            WHERE u.institutionId = ?
            ORDER BY u.name ASC
        `, [instId]);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users for group options:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- 3. Create Group ---
app.post('/api/groups', checkGroupPermission('edit'), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const institutionId = req.auth.institutionId;
        const {
            name, description,
            selectedCategories = [], selectedUserIds = [], backgroundColor, isReadOnly
        } = req.body;

        if (!name || (selectedCategories.length === 0 && selectedUserIds.length === 0)) {
            return res.status(400).json({ message: 'name and at least one member or category are required.' });
        }

        let memberIds = [];

        if (selectedCategories.length > 0) {
            let finalCategories = selectedCategories;

            if (!req.isAdminEquivalent) {
                finalCategories = selectedCategories.filter(cat =>
                    cat !== 'All' && cat !== 'Super Admin' && cat !== 'Developer' && cat !== 'Teacher'
                );
            }

            if (finalCategories.length > 0) {
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
                memberIds = usersToAdd.map(u => u.id);
            }
        }

        const explicitUserIds = Array.isArray(selectedUserIds) ? selectedUserIds.map(id => parseInt(id, 10)) : [];

        // Only members that belong to THIS institution may be added.
        const candidateIds = [...new Set([parseInt(userId, 10), ...memberIds, ...explicitUserIds])].filter(Boolean);
        let allMemberIds = candidateIds;
        if (candidateIds.length) {
            const placeholders = candidateIds.map(() => '?').join(',');
            const [valid] = await db.execute(
                `SELECT id FROM users WHERE institutionId = ? AND id IN (${placeholders})`,
                [institutionId, ...candidateIds]
            );
            allMemberIds = valid.map(r => r.id);
        }

        if (allMemberIds.length === 0) {
            return res.status(400).json({ message: 'No valid members found to add.' });
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

            await createNotifications({
                institutionId, recipientIds: allMemberIds, type: 'group_chat',
                title: 'Added to a group', body: name,
                link: 'GroupChat', entity_id: groupId, actor_id: userId
            }, conn);

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

// --- 4. List Groups for a User ---
app.get('/api/groups', async (req, res) => {
    const userId = req.auth.userId;
    const instId = req.auth.role === 'Developer' ? (req.query.instId || req.auth.institutionId) : req.auth.institutionId;
    try {
        const isSystemAdmin = (req.auth.role === 'Super Admin' || req.auth.role === 'Developer');

        const [groups] = await db.execute(`
            SELECT
                g.id,
                g.name,
                g.description,
        DATE_FORMAT(g.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                g.created_by,
                g.group_dp_url,
                g.background_color,
                g.status,
                g.is_read_only,
                
                COALESCE(
                    lm.message_text, 
                    CASE 
                        WHEN lm.message_type = 'image' THEN ' Photo'
                        WHEN lm.message_type = 'video' THEN ' Video'
                        WHEN lm.message_type = 'file' THEN CONCAT(' ', COALESCE(lm.file_name, 'Document'))
                        ELSE NULL 
                    END
                ) AS last_message_text,
                
             DATE_FORMAT(lm.timestamp, '%Y-%m-%dT%H:%i:%sZ') AS last_message_timestamp,
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

// --- 5. Get Group Details ---
app.get('/api/groups/:groupId/details', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.auth.userId;
    try {
        const role = req.auth.role;
        const institutionId = req.auth.institutionId;
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

// --- 5.1 Get Group Members ---
app.get('/api/groups/:groupId/members', async (req, res) => {
    const { groupId } = req.params;
    try {
        const [grp] = await db.execute('SELECT institutionId FROM `groups` WHERE id = ?', [groupId]);
        if (grp.length === 0) return res.json([]);
        if (!sameTenant(req, grp[0].institutionId)) return res.status(403).json({ message: 'This group belongs to another institution.' });

        const [members] = await db.execute(`
            SELECT u.id, u.name, u.role, u.profile_pic
              FROM users u
              JOIN group_members gm ON u.id = gm.user_id
             WHERE gm.group_id = ?
             ORDER BY u.name ASC
        `, [groupId]);
        res.json(members);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ message: 'Error fetching members.' });
    }
});

// --- 5.2 Add Members to Group ---
app.post('/api/groups/:groupId/members', checkGroupPermission('edit'), async (req, res) => {
    const { groupId } = req.params;
    const institutionId = req.auth.institutionId;
    const { selectedCategories = [], selectedUserIds = [] } = req.body;

    if (selectedCategories.length === 0 && selectedUserIds.length === 0) {
        return res.status(400).json({ message: 'Select at least one category or user.' });
    }

    try {
        let memberIds = [];

        if (selectedCategories.length > 0) {
            let whereClauses = [];
            let queryParams = [];

            selectedCategories.forEach(category => {
                if (category === 'All') {
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
            const [usersToAdd] = await db.execute(`
                SELECT DISTINCT u.id FROM users u 
                LEFT JOIN classes c ON u.class_id = c.id 
                WHERE ${finalWhereClause}
            `, queryParams);

            memberIds = usersToAdd.map(u => u.id);
        }

        const explicitUserIds = Array.isArray(selectedUserIds) ? selectedUserIds.map(id => parseInt(id, 10)) : [];

        // Only this institution's users may be added.
        const candidateIds = [...new Set([...memberIds, ...explicitUserIds])].filter(Boolean);
        let allMemberIds = [];
        if (candidateIds.length) {
            const placeholders = candidateIds.map(() => '?').join(',');
            const [valid] = await db.execute(
                `SELECT id FROM users WHERE institutionId = ? AND id IN (${placeholders})`,
                [institutionId, ...candidateIds]
            );
            allMemberIds = valid.map(r => r.id);
        }

        if (allMemberIds.length === 0) {
            return res.status(400).json({ message: 'No valid users found to add.' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            for (const memberId of allMemberIds) {
                await conn.execute(
                    'INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
                    [groupId, memberId]
                );
            }
            await conn.commit();
            res.json({ message: 'Members added successfully!' });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ message: 'Error adding members.' });
    }
});

// --- 5.3 Remove Member from Group ---
app.delete('/api/groups/:groupId/members/:memberId', checkGroupPermission('edit'), async (req, res) => {
    const { groupId, memberId } = req.params;
    try {
        await db.execute(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, memberId]
        );
        res.json({ message: 'Member removed successfully.' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Error removing member.' });
    }
});

// --- 6. Mark Group as Seen ---
app.post('/api/groups/:groupId/seen', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.auth.userId;
    try {
        const [grp] = await db.execute('SELECT institutionId FROM `groups` WHERE id = ?', [groupId]);
        if (grp.length === 0) return res.sendStatus(404);
        if (!sameTenant(req, grp[0].institutionId)) return res.status(403).json({ message: 'This group belongs to another institution.' });

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

// --- 7. Update Group ---
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

// --- 8. Update Group Display Picture ---
app.put('/api/groups/:groupId/dp', checkGroupPermission('edit'), async (req, res) => {
    const { groupId } = req.params;
    const { group_dp } = req.body;
    if (!group_dp) return res.status(400).json({ message: 'No image data provided.' });
    try {
        await db.execute(
            'UPDATE `groups` SET group_dp_url = ? WHERE id = ?',
            [group_dp, groupId]
        );
        res.json({ message: 'Group DP updated successfully.', group_dp_url: group_dp });
    } catch (error) {
        console.error('Error updating group DP:', error);
        res.status(500).json({ message: 'Failed to update group DP.' });
    }
});

// --- 9. Delete Group ---
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

// --- 10. Get Chat History ---
app.get('/api/groups/:groupId/history', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.auth.userId;
    const { page = 1, limit = 20 } = req.query;
    const groupIdInt = parseInt(groupId, 10);
    try {
        const role = req.auth.role;
        const isSystemAdmin = (role === 'Super Admin' || role === 'Developer');

        const [grp] = await db.execute('SELECT institutionId FROM `groups` WHERE id = ?', [groupIdInt]);
        if (grp.length === 0) return res.status(404).json({ message: 'Group not found.' });
        if (!sameTenant(req, grp[0].institutionId)) return res.status(403).json({ message: 'This group belongs to another institution.' });

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
              DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%sZ') AS timestamp,
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

// --- 11. Upload Chat Media (Base64) ---
app.post('/api/groups/media', async (req, res) => {
    const { media, fileName, fileSize, fileMimeType } = req.body;
    if (!media) return res.status(400).json({ message: 'No media data provided.' });

    const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB limit

    if (fileSize && fileSize > MAX_SIZE_BYTES) {
        return res.status(413).json({ message: 'File exceeds the 3MB limit.' });
    }

    const estimatedSize = media.length * 0.75;
    if (estimatedSize > (MAX_SIZE_BYTES * 1.1)) {
        return res.status(413).json({ message: 'Payload is too large. Limit is 3MB.' });
    }

    res.status(201).json({
        fileUrl: media,
        fileSize: fileSize || null,
        fileMimeType: fileMimeType || 'unknown',
        fileName: fileName || 'file'
    });
});

// ====================================================================
// === SOCKET.IO --- Real-Time Chat ===================================
//   See the SOCKET.IO AUTH GAP note at the top of this section. The
//   handlers below additionally enforce that the acting user and the
//   group share an institution (Developer excepted), so a truthful
//   Super Admin of one school can't post into / delete from another's.
// ====================================================================

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
            const [[groupRow]] = await conn.execute(
                'SELECT is_read_only, created_by, institutionId FROM `groups` WHERE id = ?',
                [groupId]
            );
            const [[userRow]] = await conn.execute(
                'SELECT role, institutionId FROM users WHERE id = ?',
                [userId]
            );

            if (!groupRow || !userRow) {
                conn.release();
                return;
            }

            const isSystemAdmin = userRow.role === 'Super Admin' || userRow.role === 'Developer';
            const isDeveloper = userRow.role === 'Developer';

            // Tenant guard: the user and the group must share an institution
            // (Developer may span tenants).
            if (!isDeveloper && String(groupRow.institutionId) !== String(userRow.institutionId)) {
                socket.emit('messageError', {
                    message: 'You cannot post to this group.',
                    clientMessageId: clientMessageId || null
                });
                conn.release();
                return;
            }

            const isReadOnly = groupRow.is_read_only == 1;
            const isCreator = String(groupRow.created_by) === String(userId);

            if (isReadOnly && !isSystemAdmin && !isCreator) {
                socket.emit('messageError', {
                    message: 'Only admins can send messages in this group.',
                    clientMessageId: clientMessageId || null
                });
                conn.release();
                return;
            }

            const [[memberRow]] = await conn.execute(
                'SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?',
                [groupId, userId]
            );

            if (!memberRow && !isSystemAdmin) {
                socket.emit('messageError', { message: 'You are not a member of this group.' });
                conn.release();
                return;
            }

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
                    m.id, m.message_text,
                  DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%sZ') AS timestamp,
                    m.user_id, m.group_id, m.message_type,
                    m.file_url, m.file_size, m.file_mime_type,
                    m.is_edited, m.is_deleted, m.deleted_by,
                    m.is_pinned, m.file_name, m.reply_to_message_id,
                    u.name AS full_name, u.role,
                    u.profile_pic AS profile_image_url, u.roll_no,
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
                `SELECT m.user_id, g.institutionId
                   FROM group_chat_messages m JOIN \`groups\` g ON g.id = m.group_id
                  WHERE m.id = ?`, [messageId]
            );
            if (msgRows.length === 0) return;

            const [userRows] = await conn.execute(
                'SELECT role, institutionId FROM users WHERE id = ?', [userId]
            );
            if (userRows.length === 0) return;

            const { role, institutionId } = userRows[0];
            const isSystemAdmin = (role === 'Super Admin' || role === 'Developer');
            const isDeveloper = role === 'Developer';

            // Tenant guard: the message's group must be in the actor's tenant.
            if (!isDeveloper && String(msgRows[0].institutionId) !== String(institutionId)) return;

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

            // Edit is owner-only, so cross-tenant edits are impossible (you
            // can only edit a message you authored).
            if (String(msgRows[0].user_id) !== String(userId)) return;

            await conn.execute(
                'UPDATE group_chat_messages SET message_text = ?, is_edited = 1 WHERE id = ?',
                [newText, messageId]
            );

            const [rows] = await conn.execute(`
                SELECT
                    m.id,
                    m.message_text,
                    DATE_FORMAT(m.timestamp, '%Y-%m-%dT%H:%i:%sZ') AS timestamp,
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
//  BACKEND — Section 23: ALUMNI  (TENANT-SCOPED)
//   instId from req.auth; create takes institutionId from the token;
//   detail/photo/update/delete verify ownership. The promote route only
//   processes students that belong to the caller's institution — without
//   that, a crafted student_id could pull another school's student into
//   your alumni AND flip their account to 'alumni' (deactivating them).
//
//   ⚠ alumni/pic/:id streams the photo — it's under the /api gate, so a
//     raw <img src> won't carry the token. Fetch it as a blob if needed.
//
//   23.9  : update an alumni photo (snapshot from the user profile stays
//           until an admin uploads a new one here).
//   23.10 : export the alumni list to Excel — a single year, or ALL years
//           grouped under year-wise headings. Streamed as .xlsx; the
//           frontend fetches it as a blob (token via the interceptor) and
//           saves it, since a raw download link wouldn't carry the token.
//
//   Reuses nowSQL() (Section 16).
// =====================================================================

// --- 23.1 Years for the filter — distinct calendar years from data --
app.get('/api/admin/alumni/years/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT YEAR(created_at) AS yr
               FROM alumni
              WHERE institutionId = ? AND created_at IS NOT NULL
              ORDER BY yr DESC`,
            [instId]
        );
        res.json(rows.map(r => r.yr).filter(Boolean));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 23.2 Alumni list (card data) -----------------------------------
app.get('/api/admin/alumni/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { year, q } = req.query;
    try {
        let sql = `
            SELECT id, user_id, academic_year_id, passout_year, final_class,
                   name, email, phone, current_status, occupation, roll_no,
                   (profile_pic IS NOT NULL) AS has_pic
              FROM alumni
             WHERE institutionId = ?`;
        const params = [instId];

        const yr = parseInt(year, 10);
        if (year && year !== 'all' && !isNaN(yr)) {
            sql += ' AND YEAR(created_at) = ?';
            params.push(yr);
        }

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
        const [rows] = await db.execute('SELECT * FROM alumni WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Alumni not found' });
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).json({ error: 'This record belongs to another institution.' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 23.3b Alumni photo (streams the stored picture) ----------------
app.get('/api/admin/alumni/pic/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT profile_pic, institutionId FROM alumni WHERE id = ?', [req.params.id]);
        if (!rows.length || !rows[0].profile_pic) return res.status(404).send('No image');
        if (!sameTenant(req, rows[0].institutionId)) return res.status(403).send('Forbidden');

        const pic = String(rows[0].profile_pic);
        const m = /^data:([^;]+);base64,(.+)$/s.exec(pic);
        if (m) {
            const mime = m[1];
            const buf = Buffer.from(m[2], 'base64');
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            return res.end(buf);
        }
        return res.redirect(pic);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 23.10 Export the alumni list to Excel --------------------------
//   ?year=YYYY  -> only that calendar year (one section).
//   ?year=all   -> every year, grouped under a heading per year.
//   NOTE: keep this ABOVE the generic '/:instId' list route is not needed
//   because the path segment 'export' can't collide with an id, but the
//   more specific static segment is matched fine by Express regardless.
app.get('/api/admin/alumni/export/:instId', async (req, res) => {
    const ExcelJS = require('exceljs'); // local require avoids any top-level name clash
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { year } = req.query;
    try {
        let sql = `
            SELECT name, email, phone, gender, dob, passout_year, final_class,
                   roll_no, admission_no, current_status, occupation, organization,
                   higher_education, location, linkedin, address, notes,
                   YEAR(created_at) AS cal_year
              FROM alumni
             WHERE institutionId = ?`;
        const params = [instId];
        const yr = parseInt(year, 10);
        const singleYear = year && year !== 'all' && !isNaN(yr);
        if (singleYear) { sql += ' AND YEAR(created_at) = ?'; params.push(yr); }
        sql += ' ORDER BY YEAR(created_at) DESC, name';
        const [rows] = await db.execute(sql, params);

        // Column definitions (order = sheet order). profile_pic is a base64
        // image, so it's intentionally left out of the spreadsheet.
        const columns = [
            { header: 'Name',             width: 24 },
            { header: 'Email',            width: 28 },
            { header: 'Phone',            width: 16 },
            { header: 'Gender',           width: 10 },
            { header: 'Date of Birth',    width: 14 },
            { header: 'Passout Year',     width: 14 },
            { header: 'Final Class',      width: 14 },
            { header: 'Roll No',          width: 10 },
            { header: 'Admission No',     width: 14 },
            { header: 'Current Status',   width: 16 },
            { header: 'Occupation',       width: 18 },
            { header: 'Organization',     width: 18 },
            { header: 'Higher Education', width: 18 },
            { header: 'Location',         width: 16 },
            { header: 'LinkedIn',         width: 30 },
            { header: 'Address',          width: 30 },
            { header: 'Notes',            width: 34 },
        ];
        const NCOLS = columns.length;

        const dmy = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const p = (n) => String(n).padStart(2, '0');
            return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
        };
        const rowValues = (r) => ([
            r.name || '', r.email || '', r.phone || '', r.gender || '', dmy(r.dob),
            r.passout_year || '', r.final_class || '', r.roll_no || '', r.admission_no || '',
            r.current_status || '', r.occupation || '', r.organization || '',
            r.higher_education || '', r.location || '', r.linkedin || '',
            r.address || '', r.notes || ''
        ]);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SmartEdz';
        wb.created = new Date();
        const ws = wb.addWorksheet('Alumni');
        // Widths only — no header property, so exceljs doesn't auto-insert a row.
        ws.columns = columns.map(c => ({ width: c.width }));

        const PRIMARY = 'FF3284C7';
        const ACCENT  = 'FFF29132';

        const addTitleRow = (text) => {
            const row = ws.addRow([text]);
            ws.mergeCells(row.number, 1, row.number, NCOLS);
            const cell = row.getCell(1);
            cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            row.height = 24;
        };

        const addYearHeading = (text) => {
            const row = ws.addRow([text]);
            ws.mergeCells(row.number, 1, row.number, NCOLS);
            const cell = row.getCell(1);
            cell.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FA' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            row.height = 20;
        };

        const addColumnHeader = () => {
            const row = ws.addRow(columns.map(c => c.header));
            row.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
                cell.alignment = { vertical: 'middle' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFB8CCE0' } } };
            });
            row.height = 18;
        };

        const addDataRow = (r) => {
            const row = ws.addRow(rowValues(r));
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'top', wrapText: false };
                cell.font = { size: 10, color: { argb: 'FF27272A' } };
            });
        };

        const scopeLabel = singleYear ? `Year ${yr}` : 'All Years';
        addTitleRow(`Alumni — ${scopeLabel}`);
        ws.addRow([]); // spacer

        if (rows.length === 0) {
            const r = ws.addRow(['No alumni found for this selection.']);
            ws.mergeCells(r.number, 1, r.number, NCOLS);
            r.getCell(1).font = { italic: true, color: { argb: 'FF71717A' } };
        } else if (singleYear) {
            addColumnHeader();
            rows.forEach(addDataRow);
        } else {
            // ALL years: one heading + column header per calendar-year group.
            let currentYear = null;
            let first = true;
            for (const r of rows) {
                if (r.cal_year !== currentYear) {
                    currentYear = r.cal_year;
                    if (!first) ws.addRow([]); // blank line between groups
                    first = false;
                    const groupRows = rows.filter(x => x.cal_year === currentYear).length;
                    addYearHeading(`Year ${currentYear || '—'}  (${groupRows} alumni)`);
                    addColumnHeader();
                }
                addDataRow(r);
            }
        }

        const safeScope = singleYear ? String(yr) : 'AllYears';
        const filename = `Alumni_${safeScope}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Alumni export failed:', err);
        // If headers already went out we can't send JSON; guard for that.
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
});

// --- 23.4 Manually add an alumni ------------------------------------
app.post('/api/admin/alumni', async (req, res) => {
    const b = req.body;
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    try {
        let snap = {};
        if (b.user_id) {
            // Snapshot only from a user in THIS institution.
            const [u] = await db.execute('SELECT * FROM users WHERE id = ? AND institutionId = ?', [b.user_id, institutionId]);
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
        const merged = { ...snap, ...b, institutionId, created_by };
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
app.post('/api/admin/alumni/promote', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const created_by = req.auth.userId;
    const { student_ids, academic_year_id, passout_year, final_class } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return res.status(400).json({ error: 'student_ids[] required.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [ay] = await conn.execute(
            'SELECT id, name FROM academic_years WHERE institutionId = ? AND isActive = 1 LIMIT 1',
            [institutionId]
        );
        const yearId   = ay.length ? ay[0].id   : (academic_year_id ?? null);
        const yearName = ay.length ? ay[0].name : (passout_year ?? null);

        let added = 0;
        for (const sid of student_ids) {
            const [u] = await conn.execute('SELECT * FROM users WHERE id = ?', [sid]);
            if (!u.length) continue;
            const s = u[0];

            // Only promote students that belong to THIS institution. Stops a
            // crafted id from importing another school's student and from
            // flipping their account to 'alumni'.
            if (!sameTenant(req, s.institutionId)) continue;

            const [exists] = await conn.execute(
                'SELECT id FROM alumni WHERE user_id = ? AND academic_year_id = ?',
                [sid, yearId]
            );
            if (exists.length) continue;

            await conn.execute(
                `INSERT INTO alumni
                   (institutionId, user_id, academic_year_id, passout_year, final_class,
                    name, email, phone, gender, dob, address, profile_pic,
                    roll_no, admission_no, created_by)
                 VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?, ?)`,
                [institutionId, sid, yearId, yearName, final_class ?? null,
                 s.name ?? null, s.email ?? null, s.phone ?? null, s.gender ?? null,
                 s.dob ?? null, s.address ?? null, s.profile_pic ?? null,
                 s.roll_no ?? null, s.admission_no ?? null, created_by ?? null]
            );
            await conn.execute(
                "UPDATE users SET status = 'alumni' WHERE id = ?", [sid]);
            added++;
        }
        await conn.commit();
        res.json({ success: true, added, passout_year: yearName });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// --- 23.6 Update the editable / extra fields (ownership) ------------
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
    if (sets.length === 0) return res.json({ success: true });
    try {
        const [own] = await db.execute('SELECT institutionId FROM alumni WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Alumni not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This record belongs to another institution.' });
        params.push(req.params.id);
        await db.execute(`UPDATE alumni SET ${sets.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 23.7 Delete an alumni record (ownership) ----------------------
app.delete('/api/admin/alumni/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM alumni WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This record belongs to another institution.' });
        await db.execute('DELETE FROM alumni WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 23.8 Candidates for manual add ---------------------------------
app.get('/api/admin/alumni/candidates/:instId/:classId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const { classId } = req.params;
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

// --- 23.9 Update an alumni photo (ownership) ------------------------
//   Replaces the snapshotted picture with an uploaded one (base64 data
//   URL). Until this is called, the photo taken from the student's user
//   profile at passout remains.
app.put('/api/admin/alumni/:id/pic', async (req, res) => {
    const { profile_pic } = req.body;
    if (!profile_pic) return res.status(400).json({ error: 'profile_pic is required.' });
    try {
        const [own] = await db.execute('SELECT institutionId FROM alumni WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.status(404).json({ error: 'Alumni not found' });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This record belongs to another institution.' });
        await db.execute('UPDATE alumni SET profile_pic = ? WHERE id = ?', [profile_pic, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});




// =====================================================================
// === 14. LESSON PLAN MODULE  (TENANT-SCOPED) =========================
//   instId/actor from req.auth; delete verifies ownership.
// =====================================================================

app.get('/api/admin/lesson-plans/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [rows] = await db.execute(
            'SELECT id, image_data FROM lesson_plans WHERE institutionId = ? ORDER BY created_at DESC LIMIT 1',
            [instId]
        );
        res.json(rows[0] || null);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/lesson-plans', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const actor_id = req.auth.userId;
    const { image_data } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO lesson_plans (institutionId, image_data, title) VALUES (?, ?, ?)',
            [institutionId, image_data, 'Active Guideline']
        );

        const recipients = await allActiveUserIds(institutionId);
        await createNotifications({
            institutionId, recipientIds: recipients, type: 'lesson_plan',
            title: 'Lesson plan guidelines updated',
            body: 'The lesson plan guideline template has been updated.',
            link: 'LessonPlan', entity_id: result.insertId, actor_id
        });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/lesson-plans/:id', async (req, res) => {
    try {
        const [own] = await db.execute('SELECT institutionId FROM lesson_plans WHERE id = ?', [req.params.id]);
        if (own.length === 0) return res.json({ success: true });
        if (!sameTenant(req, own[0].institutionId)) return res.status(403).json({ error: 'This guideline belongs to another institution.' });
        await db.execute('DELETE FROM lesson_plans WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — Section 25: NOTIFICATIONS  (CORE ONLY, TENANT-SCOPED)
//   Notifications are personal: a user may only read/clear their OWN.
//   List/count/read-all/clear are pinned to the token user; read-one and
//   delete-one verify the row's recipient is the token user.
//   Helpers (createNotifications / studentIdsForClass / allActiveUserIds /
//   staffUserIds) are unchanged.
// =====================================================================


// --- 25.0 Shared helpers --------------------------------------------
async function createNotifications(
    { institutionId, recipientIds, type, title, body, link, entity_id, actor_id },
    dbOrConnection = db
) {
    if (!institutionId || !type || !title) return 0;

    const actor = parseInt(actor_id, 10);
    const ids = [...new Set((recipientIds || []).map(n => parseInt(n, 10)).filter(Boolean))]
        .filter(id => id !== actor);
    if (ids.length === 0) return 0;

    const cap = (s, n) => (s == null ? null : String(s).slice(0, n));
    const rows = ids.map(rid => ([
        institutionId, rid, cap(type, 40), cap(title, 255), cap(body, 500),
        cap(link, 120), entity_id || null, actor_id || null
    ]));

    try {
        await dbOrConnection.query(
            `INSERT INTO notifications
               (institutionId, recipient_id, type, title, body, link, entity_id, actor_id)
             VALUES ?`,
            [rows]
        );
    } catch (e) {
        console.error('[NOTIFICATION ERROR] bulk insert:', e.message);
        return 0;
    }
    return ids.length;
}

async function studentIdsForClass(classId) {
    if (!classId) return [];
    const [rows] = await db.execute(
        `SELECT id FROM users
          WHERE class_id = ? AND LOWER(TRIM(role)) = 'student'
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`,
        [classId]
    );
    return rows.map(r => r.id);
}

async function allActiveUserIds(institutionId) {
    const [rows] = await db.execute(
        `SELECT id FROM users
          WHERE institutionId = ?
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`,
        [institutionId]
    );
    return rows.map(r => r.id);
}

async function staffUserIds(institutionId) {
    if (!institutionId) return [];
    const [rows] = await db.execute(
        `SELECT id FROM users
          WHERE institutionId = ?
            AND LOWER(TRIM(role)) <> 'student'
            AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`,
        [institutionId]
    );
    return rows.map(r => r.id);
}


// --- 25.1 List a user's notifications (self only) -------------------
app.get('/api/notifications/:userId', async (req, res) => {
    if (String(req.params.userId) !== String(req.auth.userId)) {
        return res.status(403).json({ error: 'You can only read your own notifications.' });
    }
    const userId = req.auth.userId;
    const { filter = 'all', limit = 50 } = req.query;
    try {
        let where = 'recipient_id = ?';
        if (filter === 'unread') where += ' AND is_read = 0';
        const lim = Math.min(parseInt(limit, 10) || 50, 100);
        const [rows] = await db.query(
            `SELECT id, type, title, body, link, entity_id, actor_id, is_read,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
               FROM notifications
              WHERE ${where}
              ORDER BY created_at DESC
              LIMIT ${lim}`,
            [userId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 25.2 Unread count (self only) ----------------------------------
app.get('/api/notifications/:userId/unread-count', async (req, res) => {
    if (String(req.params.userId) !== String(req.auth.userId)) {
        return res.status(403).json({ error: 'You can only read your own notifications.' });
    }
    try {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND is_read = 0',
            [req.auth.userId]
        );
        res.json({ count: Number(rows[0]?.count || 0) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 25.3 Mark one notification read (must be yours) ----------------
app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const [n] = await db.execute('SELECT recipient_id FROM notifications WHERE id = ?', [req.params.id]);
        if (n.length === 0) return res.json({ success: true });
        if (String(n[0].recipient_id) !== String(req.auth.userId)) {
            return res.status(403).json({ error: 'This notification is not yours.' });
        }
        await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND is_read = 0', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 25.4 Mark ALL of a user's notifications read (self only) -------
app.put('/api/notifications/:userId/read-all', async (req, res) => {
    if (String(req.params.userId) !== String(req.auth.userId)) {
        return res.status(403).json({ error: 'You can only update your own notifications.' });
    }
    try {
        await db.execute(
            'UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0',
            [req.auth.userId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 25.5 Delete one notification (must be yours) -------------------
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        const [n] = await db.execute('SELECT recipient_id FROM notifications WHERE id = ?', [req.params.id]);
        if (n.length === 0) return res.json({ success: true });
        if (String(n[0].recipient_id) !== String(req.auth.userId)) {
            return res.status(403).json({ error: 'This notification is not yours.' });
        }
        await db.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- 25.6 Clear ALL of a user's notifications (self only) -----------
app.delete('/api/notifications/:userId/clear', async (req, res) => {
    if (String(req.params.userId) !== String(req.auth.userId)) {
        return res.status(403).json({ error: 'You can only clear your own notifications.' });
    }
    try {
        await db.execute('DELETE FROM notifications WHERE recipient_id = ?', [req.auth.userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// =====================================================================
//  BACKEND — OVERVIEW CONFIG (per-role dashboard cards)  (TENANT-SCOPED)
//   instId from req.auth; resolve/upsert are scoped to the token tenant.
// =====================================================================

function parseCardIds(v) {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; }
    catch { return []; }
}

// --- OC.1 Full config map for a school (Settings UI) ---------------
app.get('/api/admin/overview-config/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const [rows] = await db.execute(
            'SELECT role_name, card_ids FROM overview_config WHERE institutionId = ?',
            [instId]
        );
        const map = {};
        rows.forEach(r => { map[r.role_name] = parseCardIds(r.card_ids); });
        res.json(map);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- OC.2 Resolve one role's cards (read by the Overview itself) ----
app.get('/api/overview-config/resolve', async (req, res) => {
    const { role } = req.query;
    const instId = req.auth.role === 'Developer' ? (req.query.instId || req.auth.institutionId) : req.auth.institutionId;
    if (!role) {
        return res.status(400).json({ error: 'role is required.' });
    }
    try {
        const [rows] = await db.execute(
            'SELECT card_ids FROM overview_config WHERE institutionId = ? AND role_name = ?',
            [instId, role]
        );
        res.json({ card_ids: rows.length ? parseCardIds(rows[0].card_ids) : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- OC.3 Upsert one role's cards (Settings UI save) ---------------
app.post('/api/admin/overview-config', async (req, res) => {
    const institutionId = req.auth.institutionId;
    const { role_name, card_ids } = req.body;
    if (!role_name || !Array.isArray(card_ids)) {
        return res.status(400).json({ error: 'role_name and card_ids[] are required.' });
    }
    try {
        await db.execute(
            `INSERT INTO overview_config (institutionId, role_name, card_ids, updated_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE card_ids = VALUES(card_ids), updated_at = NOW()`,
            [institutionId, role_name, JSON.stringify(card_ids)]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =====================================================================
//  BACKEND — OVERVIEW PERFORMANCE ANALYTICS (one call, school-wide)
// =====================================================================
app.get('/api/admin/performance/overview/:instId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    try {
        const yearId = await resolveYearId(instId, req.query.academic_year_id);

        const [classes] = await db.execute(
            'SELECT id, className, section FROM classes WHERE institutionId = ? ORDER BY className, section',
            [instId]
        );
        const [examTypes] = await db.execute(
            'SELECT id, name FROM exam_types WHERE institutionId = ? ORDER BY exam_order, id',
            [instId]
        );

        const [maxRows] = await db.execute(
            `SELECT m.exam_type_id, m.class_id, m.subject_id, m.max_marks
               FROM exam_max_marks m
               JOIN exam_types t ON t.id = m.exam_type_id
              WHERE t.institutionId = ?`,
            [instId]
        );
        const maxMap = {};
        maxRows.forEach(r => {
            const c = maxMap[r.class_id] || (maxMap[r.class_id] = {});
            const e = c[r.exam_type_id] || (c[r.exam_type_id] = { default: null, bySubject: {} });
            if (Number(r.subject_id) === 0) e.default = r.max_marks;
            else e.bySubject[r.subject_id] = r.max_marks;
        });
        const possibleFor = (classId, examTypeId, subjectId) => {
            const e = maxMap[classId] && maxMap[classId][examTypeId];
            if (!e) return null;
            const ov = e.bySubject[subjectId];
            if (ov !== undefined && ov !== null) return Number(ov);
            if (e.default !== undefined && e.default !== null) return Number(e.default);
            return null;
        };

        const [marks] = await db.execute(
            `SELECT sm.student_id, sm.class_id, sm.subject_id, sm.exam_type_id, sm.marks_obtained,
                    u.name AS student_name, u.roll_no
               FROM student_marks sm
               JOIN users u ON u.id = sm.student_id
              WHERE sm.institutionId = ? AND sm.academic_year_id = ?
                AND LOWER(TRIM(u.role)) = 'student'
                AND (u.status IS NULL OR LOWER(TRIM(u.status)) <> 'alumni')`,
            [instId, yearId]
        );

        const students = {};
        const completedExams = new Set();
        marks.forEach(m => {
            if (m.marks_obtained === null || m.marks_obtained === undefined) return;
            const obt = Number(m.marks_obtained);
            if (isNaN(obt)) return;
            const poss = possibleFor(m.class_id, m.exam_type_id, m.subject_id);
            if (poss === null || poss <= 0) return;
            completedExams.add(Number(m.exam_type_id));
            const s = students[m.student_id] ||
                (students[m.student_id] = { name: m.student_name, roll_no: m.roll_no, class_id: m.class_id, obtained: 0, possible: 0 });
            s.obtained += obt;
            s.possible += poss;
        });

        const round1 = (n) => Math.round(n * 10) / 10;
        const classMeta = {};
        classes.forEach(c => {
            classMeta[c.id] = {
                class_id: c.id,
                class_group: `${c.className}${c.section ? ' - ' + c.section : ''}`,
                obtained: 0, possible: 0, top: null
            };
        });

        Object.values(students).forEach(s => {
            const cm = classMeta[s.class_id];
            if (!cm || s.possible <= 0) return;
            cm.obtained += s.obtained;
            cm.possible += s.possible;
            const pct = (s.obtained / s.possible) * 100;
            if (!cm.top || pct > cm.top.pct) {
                cm.top = {
                    student_name: s.name, roll_no: s.roll_no,
                    pct: round1(pct), obtained: Math.round(s.obtained), possible: Math.round(s.possible)
                };
            }
        });

        const top_classes = Object.values(classMeta)
            .filter(c => c.possible > 0)
            .map(c => ({
                class_id: c.class_id, class_group: c.class_group,
                pct: round1((c.obtained / c.possible) * 100),
                obtained: Math.round(c.obtained), possible: Math.round(c.possible)
            }))
            .sort((a, b) => b.pct - a.pct);

        const top_performers = Object.values(classMeta)
            .filter(c => c.top)
            .map(c => ({ class_id: c.class_id, class_group: c.class_group, ...c.top }))
            .sort((a, b) => b.pct - a.pct);

        const exams_completed = examTypes.filter(t => completedExams.has(Number(t.id))).map(t => t.name);

        res.json({ academic_year_id: yearId, exams_completed, top_performers, top_classes });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Overview persona for the logged-in user (self) -----------------
app.get('/api/overview/me/:instId/:userId', async (req, res) => {
    const instId = req.auth.role === 'Developer' ? req.params.instId : req.auth.institutionId;
    const userId = req.auth.userId; // always "me"
    try {
        const [rows] = await db.execute(
            'SELECT id, role, class_id FROM users WHERE id = ? AND institutionId = ? LIMIT 1',
            [userId, instId]
        );
        if (!rows.length) return res.json({ role: null, class_id: null });
        res.json({ role: rows[0].role, class_id: rows[0].class_id ?? null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 



// =====================================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 SmartEdz Backend Active on Port ${PORT}`);
});