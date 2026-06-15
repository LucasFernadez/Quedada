require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connectat a MongoDB'))
  .catch(err => console.error('Error connectant a MongoDB:', err));

// Schema de Usuario
const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  fechas: [{
    type: String,
    required: true
  }],
  creadoEn: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// ============ RUTAS API ============

// POST - Registrar disponibilidad de usuario
app.post('/api/disponibilidad', async (req, res) => {
  try {
    const { nombre, fechas } = req.body;

    // Validacions
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nom és obligatori' });
    }

    if (!fechas || fechas.length === 0) {
      return res.status(400).json({ error: 'Has de seleccionar almenys una data' });
    }

    // Verificar quants usuaris hi ha registrats
    const totalUsuarios = await User.countDocuments();

    if (totalUsuarios >= 4) {
      return res.status(400).json({
        error: 'Ja hi ha 4 usuaris registrats. Reinicia la votació per començar de nou.'
      });
    }

    // Verificar si l'usuari ja existeix
    const usuarioExistente = await User.findOne({ nombre: nombre.trim() });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Aquest nom ja està registrat' });
    }

    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre: nombre.trim(),
      fechas: fechas
    });

    await nuevoUsuario.save();

    // Verificar si ya tenemos 4 usuarios para calcular coincidencias
    const todosUsuarios = await User.find();
    
    if (todosUsuarios.length === 4) {
      // Calcular intersección de fechas
      const fechasCoincidentes = calcularInterseccion(todosUsuarios);
      
      return res.json({
        mensaje: 'Tots els usuaris han votat!',
        usuariosRegistrados: 4,
        fechasCoincidentes: fechasCoincidentes,
        completado: true
      });
    }

    res.json({
      mensaje: `Gràcies ${nombre}! La teva disponibilitat s'ha registrat.`,
      usuariosRegistrados: todosUsuarios.length,
      faltan: 4 - todosUsuarios.length,
      completado: false
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET - Obtener estado actual
app.get('/api/estado', async (req, res) => {
  try {
    const usuarios = await User.find().select('nombre fechas -_id');
    const totalUsuarios = usuarios.length;

    let resultado = {
      usuariosRegistrados: totalUsuarios,
      faltan: Math.max(0, 4 - totalUsuarios),
      usuarios: usuarios.map(u => u.nombre),
      completado: totalUsuarios >= 4
    };

    if (totalUsuarios >= 4) {
      const todosUsuarios = await User.find();
      resultado.fechasCoincidentes = calcularInterseccion(todosUsuarios);
    }

    res.json(resultado);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE - Reiniciar votación (eliminar todos los usuarios)
app.delete('/api/reiniciar', async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ mensaje: 'Votació reiniciada. Totes les dades s\'han eliminat.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ============ FUNCIONES AUXILIARES ============

function calcularInterseccion(usuarios) {
  if (usuarios.length === 0) return [];
  
  // Empezamos con las fechas del primer usuario
  let interseccion = new Set(usuarios[0].fechas);
  
  // Intersectamos con las fechas de cada usuario
  for (let i = 1; i < usuarios.length; i++) {
    const fechasUsuario = new Set(usuarios[i].fechas);
    interseccion = new Set([...interseccion].filter(fecha => fechasUsuario.has(fecha)));
  }
  
  // Convertir a array y ordenar
  return [...interseccion].sort();
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor funcionant a http://localhost:${PORT}`);
});
