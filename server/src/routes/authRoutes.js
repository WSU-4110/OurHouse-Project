const express = require('express');
const router = express.Router();
const {Pool} = require('pg');
const {signToken, hashPassword, comparePassword } =require('../auth');
const { sign } = require('jsonwebtoken');

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432 ),
    user: process.env.PGUSER || 'postgres',
    password: String(process.env.PGPASSWORD ?? ''),
    database: process.env.PGDATABASE || 'OurHouse',
    ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false} : false,
});

router.post('/register', async (req, res)=> {
    try {
        const {email, name, role, password, secretCode} = req.body;
        if (!email || !name || !role || !password) {
            return res.status(400).json({error: 'Missing field'});
        }

        //make roles require secret codes
        if (role === 'Admin') {
            const requiredSecret = process.env.ADMIN_SECRET || 'admincode';
            if (secretCode !== requiredSecret) {
                return res.status(403).json({error: 'Invalid admin secret code'});
            }
        }
        
        if (role === 'Manager') {
            const requiredSecret = process.env.MANAGER_SECRET || 'managercode';
            if (secretCode !== requiredSecret) {
                return res.status(403).json({error: 'Invalid manager secret code'});
            }
        }

        const hash = await hashPassword(password);
        const {rows} = await pool.query(
            `insert into users(email, name, role, password_hash)
            values ($1,$2,$3,$4)
            on conflict (email) do nothing
            returning id, email, name, role`,
            [email, name, role, hash]
        );
        
        if (!rows[0]) return res.status(409).json({error: 'Email exists already'});
        const token = signToken(rows[0]);
        res.json({user: rows[0], token});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({error: 'Email and password required'});
    try {
        const {rows} = await pool.query(
            'select id, email, name, role, password_hash from users where email=$1',
            [email]
        );
        const user = rows[0];
        if (!user) return res.status(401).json({error: 'Wrong credentials'});
        const ok = await comparePassword(password, user.password_hash);
        if (!ok) return res.status(401).json({error: 'Wrong credentials'});
        const token = signToken(user);
        res.json({user: {id: user.id, email: user.email, name: user.name, role: user.role}, token});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});
module.exports = router;