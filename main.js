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
    const height = Math.random() * 30 + 20;
    const width = Math.random() * 8 + 4;
    const depth = Math.random() * 8 + 4;
    
    // Main building
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: getRandomColor(),
        metalness: 0.2,
        roughness: 0.8
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x, height/2, z);
    scene.add(building);
    grappleObjects.push(building); // Add to grappleable objects

    // Add decorative elements
    const numDecorations = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numDecorations; i++) {
        const decorHeight = Math.random() * 10 + 5;
        const decorWidth = width * 0.3;
        const decorDepth = depth * 0.3;
        
        const decorGeometry = new THREE.BoxGeometry(decorWidth, decorHeight, decorDepth);
        const decorMaterial = new THREE.MeshStandardMaterial({
            color: getRandomColor(),
            metalness: 0.3,
            roughness: 0.7
        });
        
        const decoration = new THREE.Mesh(decorGeometry, decorMaterial);
        const yPos = Math.random() * (height - decorHeight) + decorHeight/2;
        const xOffset = (Math.random() - 0.5) * (width - decorWidth);
        const zOffset = (Math.random() - 0.5) * (depth - decorDepth);
        
        decoration.position.set(x + xOffset, yPos, z + zOffset);
        scene.add(decoration);
        grappleObjects.push(decoration); // Add to grappleable objects
    }
}

// Generate buildings in a grid pattern
const GRID_SIZE = 5; // 5x5 grid of buildings
const SPACING = 15;  // 15 units between buildings
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

let cameraRotation = {
    horizontal: 0,
    vertical: 0
};

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Input handling
window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
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

function updatePlayer() {
    // Movement
    const moveDirection = new THREE.Vector3();
    if (keys.w) moveDirection.z -= 1;
    if (keys.s) moveDirection.z += 1;
    if (keys.a) moveDirection.x += 1;
    if (keys.d) moveDirection.x -= 1;
    moveDirection.normalize();

    // Transform movement direction based on camera angle
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
        
        // Apply movement
        player.position.x += rotatedDirection.x * MOVE_SPEED;
        player.position.z += rotatedDirection.z * MOVE_SPEED;
    }

    // Update camera position and rotation
    camera.position.copy(player.position);
    camera.rotation.y = cameraRotation.horizontal;
    camera.rotation.x = cameraRotation.vertical;
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

// Start animation
animate(); 