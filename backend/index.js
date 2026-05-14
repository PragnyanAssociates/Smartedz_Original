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

app.post('/api/users', async (req, res) => {
    const d = req.body;
    try {
        const query = `
            INSERT INTO users (
                username, password, full_name, email, role_id, status, 
                roll_no, admission_no, parent_name, phone_no, aadhar_no, 
                pen_no, admission_date, joining_date, experience, class_group, class_id, section_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            d.username, d.password, d.full_name, d.email || null, d.role_id, d.status || 'active',
            d.roll_no || null, d.admission_no || null, d.parent_name || null, d.phone_no || null, d.aadhar_no || null,
            d.pen_no || null, d.admission_date || null, d.joining_date || null, d.experience || null, d.class_group || null,
            d.class_id || null, d.section_id || null
        ];

        await db.query(query, values);
        res.json({ message: "User Created Successfully" });
    } catch (error) { 
        console.error("Error creating user:", error);
        res.status(500).json({ error: error.message }); 
    }
});

app.put('/api/users/:id', async (req, res) => {
    const d = req.body;
    try {
        const query = `
            UPDATE users SET 
                username=?, password=?, full_name=?, email=?, role_id=?, status=?, 
                roll_no=?, admission_no=?, parent_name=?, phone_no=?, aadhar_no=?, 
                pen_no=?, admission_date=?, joining_date=?, experience=?, class_group=?,
                class_id=?, section_id=?
            WHERE id=?
        `;
        
        const values = [
            d.username, d.password, d.full_name, d.email || null, d.role_id, d.status || 'active',
            d.roll_no || null, d.admission_no || null, d.parent_name || null, d.phone_no || null, d.aadhar_no || null,
            d.pen_no || null, d.admission_date || null, d.joining_date || null, d.experience || null, d.class_group || null,
            d.class_id || null, d.section_id || null,
            req.params.id
        ];

        await db.query(query, values);
        res.json({ message: "User Updated Successfully" });
    } catch (error) { 
        console.error("Error updating user:", error);
        res.status(500).json({ error: error.message }); 
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: "User Deleted Successfully" });
    } catch (error) { 
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

app.post('/api/academic-years', async (req, res) => {
    try {
        const { year_name, start_date, end_date } = req.body;
        await db.query('INSERT INTO academic_years (year_name, start_date, end_date, is_current) VALUES (?, ?, ?, 0)', 
            [year_name, start_date, end_date]);
        res.json({ message: "Academic Year Created" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/academic-years/:id', async (req, res) => {
    try {
        const { year_name, start_date, end_date } = req.body;
        await db.query('UPDATE academic_years SET year_name = ?, start_date = ?, end_date = ? WHERE id = ?', 
            [year_name, start_date, end_date, req.params.id]);
        res.json({ message: "Academic Year Updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/academic-years/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM academic_years WHERE id = ?', [req.params.id]);
        res.json({ message: "Academic Year Deleted" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/academic-years/set-current/:id', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE academic_years SET is_current = 0');
        await connection.query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [req.params.id]);
        await connection.commit();
        res.json({ message: "Current Year Updated" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// --- CLASS & SECTION MANAGEMENT ---
app.get('/api/classes', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM classes ORDER BY id ASC');
    res.json(rows);
});

app.post('/api/classes', async (req, res) => {
    try {
        await db.query('INSERT INTO classes (class_name) VALUES (?)', [req.body.class_name]);
        res.json({ message: "Class Created" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/classes/:id', async (req, res) => {
    try {
        await db.query('UPDATE classes SET class_name = ? WHERE id = ?', [req.body.class_name, req.params.id]);
        res.json({ message: "Class Updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/classes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM sections WHERE class_id = ?', [req.params.id]);
        await db.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
        res.json({ message: "Class and its sections deleted" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/sections', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM sections ORDER BY section_name ASC');
    res.json(rows);
});

app.post('/api/sections', async (req, res) => {
    try {
        await db.query('INSERT INTO sections (class_id, section_name) VALUES (?, ?)', [req.body.class_id, req.body.section_name]);
        res.json({ message: "Section Created" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/sections/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM sections WHERE id = ?', [req.params.id]);
        res.json({ message: "Section Deleted" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- BATCH PROMOTION ENGINE ---
app.post('/api/promotion/execute', async (req, res) => {
    const { student_ids, target_year_id, target_class_id, target_section_id } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (let id of student_ids) {
            // Update the user's master record with their new class and section
            await connection.query(
                `UPDATE users SET class_id = ?, section_id = ? WHERE id = ?`, 
                [target_class_id, target_section_id, id]
            );
            // Log it in the academic records for historical tracking
            await connection.query(
                `INSERT INTO student_academic_records (user_id, academic_year_id, class_id, section_id, status) VALUES (?,?,?,?, 'active')`,
                [id, target_year_id, target_class_id, target_section_id]
            );
        }
        await connection.commit();
        res.json({ message: "Promotion Complete" });
    } catch (error) { 
        await connection.rollback();
        res.status(500).json({ error: error.message }); 
    } finally {
        connection.release();
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ ERP Backend running on port ${PORT}`));