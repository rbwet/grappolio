// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Create a ground plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Function to create a random color
function getRandomColor() {
    const colors = [
        0xff6b6b, // Red
        0x4ecdc4, // Teal
        0x45b7d1, // Blue
        0x96ceb4, // Mint
        0xffeead, // Yellow
        0xd4a4eb, // Purple
        0xff9999, // Pink
        0x87ceeb  // Sky Blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Create grapple target indicator
const targetGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const targetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6 
});
const grappleTarget = new THREE.Mesh(targetGeometry, targetMaterial);
grappleTarget.visible = false;
scene.add(grappleTarget);

// Create raycaster for grapple targeting
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0); // Center of the screen

// Store all collidable objects that can be grappled
const grappleObjects = [];

// Function to create a building
function createBuilding(x, z) {
    // More varied height range (20-80 instead of 20-50)
    const height = Math.random() * 60 + 20;
    // Larger width and depth ranges
    const width = Math.random() * 12 + 6;   // 6-18 instead of 4-12
    const depth = Math.random() * 12 + 6;   // 6-18 instead of 4-12
    
    // Add random offset to position for less grid-like feel
    const posOffset = SPACING * 0.3; // 30% of spacing for random offset
    const xOffset = (Math.random() - 0.5) * posOffset;
    const zOffset = (Math.random() - 0.5) * posOffset;
    
    // Main building
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: getRandomColor(),
        metalness: 0.2,
        roughness: 0.8
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x + xOffset, height/2, z + zOffset);
    scene.add(building);
    grappleObjects.push(building);

    // Add decorative elements with more variation
    const numDecorations = Math.floor(Math.random() * 4) + 2; // 2-5 decorations instead of 1-3
    for (let i = 0; i < numDecorations; i++) {
        const decorHeight = Math.random() * 15 + 8;  // 8-23 instead of 5-15
        const decorWidth = width * (Math.random() * 0.4 + 0.2);  // 20-60% of building width
        const decorDepth = depth * (Math.random() * 0.4 + 0.2);  // 20-60% of building depth
        
        const decorGeometry = new THREE.BoxGeometry(decorWidth, decorHeight, decorDepth);
        const decorMaterial = new THREE.MeshStandardMaterial({
            color: getRandomColor(),
            metalness: 0.3,
            roughness: 0.7
        });
        
        const decoration = new THREE.Mesh(decorGeometry, decorMaterial);
        
        // More varied decoration placement
        const yPos = Math.random() * (height - decorHeight * 0.5);  // Allow decorations to stick out more
        const xOffset = (Math.random() - 0.5) * (width - decorWidth * 0.5);
        const zOffset = (Math.random() - 0.5) * (depth - decorDepth * 0.5);
        
        decoration.position.set(x + xOffset, yPos + decorHeight/2, z + zOffset);
        scene.add(decoration);
        grappleObjects.push(decoration);
    }
}

// Generate buildings in a grid pattern
const GRID_SIZE = 7; // Increased from 5 to 7 for more buildings
const SPACING = 25;  // Increased from 15 to 25 for more spread
const OFFSET = GRID_SIZE * SPACING / 2;

for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
        // Skip the center area where the player starts
        if (!(i === Math.floor(GRID_SIZE/2) && j === Math.floor(GRID_SIZE/2))) {
            const x = i * SPACING - OFFSET;
            const z = j * SPACING - OFFSET;
            createBuilding(x, z);
        }
    }
}

// Create a player sphere
const playerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 2;
scene.add(player);

// Camera setup
camera.position.y = 2;
camera.rotation.order = 'YXZ'; // This order works better for first-person controls

// Movement and camera variables
const MOVE_SPEED = 0.1;
const MOUSE_SENSITIVITY = 0.002;
const AIR_CONTROL = 0.08;
const AIR_BRAKE = 0.92;
const MOMENTUM_INFLUENCE = 0.7;
const LATERAL_CONTROL_BOOST = 1.5;

