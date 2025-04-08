const express = require('express');
const crypto = require('crypto');
const { Server } = require('socket.io');
const http = require('http');
const database = require('./config/database');
const cache = require('./utils/cache');
const cors = require('cors');
require('dotenv').config();

// Importation des routes
const routes = require('./routes');
const descripteurRoutes = require('./routes/descripteur.routes');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
// Configuration des CORS pour Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.use(cors(corsOptions));

// Initialisation des sockets
const Sockets = require('./sockets')(io);

// Middleware Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des CORS pour Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Configuration des routes
app.use('/api', routes);
app.use('/api/descripteurs', descripteurRoutes);

// Route de base
app.get('/', (req, res) => {
  res.send('Server is running');
});

async function checkCache() {
  // Set a value in cache (expires in 60 seconds)
  await cache.set('user:123', { name: 'John', role: 'student' }, 60);
  
  // Get a value from cache
  const user = await cache.get('user:123');
  console.log(user); // { name: 'John', role: 'student' }
  
  // Delete a key
  await cache.delete('user:123');
}

// Démarrage du serveur avec test de connexion
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  checkCache()
    .then(() => console.log('Cache check completed'))
    .catch(err => console.error('Error checking cache:', err));
});