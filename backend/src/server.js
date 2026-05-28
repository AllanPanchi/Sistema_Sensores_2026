import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares base
app.use(cors());
app.use(express.json()); // Permite recibir datos en formato JSON

// Ruta de prueba
app.get('/api/health', (req, res) => {
    res.json({ 
        estado: 'Activo', 
        mensaje: 'Bienvenido al backend de HidroSentinel',
        tiempo: new Date()
    });
});

// Levantar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});