// Physics constants
const GRAVITY = 0.025;
const AIR_RESISTANCE = 0.992;        // Slightly less air resistance for better control
const GRAPPLE_REEL_SPEED = 0.15;     // Reduced reel speed
const MAX_GRAPPLE_DISTANCE = 50;
const GROUND_LEVEL = 2;
const TAP_BOOST_FORCE = 0.3;         // Reduced initial boost
const TAP_UPWARD_BOOST = 0.25;       // Reduced upward boost
const REEL_START_DELAY = 150;
const AIR_CONTROL_STRENGTH = 0.06;   // Increased air control
const MAX_AIR_SPEED = 1.2;          // Speed cap for better control

// Add after the physics constants
const COLLISION_CHECK_RADIUS = 1.0; // Radius around player to check for collisions

let cameraRotation = {
    horizontal: 0,
    vertical: 0
};

// Add grapple state to player
const playerState = {
    velocity: new THREE.Vector3(),
    isGrappling: false,
    grapplePoint: null,
    ropeLength: 0,
    isGrounded: false,
    grappleStartTime: 0,    // Track when grapple started
    isReeling: false        // Whether we're actively reeling in
};

// Create grapple rope line
const ropeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
ropeGeometry.rotateX(Math.PI / 2);
const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
rope.visible = false;
scene.add(rope);

// Add space key to input handling
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

// Input handling
window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case ' ': keys.space = true; break;
        case 'escape':
            if (document.pointerLockElement === renderer.domElement) {
                document.exitPointerLock();
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case ' ': keys.space = false; break;
    }
});

// Mouse controls
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove);
    } else {
        document.removeEventListener('mousemove', onMouseMove);
    }
});

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

function onMouseMove(event) {
    if (document.pointerLockElement === renderer.domElement) {
        cameraRotation.horizontal -= event.movementX * MOUSE_SENSITIVITY;
        cameraRotation.vertical = Math.max(-Math.PI/2, Math.min(Math.PI/2, 
            cameraRotation.vertical - event.movementY * MOUSE_SENSITIVITY));
    }
}

function updateRope() {
    if (playerState.isGrappling) {
        const toGrapple = playerState.grapplePoint.clone().sub(player.position);
        const distance = toGrapple.length();
        
        // Update rope visual
        rope.scale.z = distance;
        rope.position.copy(player.position);
        rope.lookAt(playerState.grapplePoint);
        rope.position.add(toGrapple.multiplyScalar(0.5));
    }
}

// Add this new function before updateGrapplePhysics
function checkBuildingCollisions() {
    const playerPos = player.position.clone();
    const nextPos = playerPos.clone().add(playerState.velocity);
    
    // Check for collisions with buildings and their decorations
    for (const object of grappleObjects) {
        const box = new THREE.Box3().setFromObject(object);
        
        // Expand box slightly to account for player radius
        box.min.subScalar(COLLISION_CHECK_RADIUS);
        box.max.addScalar(COLLISION_CHECK_RADIUS);
        
        if (box.containsPoint(nextPos)) {
            // Get the closest point on the box to the player
            const closestPoint = nextPos.clone().clamp(box.min, box.max);
            const penetration = nextPos.clone().sub(closestPoint);
            
            // Determine which face we hit (top, sides, bottom)
            const eps = 0.1; // Small threshold for top/bottom detection
            if (Math.abs(penetration.y) > eps && 
                Math.abs(penetration.x) < Math.abs(penetration.y) && 
                Math.abs(penetration.z) < Math.abs(penetration.y)) {
                
                if (penetration.y < 0) {
                    // Hit the top - land on it
                    playerState.velocity.y = 0;
                    nextPos.y = box.max.y;
                    playerState.isGrounded = true;
                } else {
                    // Hit the bottom - stop upward movement
                    playerState.velocity.y = 0;
                    nextPos.y = box.min.y;
                }
            } else {
                // Hit the sides - slide along the wall
                if (Math.abs(penetration.x) > Math.abs(penetration.z)) {
                    playerState.velocity.x = 0;
                    nextPos.x = closestPoint.x;
                } else {
                    playerState.velocity.z = 0;
                    nextPos.z = closestPoint.z;
                }
            }
            
            // Update position after collision
            player.position.copy(nextPos);
            return true;
        }
    }
    return false;
}

