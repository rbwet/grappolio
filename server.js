const WebSocket = require('ws');
const express = require('express');
const app = express();
const port = 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files
app.use(express.static('.'));

// Listen on all network interfaces
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    // Get local IP address
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Local network URL: http://${net.address}:${port}`);
            }
        }
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected players
const players = new Map();

wss.on('connection', (ws) => {
    // Assign unique ID to new player
    const playerId = Date.now().toString();
    players.set(playerId, { ws, position: { x: 0, y: 2, z: 0 }, velocity: { x: 0, y: 0, z: 0 } });
    
    console.log(`Player ${playerId} connected`);
    
    // Send player their ID
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Array.from(players.entries()).map(([id, data]) => ({
            id,
            position: data.position,
            velocity: data.velocity
        })).filter(p => p.id !== playerId)
    }));

    // Broadcast new player to others
    broadcast({
        type: 'playerJoined',
        id: playerId,
        position: players.get(playerId).position
    }, playerId);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'position':
                // Update player position and broadcast to others
                if (players.has(data.id)) {
                    players.get(data.id).position = data.position;
                    players.get(data.id).velocity = data.velocity;
                    broadcast({
                        type: 'playerMoved',
                        id: data.id,
                        position: data.position,
                        velocity: data.velocity,
                        isGrappling: data.isGrappling,
                        grapplePoint: data.grapplePoint
                    }, data.id);
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log(`Player ${playerId} disconnected`);
        players.delete(playerId);
        broadcast({
            type: 'playerLeft',
            id: playerId
        });
    });
});

function broadcast(message, excludeId = null) {
    const messageStr = JSON.stringify(message);
    players.forEach((player, id) => {
        if (id !== excludeId) {
            player.ws.send(messageStr);
        }
    });
} 