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
    connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// --- AUTH & LOGIN ---
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
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = rows[0];
        const token = jwt.sign({ id: user.id, role: user.role_name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role_name } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ACADEMIC YEARS ---
app.get('/api/academic-years', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM academic_years ORDER BY id DESC');
    res.json(rows);
});

app.post('/api/academic-years', async (req, res) => {
    const { year_name, start_date, end_date } = req.body;
    await db.query('INSERT INTO academic_years (year_name, start_date, end_date) VALUES (?, ?, ?)', [year_name, start_date, end_date]);
    res.json({ message: 'Success' });
});

app.put('/api/academic-years/set-current/:id', async (req, res) => {
    await db.query('UPDATE academic_years SET is_current = 0');
    await db.query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Updated' });
});

// --- USER MANAGEMENT (For AdminLM) ---
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
    const { username, password, full_name, role, class_group, roll_no, phone_no, admission_no, parent_name, aadhar_no, pen_no, subjects_taught } = req.body;
    try {
        const [roleRow] = await db.query('SELECT id FROM roles WHERE role_name = ?', [role]);
        const role_id = roleRow[0].id;
        
        await db.query(
            `INSERT INTO users (username, password, full_name, role_id, class_group, roll_no, phone_no, admission_no, parent_name, aadhar_no, pen_no, subjects_taught) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, password, full_name, role_id, class_group, roll_no, phone_no, admission_no, parent_name, aadhar_no, pen_no, JSON.stringify(subjects_taught)]
        );
        res.json({ message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on ${PORT}`));