// Modify updateGrapplePhysics to include building collisions
function updateGrapplePhysics() {
    if (!playerState.isGrappling) {
        // Normal gravity when not grappling
        if (!playerState.isGrounded) {
            playerState.velocity.y -= GRAVITY;
            
            // Enhanced air control
            if (keys.w || keys.s || keys.a || keys.d) {
                const moveDirection = new THREE.Vector3();
                if (keys.w) moveDirection.z -= 1;
                if (keys.s) moveDirection.z += 1;
                if (keys.a) moveDirection.x += 1;
                if (keys.d) moveDirection.x -= 1;
                moveDirection.normalize();

                // Convert to world space
                const cameraDirection = new THREE.Vector3(0, 0, -1);
                cameraDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.horizontal);
                cameraDirection.y = 0;
                cameraDirection.normalize();
                
                const right = new THREE.Vector3();
                right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
                
                const worldMoveDir = new THREE.Vector3();
                worldMoveDir.addScaledVector(cameraDirection, -moveDirection.z);
                worldMoveDir.addScaledVector(right, moveDirection.x);
                worldMoveDir.normalize();

                // More responsive air control that preserves momentum
                const currentHorizontalSpeed = new THREE.Vector2(playerState.velocity.x, playerState.velocity.z).length();
                const controlForce = AIR_CONTROL_STRENGTH * (1 + (MAX_AIR_SPEED - currentHorizontalSpeed) * 0.5);
                
                playerState.velocity.x += worldMoveDir.x * controlForce;
                playerState.velocity.z += worldMoveDir.z * controlForce;

                // Cap horizontal speed
                const horizontalVelocity = new THREE.Vector2(playerState.velocity.x, playerState.velocity.z);
                if (horizontalVelocity.length() > MAX_AIR_SPEED) {
                    horizontalVelocity.normalize().multiplyScalar(MAX_AIR_SPEED);
                    playerState.velocity.x = horizontalVelocity.x;
                    playerState.velocity.z = horizontalVelocity.y;
                }
            }
        }
    } else {
        // Spear-like grappling physics
        const toGrapple = playerState.grapplePoint.clone().sub(player.position);
        const distance = toGrapple.length();
        const grappleDir = toGrapple.normalize();

        // More gravity influence while grappling
        playerState.velocity.y -= GRAVITY * 0.85;

        if (keys.space && Date.now() - playerState.grappleStartTime > REEL_START_DELAY) {
            // Holding space - smoother reel in towards point
            playerState.isReeling = true;
            
            // More gradual acceleration when reeling
            const reelStrength = Math.min((distance - 5) * 0.01, GRAPPLE_REEL_SPEED);
            const reelForce = grappleDir.multiplyScalar(reelStrength);
            playerState.velocity.add(reelForce);

            // Gentler rope tension
            if (distance > playerState.ropeLength) {
                const tensionForce = Math.min((distance - playerState.ropeLength) * 0.03, 0.1);
                playerState.velocity.add(grappleDir.multiplyScalar(tensionForce));
            }
        } else if (!playerState.isReeling) {
            // Just the initial tap boost - very light rope tension
            if (distance > playerState.ropeLength) {
                const tensionForce = Math.min((distance - playerState.ropeLength) * 0.015, 0.06);
                playerState.velocity.add(grappleDir.multiplyScalar(tensionForce));
            }
        }

        // Enhanced mid-air control while grappling
        if (keys.w || keys.s || keys.a || keys.d) {
            const moveDirection = new THREE.Vector3();
            if (keys.w) moveDirection.z -= 1;
            if (keys.s) moveDirection.z += 1;
            if (keys.a) moveDirection.x += 1;
            if (keys.d) moveDirection.x -= 1;
            moveDirection.normalize();

            // Convert to world space
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.horizontal);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            
            const right = new THREE.Vector3();
            right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
            
            const worldMoveDir = new THREE.Vector3();
            worldMoveDir.addScaledVector(cameraDirection, -moveDirection.z);
            worldMoveDir.addScaledVector(right, moveDirection.x);
            worldMoveDir.normalize();

            // Apply air control while grappling
            playerState.velocity.x += worldMoveDir.x * AIR_CONTROL_STRENGTH * 0.7;
            playerState.velocity.z += worldMoveDir.z * AIR_CONTROL_STRENGTH * 0.7;
        }

        // Smoother speed limiting
        const speed = playerState.velocity.length();
        if (speed > MAX_AIR_SPEED) {
            playerState.velocity.multiplyScalar(1 - (speed - MAX_AIR_SPEED) * 0.1);
        }
    }

    // Apply air resistance
    playerState.velocity.multiplyScalar(AIR_RESISTANCE);

    // Check for building collisions before updating position
    const hadCollision = checkBuildingCollisions();
    
    if (!hadCollision) {
        // Only update position if no collision occurred
        player.position.add(playerState.velocity);
    }

    // Ground collision check (only if not on a building)
    if (!hadCollision && player.position.y < GROUND_LEVEL) {
        player.position.y = GROUND_LEVEL;
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
    } else if (!hadCollision) {
        playerState.isGrounded = false;
    }
}

