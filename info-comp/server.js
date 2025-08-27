// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecret';
const IMAGE_MAX_BYTES = Number(process.env.IMAGE_MAX_BYTES || 2_000_000); // 2MB

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './' }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24*60*60*1000 }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH helpers ---
function loginUser(req, user){
  req.session.userId = user.id;
  req.session.isAdmin = !!user.is_admin;
}

function ensureAuth(req, res, next){
  if(req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function ensureAdmin(req, res, next){
  if(req.session && req.session.isAdmin) return next();
  return res.status(403).json({ error: 'Forbidden - admin only' });
}

// --- Multer config (memory storage, then process with sharp) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES }
});

// --- Routes ---

// Create admin at startup if ADMIN_* env provided and no admin exists
(function createAdminIfNeeded(){
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if(!adminEmail || !adminPassword) return;
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
  if(!existing){
    (async ()=>{
      const hashed = await bcrypt.hash(adminPassword, 12);
      try {
        db.prepare('INSERT INTO users (email, password, is_admin) VALUES (?, ?, 1)').run(adminEmail, hashed);
        console.log('Admin creado desde variables de entorno:', adminEmail);
      } catch(e) { console.error('Error creando admin:', e); }
    })();
  } else {
    console.log('Admin ya existe en DB:', adminEmail);
  }
})();

// Auth APIs
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({ error: 'email y password requeridos' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if(!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  loginUser(req, user);
  res.json({ success: true, isAdmin: !!user.is_admin });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(()=>res.json({ success: true }));
});

// Public: get all infos (only info list for visitors)
app.get('/api/info', (req, res) => {
  const infos = db.prepare('SELECT id, name, description, image_filename, created_at FROM infos ORDER BY created_at DESC').all();
  const mapped = infos.map(i => ({
    id: i.id,
    name: i.name,
    description: i.description,
    image_url: i.image_filename ? `/uploads/${i.image_filename}` : null,
    created_at: i.created_at
  }));
  res.json(mapped);
});

// Admin: create info (multipart with image)
app.post('/api/info', ensureAuth, ensureAdmin, upload.single('image'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if(!name) return res.status(400).json({ error: 'name requerido' });

    let filename = null;
    if(req.file){
      // Validate MIME
      if(!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)){
        return res.status(400).json({ error: 'Tipo de imagen no permitido' });
      }
      const ext = req.file.mimetype === 'image/png' ? '.png' : (req.file.mimetype === 'image/webp' ? '.webp' : '.jpg');
      filename = uuidv4() + ext;
      const outPath = path.join(UPLOAD_DIR, filename);

      // Process with sharp (resize to max 1200px, keep aspect ratio)
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside' })
        .toFormat('jpeg', { quality: 82 })
        .toFile(outPath);
    }

    const stmt = db.prepare('INSERT INTO infos (name, description, image_filename, created_by) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, description, filename, req.session.userId);
    const newInfo = db.prepare('SELECT id, name, description, image_filename, created_at FROM infos WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      id: newInfo.id,
      name: newInfo.name,
      description: newInfo.description,
      image_url: newInfo.image_filename ? `/uploads/${newInfo.image_filename}` : null,
      created_at: newInfo.created_at
    });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Serve uploaded images (static)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

// Small route to get current session info
app.get('/api/session', (req, res) => {
  if(req.session && req.session.userId){
    return res.json({ authenticated: true, isAdmin: !!req.session.isAdmin });
  }
  res.json({ authenticated: false });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
