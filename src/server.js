require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { verify } = require('./config/jwt');

(async () => {
  await connectDB();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);

  // Only logged-in users can open a live connection
  io.use((socket, next) => {
    try { socket.user = verify(socket.handshake.auth.token); next(); }
    catch { next(new Error('Unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.join('user:' + socket.user.id);          // personal updates
    if (socket.user.role === 'HR') socket.join('hr'); // company-wide live feed
  });

  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`Server on http://localhost:${port}`));
})().catch((e) => { console.error(e); process.exit(1); });
