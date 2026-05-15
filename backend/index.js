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

// --- AUTHENTICATION ---
app.post('/api/login', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND password = ? AND role = ?',
            [email, password, role]
        );
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        
        const user = rows[0];
        const token = jwt.sign({ id: user.id, role: user.role, instId: user.institutionId }, JWT_SECRET);
        res.json({ success: true, token, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DEVELOPER ENDPOINTS ---
app.get('/api/developer/data', async (req, res) => {
    try {
        const [insts] = await db.execute('SELECT * FROM institutions ORDER BY created_at DESC');
        const [users] = await db.execute('SELECT id, name, email, role, institutionId FROM users');
        res.json({ institutions: insts, users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/developer/onboard', async (req, res) => {
    const { name, type, logo, schoolKey, superAdminName, superAdminEmail, superAdminPassword } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [inst] = await conn.execute(
            'INSERT INTO institutions (name, type, logo, schoolKey) VALUES (?, ?, ?, ?)',
            [name, type, logo, schoolKey]
        );
        const instId = inst.insertId;
        await conn.execute(
            'INSERT INTO users (name, email, password, role, institutionId) VALUES (?, ?, ?, ?, ?)',
            [superAdminName, superAdminEmail, superAdminPassword, 'Super Admin', instId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

// NEW: Update Institution
app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, logo } = req.body;
    try {
        await db.execute(
            'UPDATE institutions SET name = ?, type = ?, logo = ? WHERE id = ?',
            [name, type, logo, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NEW & UPDATED: Update Institution and its Super Admin
app.put('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, logo, superAdminName, superAdminEmail, superAdminPassword } = req.body;
    
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Update Institution Profile
        await conn.execute(
            'UPDATE institutions SET name = ?, type = ?, logo = ? WHERE id = ?',
            [name, type, logo, id]
        );

        // 2. Update the associated Super Admin user for this institution
        await conn.execute(
            'UPDATE users SET name = ?, email = ?, password = ? WHERE institutionId = ? AND role = "Super Admin"',
            [superAdminName, superAdminEmail, superAdminPassword, id]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// NEW: Delete Institution
app.delete('/api/developer/institution/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Cascade delete should be set in SQL, otherwise delete users manually here
        await db.execute('DELETE FROM institutions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SUPER ADMIN ENDPOINTS ---
app.get('/api/admin/data/:instId', async (req, res) => {
    const { instId } = req.params;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE institutionId = ?', [instId]);
        const [classes] = await db.execute('SELECT * FROM classes WHERE institutionId = ?', [instId]);
        const [years] = await db.execute('SELECT * FROM academic_years WHERE institutionId = ?', [instId]);
        const [inst] = await db.execute('SELECT * FROM institutions WHERE id = ?', [instId]);
        res.json({ users, classes, academicYears: years, institution: inst[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remaining admin routes... (omitted for brevity, keep your existing ones)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend Active on Port ${PORT}`));