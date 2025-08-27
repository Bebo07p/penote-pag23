// create-admin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

async function main(){
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if(!email || !password){
    console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD en .env (o variables de entorno).');
    process.exit(1);
  }
  const hashed = await bcrypt.hash(password, 12);
  try {
    const insert = db.prepare('INSERT INTO users (email, password, is_admin) VALUES (?, ?, 1)');
    insert.run(email, hashed);
    console.log('Admin creado:', email);
  } catch(e){
    if(e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.log('Admin ya existe. Si quieres cambiar la contraseña elimina el registro en la DB o actualiza manualmente.');
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}

main();
