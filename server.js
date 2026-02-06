require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
// Aquí es donde vivirán tus HTML, CSS y JS de la interfaz
app.use(express.static('public'));

// Configuración de subida de archivos temporales (CSV)
const upload = multer({ dest: 'uploads/' });

// --- CONEXIÓN A BASE DE DATOS (TiDB Cloud) ---
const db = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 4000,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// 1. Ruta para buscar productos (Etiquetas)
app.get('/api/producto/:codigo', async (req, res) => {
    const { codigo } = req.params;
    try {
        const [results] = await db.query("SELECT codigo, descripcion, precio_unitario AS precio FROM productos WHERE codigo = ?", [codigo]);
        if (results.length > 0) {
            res.json({ success: true, ...results[0] });
        } else {
            res.json({ success: false, message: "No encontrado" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Ruta de Login
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const [results] = await db.query("SELECT usuario, rol, sucursal FROM usuarios WHERE usuario = ? AND password = ?", [usuario, password]);
        if (results.length > 0) {
            res.json({ 
                success: true, 
                nombre: results[0].usuario, 
                rol: results[0].rol, 
                sucursal: results[0].sucursal 
            });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Ruta: Actualización Masiva de Precios
app.post('/api/actualizar-precios', upload.single('archivoCsv'), (req, res) => {
    const rolUsuario = req.headers['user-role'];
    
    if (rolUsuario !== 'admin') {
        return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    const resultados = [];
    if (!req.file) return res.status(400).json({ success: false, message: "No se recibió archivo" });

    fs.createReadStream(req.file.path)
        .pipe(csv({ 
            separator: ';', 
            mapHeaders: ({ header }) => header.trim().toLowerCase() 
        }))
        .on('data', (data) => {
            if (data.codigo || data.cod) resultados.push(data);
        })
        .on('end', async () => {
            try {
                let contador = 0;
                for (const fila of resultados) {
                    const codigo = fila.codigo || fila.cod;
                    let precioRaw = fila.precio_unitario || fila.precio;

                    if (codigo && precioRaw) {
                        let precioLimpio = precioRaw.toString().replace(',', '.');
                        const [resUpdate] = await db.query(
                            "UPDATE productos SET precio_unitario = ? WHERE codigo = ?",
                            [precioLimpio, codigo]
                        );
                        if (resUpdate.affectedRows > 0) contador++;
                    }
                }
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                res.json({ success: true, count: contador });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor One Box operativo en puerto ${PORT}`));