// Update the updatePlayer function
function updatePlayer() {
    // Ground movement (when not grappling)
    if (!playerState.isGrappling) {
        const moveDirection = new THREE.Vector3();
        if (keys.w) moveDirection.z -= 1;
        if (keys.s) moveDirection.z += 1;
        if (keys.a) moveDirection.x += 1;
        if (keys.d) moveDirection.x -= 1;
        moveDirection.normalize();

        if (moveDirection.length() > 0) {
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.horizontal);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            
            const right = new THREE.Vector3();
            right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
            
            const rotatedDirection = new THREE.Vector3();
            rotatedDirection.addScaledVector(cameraDirection, -moveDirection.z);
            rotatedDirection.addScaledVector(right, moveDirection.x);
            rotatedDirection.normalize();
            
            // Only apply horizontal movement when grounded
            if (playerState.isGrounded) {
                playerState.velocity.x = rotatedDirection.x * MOVE_SPEED;
                playerState.velocity.z = rotatedDirection.z * MOVE_SPEED;
            } else {
                // Reduced air control
                playerState.velocity.x += rotatedDirection.x * MOVE_SPEED * 0.1;
                playerState.velocity.z += rotatedDirection.z * MOVE_SPEED * 0.1;
            }
        } else if (playerState.isGrounded) {
            // Stop horizontal movement when grounded and not moving
            playerState.velocity.x *= 0.8;
            playerState.velocity.z *= 0.8;
        }
    }

    // Grapple control
    if (keys.space && !playerState.isGrappling && grappleTarget.visible) {
        // Start grapple
        playerState.isGrappling = true;
        playerState.isReeling = false;
        playerState.grapplePoint = grappleTarget.position.clone();
        playerState.ropeLength = player.position.distanceTo(playerState.grapplePoint);
        playerState.grappleStartTime = Date.now();
        rope.visible = true;

        // Smoother initial tap boost
        const toGrapple = playerState.grapplePoint.clone().sub(player.position);
        const grappleDir = toGrapple.normalize();
        
        // Add upward component to initial boost
        const boostDir = new THREE.Vector3(
            grappleDir.x * 0.8,  // Reduced horizontal influence
            grappleDir.y + TAP_UPWARD_BOOST,
            grappleDir.z * 0.8   // Reduced horizontal influence
        ).normalize();
        
        // Preserve some existing momentum
        const currentSpeed = playerState.velocity.length();
        playerState.velocity.multiplyScalar(0.5);  // Maintain some existing momentum
        playerState.velocity.add(boostDir.multiplyScalar(TAP_BOOST_FORCE + currentSpeed * 0.2));
    } else if (!keys.space && playerState.isGrappling) {
        // Release grapple
        playerState.isGrappling = false;
        playerState.isReeling = false;
        rope.visible = false;
        
        // Smoother momentum preservation
        playerState.velocity.multiplyScalar(1.05); // Gentler speed boost on release
    }

    // Update physics
    updateGrapplePhysics();
    updateRope();

    // Update camera
    camera.position.copy(player.position);
    camera.rotation.y = cameraRotation.horizontal;
    camera.rotation.x = cameraRotation.vertical;

    // Send position update to server
    if (ws && ws.readyState === WebSocket.OPEN && playerId) {
        ws.send(JSON.stringify({
            type: 'position',
            id: playerId,
            position: player.position,
            velocity: playerState.velocity,
            isGrappling: playerState.isGrappling,
            grapplePoint: playerState.isGrappling ? playerState.grapplePoint : null
        }));
    }
}

