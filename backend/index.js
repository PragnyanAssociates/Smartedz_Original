require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// ==========================================
// 1. AUTHENTICATION & LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query(
            `SELECT u.*, r.role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.username = ? AND u.status = 'active'`, 
            [username]
        );

        if (rows.length === 0 || rows[0].password !== password) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = rows[0];
        const token = jwt.sign({ id: user.id, role: user.role_name }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                full_name: user.full_name, 
                role: user.role_name 
            } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. DYNAMIC ROLES MANAGEMENT
// ==========================================
app.get('/api/roles', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM roles ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/roles', async (req, res) => {
    const { role_name } = req.body;
    try {
        await db.query('INSERT INTO roles (role_name) VALUES (?)', [role_name]);
        res.json({ message: 'Role created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. DYNAMIC CLASSES & SECTIONS
// ==========================================
app.get('/api/classes', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM classes ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/classes', async (req, res) => {
    const { class_name, sections } = req.body; // sections = ["A", "B"]
    try {
        const [result] = await db.query('INSERT INTO classes (class_name) VALUES (?)', [class_name]);
        const classId = result.insertId;

        if (sections && sections.length > 0) {
            const values = sections.map(s => [classId, s]);
            await db.query('INSERT INTO sections (class_id, section_name) VALUES ?', [values]);
        }
        res.json({ message: 'Class and Sections created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sections/:classId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sections WHERE class_id = ?', [req.params.classId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 4. ACADEMIC YEAR MANAGEMENT
// ==========================================
app.get('/api/academic-years', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM academic_years ORDER BY id DESC');
    res.json(rows);
});

app.post('/api/academic-years', async (req, res) => {
    const { year_name, start_date, end_date } = req.body;
    await db.query('INSERT INTO academic_years (year_name, start_date, end_date) VALUES (?, ?, ?)', [year_name, start_date, end_date]);
    res.json({ message: 'Academic Year Added' });
});

app.put('/api/academic-years/set-current/:id', async (req, res) => {
    try {
        await db.query('UPDATE academic_years SET is_current = 0');
        await db.query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Current Year Updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. USER MANAGEMENT (IDENTITY)
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.*, r.role_name as role 
            FROM users u 
            JOIN roles r ON u.role_id = r.id
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    const data = req.body;
    try {
        const [roleRow] = await db.query('SELECT id FROM roles WHERE role_name = ?', [data.role]);
        if (roleRow.length === 0) return res.status(400).json({ message: "Role not found" });
        const role_id = roleRow[0].id;

        const [result] = await db.query(
            `INSERT INTO users (username, password, full_name, role_id, phone_no, email, roll_no, admission_no, parent_name, aadhar_no, pen_no, admission_date, joining_date, class_group) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.username, data.password, data.full_name, role_id, data.phone_no, data.email, data.roll_no, data.admission_no, data.parent_name, data.aadhar_no, data.pen_no, data.admission_date, data.joining_date, data.class_group]
        );

        // If user is a student, we also need to create their FIRST academic record for the CURRENT year
        if (data.role === 'Student' && data.class_id) {
            const [currentYear] = await db.query('SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1');
            if (currentYear.length > 0) {
                await db.query(
                    `INSERT INTO student_academic_records (user_id, academic_year_id, class_id, section_id, roll_no) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [result.insertId, currentYear[0].id, data.class_id, data.section_id, data.roll_no]
                );
            }
        }

        res.json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
});

// ==========================================
// 6. STUDENT PROMOTION (ACADEMIC CONTEXT)
// ==========================================
app.post('/api/students/promote', async (req, res) => {
    const { student_ids, target_year_id, target_class_id, target_section_id } = req.body;
    try {
        // We do NOT update old records. We insert NEW records for the NEW academic year.
        // This is how history is preserved.
        for (let studentId of student_ids) {
            await db.query(
                `INSERT INTO student_academic_records (user_id, academic_year_id, class_id, section_id, status) 
                 VALUES (?, ?, ?, ?, 'active')`,
                [studentId, target_year_id, target_class_id, target_section_id]
            );
        }
        res.json({ message: 'Promotion completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get students belonging to a specific Class and Year
app.get('/api/students/filter', async (req, res) => {
    const { year_id, class_id, section_id } = req.query;
    try {
        let query = `
            SELECT u.id, u.full_name, u.username, sar.roll_no, sar.status 
            FROM student_academic_records sar
            JOIN users u ON sar.user_id = u.id
            WHERE sar.academic_year_id = ? AND sar.class_id = ?
        `;
        let params = [year_id, class_id];
        
        if (section_id) {
            query += " AND sar.section_id = ?";
            params.push(section_id);
        }

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📂 Add these to index.js

// 1. Get students for a specific Year and Class
app.get('/api/promotion/students', async (req, res) => {
    const { year_id, class_id } = req.query;
    try {
        const [rows] = await db.query(`
            SELECT u.id, u.full_name, u.username, sar.roll_no 
            FROM student_academic_records sar
            JOIN users u ON sar.user_id = u.id
            WHERE sar.academic_year_id = ? AND sar.class_id = ? AND sar.status = 'active'
        `, [year_id, class_id]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Batch Promotion Logic
app.post('/api/promotion/execute', async (req, res) => {
    const { student_ids, target_year_id, target_class_id, promote_all } = req.body;
    
    // We use a transaction to ensure all students are promoted or none at all
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        for (let studentId of student_ids) {
            // Create the context for the NEW year
            await connection.query(`
                INSERT INTO student_academic_records 
                (user_id, academic_year_id, class_id, status) 
                VALUES (?, ?, ?, 'active')
            `, [studentId, target_year_id, target_class_id]);
        }

        await connection.commit();
        res.json({ message: `Successfully promoted ${student_ids.length} students` });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on Port ${PORT}`));