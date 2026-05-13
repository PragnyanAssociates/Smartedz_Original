require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// ==========================================================
// --- USER, PROFILE & PASSWORD API ROUTES Block ---
// ==========================================================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query(
            `SELECT u.*, r.role_name FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.username = ? AND u.status = 'active'`, [username]);

        if (rows.length === 0 || rows[0].password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = rows[0];
        const token = jwt.sign({ id: user.id, role: user.role_name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role_name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.*, r.role_name as role 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.full_name ASC
        `);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// UPDATED: Now handles all the new fields from the React Add User Modal
app.post('/api/users', async (req, res) => {
    const d = req.body;
    try {
        const query = `
            INSERT INTO users (
                username, password, full_name, email, role_id, status, 
                roll_no, admission_no, parent_name, phone_no, aadhar_no, 
                pen_no, admission_date, joining_date, experience, class_group
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            d.username, 
            d.password, 
            d.full_name, 
            d.email || null, 
            d.role_id, 
            d.status || 'active',
            d.roll_no || null, 
            d.admission_no || null, 
            d.parent_name || null, 
            d.phone_no || null, 
            d.aadhar_no || null,
            d.pen_no || null, 
            d.admission_date || null, 
            d.joining_date || null, 
            d.experience || null, 
            d.class_group || null
        ];

        await db.query(query, values);
        res.json({ message: "User Created Successfully" });
    } catch (error) { 
        console.error("Error creating user:", error);
        res.status(500).json({ error: error.message }); 
    }
});

// ==========================================================
// --- ROLE & PERMISSIONS MANAGEMENT API ROUTES Block ---
// ==========================================================

app.get('/api/roles', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM roles ORDER BY id ASC');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/roles', async (req, res) => {
    try {
        await db.query('INSERT INTO roles (role_name) VALUES (?)', [req.body.role_name]);
        res.json({ message: "Role Created" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/roles/:id', async (req, res) => {
    try {
        await db.query('UPDATE roles SET role_name = ? WHERE id = ?', [req.body.role_name, req.params.id]);
        res.json({ message: "Role Updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/roles/:id', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id FROM users WHERE role_id = ?', [req.params.id]);
        if (users.length > 0) return res.status(400).json({ message: "Cannot delete role. Users are assigned to it." });
        
        await db.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
        res.json({ message: "Role Deleted" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/roles/:id/permissions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM role_permissions WHERE role_id = ?', [req.params.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/roles/:id/permissions', async (req, res) => {
    const roleId = req.params.id;
    const { permissions } = req.body; 
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
        
        if (permissions && permissions.length > 0) {
            const values = permissions.map(p => [
                roleId, p.module_name, p.can_read ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0
            ]);
            await connection.query(
                'INSERT INTO role_permissions (role_id, module_name, can_read, can_edit, can_delete) VALUES ?',
                [values]
            );
        }
        
        await connection.commit();
        res.json({ message: "Permissions updated successfully" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// ==========================================================
// --- ACADEMIC STRUCTURE (YEARS, CLASSES, PROMOTION) Block ---
// ==========================================================

app.get('/api/academic-years', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM academic_years ORDER BY id DESC');
    res.json(rows);
});

app.get('/api/classes', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM classes ORDER BY class_name ASC');
    res.json(rows);
});

app.post('/api/promotion/execute', async (req, res) => {
    const { student_ids, target_year_id, target_class_id } = req.body;
    try {
        for (let id of student_ids) {
            await db.query(`INSERT INTO student_academic_records (user_id, academic_year_id, class_id, status) VALUES (?,?,?, 'active')`,
            [id, target_year_id, target_class_id]);
        }
        res.json({ message: "Promotion Complete" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(3001, () => console.log("✅ ERP Backend organized and running on 3001"));