// Function to update grapple target position
function updateGrappleTarget() {
    // Update the raycaster with the camera's position and direction
    raycaster.setFromCamera(center, camera);
    
    // Check for intersections with grappleable objects
    const intersects = raycaster.intersectObjects(grappleObjects);
    
    if (intersects.length > 0) {
        // Show target at intersection point
        const intersectionPoint = intersects[0].point;
        grappleTarget.position.copy(intersectionPoint);
        grappleTarget.visible = true;
    } else {
        // Hide target if no intersection
        grappleTarget.visible = false;
    }
}

// Update the animation loop to include grapple target updates
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    updateGrappleTarget();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add after scene setup
const otherPlayers = new Map();
let playerId = null;
let ws = null;

// Create player mesh factory function
function createPlayerMesh() {
    const playerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    return new THREE.Mesh(playerGeometry, playerMaterial);
}

// Create other player's rope
function createRopeMesh() {
    const ropeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
    ropeGeometry.rotateX(Math.PI / 2);
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    return new THREE.Mesh(ropeGeometry, ropeMaterial);
}

// Setup WebSocket connection
function setupMultiplayer() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3000`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'init':
                playerId = data.id;
                // Add existing players
                data.players.forEach(playerData => {
                    addOtherPlayer(playerData.id, playerData.position);
                });
                break;

            case 'playerJoined':
                if (data.id !== playerId) {
                    addOtherPlayer(data.id, data.position);
                }
                break;

            case 'playerMoved':
                if (data.id !== playerId && otherPlayers.has(data.id)) {
                    const otherPlayer = otherPlayers.get(data.id);
                    otherPlayer.mesh.position.copy(data.position);
                    otherPlayer.velocity.copy(data.velocity);
                    
                    // Update rope if player is grappling
                    if (data.isGrappling && data.grapplePoint) {
                        otherPlayer.rope.visible = true;
                        const toGrapple = new THREE.Vector3(
                            data.grapplePoint.x,
                            data.grapplePoint.y,
                            data.grapplePoint.z
                        ).sub(otherPlayer.mesh.position);
                        
                        otherPlayer.rope.scale.z = toGrapple.length();
                        otherPlayer.rope.position.copy(otherPlayer.mesh.position);
                        otherPlayer.rope.lookAt(data.grapplePoint);
                        otherPlayer.rope.position.add(toGrapple.multiplyScalar(0.5));
                    } else {
                        otherPlayer.rope.visible = false;
                    }
                }
                break;

            case 'playerLeft':
                if (otherPlayers.has(data.id)) {
                    const playerToRemove = otherPlayers.get(data.id);
                    scene.remove(playerToRemove.mesh);
                    scene.remove(playerToRemove.rope);
                    otherPlayers.delete(data.id);
                }
                break;
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
    };
}

function addOtherPlayer(id, position) {
    const playerMesh = createPlayerMesh();
    playerMesh.position.copy(position);
    
    const ropeMesh = createRopeMesh();
    ropeMesh.visible = false;
    
    scene.add(playerMesh);
    scene.add(ropeMesh);
    
    otherPlayers.set(id, {
        mesh: playerMesh,
        rope: ropeMesh,
        velocity: new THREE.Vector3()
    });
}

// Call setupMultiplayer after scene setup
setupMultiplayer();

// Start animation
animate();  