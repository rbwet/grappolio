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

// Generate unique ID for players
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Broadcast to all clients except sender
function broadcast(ws, data) {
    wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', (ws) => {
    const playerId = generateId();
    players.set(ws, { id: playerId, position: { x: 0, y: 2, z: 0 } });

    // Send initial data to new player
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Array.from(players.values())
    }));

    // Broadcast new player to others
    broadcast(ws, {
        type: 'playerJoined',
        id: playerId,
        position: { x: 0, y: 2, z: 0 }
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'position':
                    // Update player position and broadcast to others
                    if (players.has(ws)) {
                        players.get(ws).position = data.position;
                        broadcast(ws, {
                            type: 'playerMoved',
                            id: playerId,
                            position: data.position,
                            velocity: data.velocity,
                            isGrappling: data.isGrappling,
                            grapplePoint: data.grapplePoint
                        });
                    }
                    break;

                case 'chat':
                    // Broadcast chat message to all clients (including sender)
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'chat',
                                id: playerId,
                                message: data.message
                            }));
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        // Remove player and broadcast departure
        if (players.has(ws)) {
            const id = players.get(ws).id;
            players.delete(ws);
            broadcast(ws, {
                type: 'playerLeft',
                id: id
            });
        }
    });
}); 