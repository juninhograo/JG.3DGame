// Initialize Babylon.js scene
const canvas = document.getElementById('gameCanvas');
const engine = new BABYLON.Engine(canvas, true);

// Create the game scene
const scene = new BABYLON.Scene(engine);
scene.collisionsEnabled = true;
scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

// Create camera (first-person view)
const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 2, -10));
camera.attachControl(canvas, true); // Keep browser default events so UI overlays can scroll
camera.inertia = 0.7;
camera.speed = 0; // We'll control movement manually
camera.angularSensibility = 1000;
camera.minZ = 0.05; // Allow close objects (sword viewmodel) to render
camera.collisionsEnabled = false;
camera.checkCollisions = false;

// Setup minimap
const minimapCanvas = document.getElementById('minimapCanvas');
minimapCanvas.width = 70;
minimapCanvas.height = 70;
const minimapCtx = minimapCanvas.getContext('2d');
const MINIMAP_SCALE = 0.175; // Units to pixels conversion (scaled down)
const MINIMAP_SIZE = 70;
const MINIMAP_CENTER = MINIMAP_SIZE / 2;

// Player properties
const player = {
    health: 3,
    isJumping: false,
    velocityY: 0,
    groundLevel: 2,
    jumpForce: 0.216, // 20% higher than 0.18
    gravity: 0.01,
    currentY: 2,
    hasSword: false,
    sword: null,
    swimArms: null,
    lastSwordAttack: 0,
    swordCooldown: 500, // milliseconds
    lastDamagedZombies: new Set(), // Track zombies hit by current sword swing
    hasWaterSlash: false,
    lastWaterSlash: 0,
    waterSlashCooldown: 5000, // milliseconds
    hasWindSlash: false,
    lastWindSlash: 0,
    windSlashCooldown: 3000,
    hasFireSlash: false,
    lastFireSlash: 0,
    fireSlashCooldown: 4000,
    lastDarkEnergy: 0,
    darkEnergyCooldown: 10000,
    hasDarkEnergy: false,
    _darkComboStart: 0,
    _darkComboFired: false
};

// Create light
const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.4;
light.diffuse = new BABYLON.Color3(0.8, 0.8, 0.8);
light.specular = new BABYLON.Color3(0.2, 0.2, 0.2);

// Function to update health bar display
function updateHealthBar() {
    const healthFill = document.getElementById('healthFill');
    const healthText = document.getElementById('healthText');
    const healthPercent = (player.health / 3) * 100;
    healthFill.style.width = healthPercent + '%';
    healthText.textContent = `Health: ${player.health}/3`;
}

// Initialize health bar
updateHealthBar();

// Function to create a 3D health bar for a zombie
function createZombieHealthBar(zombie) {
    const barGroup = new BABYLON.TransformNode('healthBarGroup_' + Math.random(), scene);
    barGroup.parent = zombie.group;
    barGroup.position = new BABYLON.Vector3(0, 2.5, 0); // Above zombie head
    
    // Background bar (dark red)
    const barBackground = BABYLON.MeshBuilder.CreateBox('barBg_' + Math.random(), { width: 1.2, height: 0.15, depth: 0.05 }, scene);
    barBackground.parent = barGroup;
    const bgMat = new BABYLON.StandardMaterial('barBgMat_' + Math.random(), scene);
    bgMat.diffuse = new BABYLON.Color3(0.3, 0.1, 0.1);
    bgMat.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.05);
    barBackground.material = bgMat;
    
    // Health fill bar (green)
    const healthFill = BABYLON.MeshBuilder.CreateBox('healthFill_' + Math.random(), { width: 1.0, height: 0.13, depth: 0.06 }, scene);
    healthFill.parent = barGroup;
    healthFill.position.z = 0.01;
    const fillMat = new BABYLON.StandardMaterial('fillMat_' + Math.random(), scene);
    fillMat.diffuse = new BABYLON.Color3(0.0, 1.0, 0.0);
    fillMat.emissiveColor = new BABYLON.Color3(0.0, 0.5, 0.0);
    healthFill.material = fillMat;
    
    return {
        barGroup: barGroup,
        healthFill: healthFill,
        fillMat: fillMat
    };
}

// Function to update zombie health bar display
function updateZombieHealthBar(zombie) {
    if (!zombie.healthBar || !zombie.healthBar.healthFill) return;
    
    const healthPercent = zombie.health / 2; // Max health is 2
    zombie.healthBar.healthFill.scaling.x = Math.max(0, healthPercent);
    
    // Change color based on health
    if (zombie.health >= 1.5) {
        zombie.healthBar.fillMat.diffuse = new BABYLON.Color3(0.0, 1.0, 0.0); // Green
        zombie.healthBar.fillMat.emissiveColor = new BABYLON.Color3(0.0, 0.5, 0.0);
    } else if (zombie.health > 0.5) {
        zombie.healthBar.fillMat.diffuse = new BABYLON.Color3(1.0, 1.0, 0.0); // Yellow
        zombie.healthBar.fillMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.0);
    } else {
        zombie.healthBar.fillMat.diffuse = new BABYLON.Color3(1.0, 0.0, 0.0); // Red
        zombie.healthBar.fillMat.emissiveColor = new BABYLON.Color3(0.5, 0.0, 0.0);
    }
}

const sunLight = new BABYLON.PointLight('sunLight', new BABYLON.Vector3(20, 30, 20), scene);
sunLight.intensity = 0.2;
sunLight.range = 200;

// Create ground
const groundMaterial = new BABYLON.StandardMaterial('groundMat', scene);
groundMaterial.diffuse = new BABYLON.Color3(0.0, 1.0, 0.0); // Pure bright green
groundMaterial.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);
groundMaterial.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.0);

const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 600, height: 600 }, scene);
ground.material = groundMaterial;
ground.checkCollisions = true;

// Create materials for trees
const trunkMaterial = new BABYLON.StandardMaterial('trunkMat', scene);
trunkMaterial.diffuse = new BABYLON.Color3(0.55, 0.27, 0.07); // Rich brown
trunkMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
trunkMaterial.emissiveColor = new BABYLON.Color3(0.15, 0.08, 0.02);

const foliageMaterial = new BABYLON.StandardMaterial('foliageMat', scene);
foliageMaterial.diffuse = new BABYLON.Color3(0.0, 0.6, 0.0); // Forest green
foliageMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
foliageMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.1);

// Function to create a 3D tree
function createTree(x, z) {
    // Create trunk (cylinder)
    const trunk = BABYLON.MeshBuilder.CreateCylinder('trunk_' + Math.random(), { height: 4, diameter: 0.5 }, scene);
    trunk.position = new BABYLON.Vector3(x, 2, z);
    trunk.material = trunkMaterial;
    trunk.checkCollisions = true;

    // Create foliage (cone)
    const foliage = BABYLON.MeshBuilder.CreateCylinder('foliage_' + Math.random(), { height: 6, diameterTop: 0, diameterBottom: 4 }, scene);
    foliage.position = new BABYLON.Vector3(x, 5, z);
    foliage.material = foliageMaterial;
    foliage.checkCollisions = true;

    // Add some variation in tree size
    const sizeVariation = 0.8 + Math.random() * 0.4;
    trunk.scaling = new BABYLON.Vector3(sizeVariation, sizeVariation, sizeVariation);
    foliage.scaling = new BABYLON.Vector3(sizeVariation, sizeVariation, sizeVariation);
}

// Create a forest of trees
const treePositions = [
    // Left side cluster
    [-30, -20], [-25, -15], [-35, -10], [-28, -5], [-32, 0],
    [-20, 10], [-25, 15], [-30, 20], [-35, 25], [-28, 30],
    // Center cluster
    [0, 15], [5, 20], [-5, 25], [8, 30], [-8, 35],
    [2, 40], [10, 45], [-10, 50], [5, 55],
    // Right side cluster
    [25, -15], [30, -10], [35, -5], [28, 5], [32, 10],
    [20, 20], [28, 25], [35, 30], [30, 35], [25, 40],
    [40, 15], [45, 25], [50, 35], [38, 45],
    // Front areas
    [10, -30], [15, -25], [5, -35], [-10, -30], [-15, -35],
    // Background areas
    [20, 60], [30, 65], [40, 70], [-20, 65], [-30, 70],
    [0, 70], [10, 75], [-10, 75]
];

// Create a winding river that starts near camp and flows through the forest to map edge.
const RIVER_CENTERLINE = [
    new BABYLON.Vector3(126, 0.08, 210),
    new BABYLON.Vector3(112, 0.08, 178),
    new BABYLON.Vector3(92, 0.08, 142),
    new BABYLON.Vector3(66, 0.08, 102),
    new BABYLON.Vector3(40, 0.08, 60),
    new BABYLON.Vector3(18, 0.08, 14),
    new BABYLON.Vector3(2, 0.08, -38),
    new BABYLON.Vector3(-10, 0.08, -96),
    new BABYLON.Vector3(-22, 0.08, -162),
    new BABYLON.Vector3(-34, 0.08, -232),
    new BABYLON.Vector3(-48, 0.08, -298)
];
const RIVER_HALF_WIDTH = 12;

function distancePointToSegment2D(px, pz, ax, az, bx, bz) {
    const abx = bx - ax;
    const abz = bz - az;
    const apx = px - ax;
    const apz = pz - az;
    const abLenSq = abx * abx + abz * abz;
    if (abLenSq <= 0.000001) {
        const dx = px - ax;
        const dz = pz - az;
        return Math.sqrt(dx * dx + dz * dz);
    }
    const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
    const cx = ax + abx * t;
    const cz = az + abz * t;
    const dx = px - cx;
    const dz = pz - cz;
    return Math.sqrt(dx * dx + dz * dz);
}

function isInRiver(x, z, extraWidth = 0) {
    const width = RIVER_HALF_WIDTH + extraWidth;
    for (let i = 0; i < RIVER_CENTERLINE.length - 1; i++) {
        const a = RIVER_CENTERLINE[i];
        const b = RIVER_CENTERLINE[i + 1];
        const d = distancePointToSegment2D(x, z, a.x, a.z, b.x, b.z);
        if (d <= width) return true;
    }
    return false;
}

treePositions.forEach(pos => {
    if (!isInRiver(pos[0], pos[1], 3.5)) {
        createTree(pos[0], pos[1]);
    }
});

function createRiver() {
    const riverCenterline = RIVER_CENTERLINE;
    const riverHalfWidth = RIVER_HALF_WIDTH;
    const leftBank = [];
    const rightBank = [];

    for (let i = 0; i < riverCenterline.length; i++) {
        const p = riverCenterline[i];
        const prev = riverCenterline[Math.max(0, i - 1)];
        const next = riverCenterline[Math.min(riverCenterline.length - 1, i + 1)];
        const tangent = next.subtract(prev);
        tangent.y = 0;
        tangent.normalize();

        const normal = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
        leftBank.push(p.add(normal.scale(riverHalfWidth)));
        rightBank.push(p.add(normal.scale(-riverHalfWidth)));
    }

    const river = BABYLON.MeshBuilder.CreateRibbon('riverRibbon', {
        pathArray: [leftBank, rightBank],
        closeArray: false,
        closePath: false,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        updatable: false
    }, scene);

    const riverMat = new BABYLON.StandardMaterial('riverMat', scene);
    riverMat.diffuseColor = new BABYLON.Color3(0.10, 0.50, 0.95);
    riverMat.emissiveColor = new BABYLON.Color3(0.08, 0.24, 0.42);
    riverMat.specularColor = new BABYLON.Color3(0.7, 0.85, 1.0);
    riverMat.alpha = 0.96;
    riverMat.backFaceCulling = false;
    river.material = riverMat;
    river.isPickable = false;
    river.checkCollisions = false;
}

function createParkourRockBridges() {
    const bridgeSegments = [1, 3, 5, 7];
    const stoneMat = new BABYLON.StandardMaterial('bridgeStoneMat', scene);
    stoneMat.diffuseColor = new BABYLON.Color3(0.40, 0.40, 0.42);
    stoneMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.10);

    bridgeSegments.forEach((idx, bridgeIdx) => {
        if (idx >= RIVER_CENTERLINE.length - 1) return;
        const a = RIVER_CENTERLINE[idx];
        const b = RIVER_CENTERLINE[idx + 1];
        const mid = a.add(b).scale(0.5);
        const tangent = b.subtract(a);
        tangent.y = 0;
        tangent.normalize();
        const normal = new BABYLON.Vector3(-tangent.z, 0, tangent.x);

        for (let i = -3; i <= 3; i++) {
            // Leave one intentional gap to make each crossing feel like parkour.
            if (i === (bridgeIdx % 3) - 1) continue;

            const along = (bridgeIdx % 2 === 0 ? 1 : -1) * (i * 0.8);
            const across = i * (RIVER_HALF_WIDTH * 0.33);
            const pos = mid
                .add(normal.scale(across))
                .add(tangent.scale(along));

            const h = 1.8 + ((i + bridgeIdx) % 3) * 0.28;
            const w = 1.6 + (Math.abs(i) % 2) * 0.35;
            const stone = BABYLON.MeshBuilder.CreateCylinder('bridgeRock_' + bridgeIdx + '_' + i, {
                diameterTop: w * 0.72,
                diameterBottom: w,
                height: h,
                tessellation: 7
            }, scene);
            stone.position = new BABYLON.Vector3(pos.x, h * 0.5 - 0.1, pos.z);
            stone.rotation.y = (i + bridgeIdx) * 0.35;
            stone.material = stoneMat;
            stone.checkCollisions = true;
        }
    });
}

createRiver();
createParkourRockBridges();

// Array to store all bushes for billboarding
const bushes = [];

// Function to create a billboarded blocky bush/shrub
function createBlockyBush(x, z) {
    const bushGroup = BABYLON.MeshBuilder.CreateBox('bushGroup_' + Math.random(), { size: 0.1 }, scene);
    bushGroup.position = new BABYLON.Vector3(x, 0.5, z);
    bushGroup.isVisible = false;

    const bushMaterial = new BABYLON.StandardMaterial('bushMat_' + Math.random(), scene);
    bushMaterial.diffuse = new BABYLON.Color3(0.3, 0.8, 0.2);
    bushMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    bushMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.1);

    // Create blocky structure with multiple cubes
    const blocks = [
        // Bottom tier
        [-0.2, 0, 0], [0, 0, 0], [0.2, 0, 0],
        // Middle tier
        [-0.15, 0.4, 0], [0, 0.4, 0], [0.15, 0.4, 0],
        // Top tier
        [0, 0.8, 0],
    ];

    blocks.forEach((offset, index) => {
        const block = BABYLON.MeshBuilder.CreateBox('block_' + index, { size: 0.2 }, scene);
        block.position = new BABYLON.Vector3(x + offset[0], 0.5 + offset[1], z + offset[2]);
        block.parent = bushGroup;
        block.material = bushMaterial;
        block.checkCollisions = false;
    });

    return bushGroup;
}

// Create scattered bushes across the ground
function createBushField() {
    // GRASS DISABLED
    // bushes not created
}

// ===== HOUSE & MISSION STATE =====
const HOUSE_POS = new BABYLON.Vector3(120, 0, 150); // Even further from forest

// Give player sword from the very start
createPlayerSword();
createPlayerSwimArms();

// Zombie system
const zombies = [];
let spawnTimer = 0;
const SPAWN_INTERVAL = 10000; // 10 seconds in milliseconds
const DARK_ELF_SPAWN_CHANCE = 0.10;
const DARK_ELF_ELF_WIN_CHANCE = 0.60;
const corruptedWaterBolts = [];
let zombieSoldier = null; // reference to the active soldier boss
let kingSwoopActive = false;
let kingSwoopTimer = 0;
let kingSwoopDone = false;
let kingDarkElfTarget = null;

function getDarkElfSpawnChance() {
    let stage = 0;
    if (player.hasWaterSlash) stage++;
    if (player.hasWindSlash) stage++;
    if (player.hasFireSlash) stage++;
    if (player.hasDarkEnergy) stage++;
    return Math.min(0.20, DARK_ELF_SPAWN_CHANCE + stage * 0.025);
}

function removeCampElf(elf) {
    if (!elf || elf.isKing) return;
    const idx = elves.indexOf(elf);
    if (idx >= 0) elves.splice(idx, 1);
    if (elf.group) elf.group.dispose();
}

function onDarkElfDefeatedElf(darkElf, elfVictim) {
    if (!darkElf || !elfVictim || elfVictim.isKing) return;
    createExplosion(elfVictim.group.position, 'purple');
    removeCampElf(elfVictim);
    darkElf.kingTapHitsRemaining = 2;
    kingDarkElfTarget = darkElf;

    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '👑 The King avenges the fallen elf!';
    prompt.style.color = '#FFD700';
    prompt.style.borderColor = '#FFD700';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 1300);
}

function spawnCorruptedWaterBolt(startPos, targetPos) {
    const direction = targetPos.subtract(startPos);
    direction.y = 0;
    if (direction.length() < 0.001) return;
    direction.normalize();

    const now = Date.now();
    const plane = BABYLON.MeshBuilder.CreatePlane('corruptWater_' + now, { width: 2.4, height: 1.0 }, scene);
    plane.position = startPos.clone();
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const mat = new BABYLON.StandardMaterial('corruptWaterMat_' + now, scene);
    const tex = new BABYLON.Texture('assets/Copilot_20260531_181340.png', scene, false, true);
    tex.hasAlpha = true;
    tex.uScale = 1 / 7;
    tex.vScale = 1 / 9;
    tex.uOffset = 0;
    tex.vOffset = 8 / 9;

    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.emissiveColor = new BABYLON.Color3(0.50, 0.30, 0.95);
    mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    mat.alpha = 0.95;
    mat.backFaceCulling = false;
    plane.material = mat;

    corruptedWaterBolts.push({
        plane,
        mat,
        tex,
        vel: direction.scale(0.45),
        born: now,
        frame: 0,
        hit: false
    });
}

function updateCorruptedWaterBolts(dt) {
    const maxLife = 1050;
    const frameDur = 120;
    for (let i = corruptedWaterBolts.length - 1; i >= 0; i--) {
        const bolt = corruptedWaterBolts[i];
        const age = Date.now() - bolt.born;
        const lifeRatio = 1 - age / maxLife;

        if (bolt.hit || lifeRatio <= 0) {
            bolt.plane.dispose();
            bolt.mat.dispose();
            corruptedWaterBolts.splice(i, 1);
            continue;
        }

        bolt.plane.position.addInPlace(bolt.vel);

        const frame = Math.min(6, Math.floor(age / frameDur));
        if (frame !== bolt.frame) {
            bolt.frame = frame;
            bolt.tex.uOffset = frame / 7;
        }

        bolt.mat.alpha = Math.min(1, lifeRatio * 2.3);

        if (!playerInsideHouse) {
            const distToPlayer = BABYLON.Vector3.Distance(bolt.plane.position, camera.position);
            if (distToPlayer < 1.1) {
                bolt.hit = true;
                if (!cutsceneActive) {
                    player.health = Math.max(0, player.health - 1);
                    updateHealthBar();
                    if (player.health <= 0) {
                        startCutscene();
                    }
                }
            }
        }
    }
}

// ===== ZOMBIE SOLDIER (spawns after mission 2) =====
function createZombieSoldier() {
    let spawnPos;
    do {
        const angle = Math.random() * Math.PI * 2;
        spawnPos = new BABYLON.Vector3(
            camera.position.x + Math.cos(angle) * 30,
            1,
            camera.position.z + Math.sin(angle) * 30
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    const g = new BABYLON.TransformNode('soldierGroup_' + Math.random(), scene);
    g.position = spawnPos;
    g.scaling = new BABYLON.Vector3(1.35, 1.35, 1.35); // visibly bigger than normal zombies

    const mk = (r, b_, bl, em = 0.28) => {
        const m = new BABYLON.StandardMaterial('sm_' + Math.random(), scene);
        m.diffuseColor  = new BABYLON.Color3(r, b_, bl);
        m.emissiveColor = new BABYLON.Color3(r * em, b_ * em, bl * em);
        return m;
    };

    const skinMat   = mk(0.24, 0.36, 0.18, 0.30); // dark green rot skin
    const armorMat  = mk(0.35, 0.35, 0.38, 0.40); // steel gray armor
    const darkMat   = mk(0.10, 0.10, 0.12, 0.20); // near-black undersuit
    const redMat    = mk(0.70, 0.08, 0.08, 0.50); // glowing red eyes
    const bootsMat  = mk(0.18, 0.10, 0.04, 0.25);

    const add = (name, opts, pos, mat) => {
        const mesh = BABYLON.MeshBuilder.CreateBox(name + '_' + Math.random(), opts, scene);
        mesh.position = new BABYLON.Vector3(...pos);
        mesh.material = mat;
        mesh.parent = g;
        return mesh;
    };

    // Head
    const head      = add('sHead',   { width: 0.70, height: 0.62, depth: 0.62 }, [0, 1.52, 0],         skinMat);
    // Helmet
    add('sHelm',                     { width: 0.76, height: 0.30, depth: 0.68 }, [0, 1.82, 0],         armorMat);
    add('sHelmVis',                  { width: 0.54, height: 0.12, depth: 0.10 }, [0, 1.70, 0.34],      darkMat);
    // Eyes
    const eyeL      = add('sEyeL',   { width: 0.16, height: 0.16, depth: 0.05 }, [-0.17, 1.54, 0.32],  redMat);
    const eyeR      = add('sEyeR',   { width: 0.16, height: 0.16, depth: 0.05 }, [0.17,  1.54, 0.32],  redMat);
    // Torso + chest plate
    const body      = add('sBody',   { width: 0.62, height: 0.62, depth: 0.48 }, [0, 0.92, 0],         darkMat);
    add('sChest',                    { width: 0.60, height: 0.46, depth: 0.12 }, [0, 0.96, 0.28],      armorMat);
    // Shoulder pads
    add('sShoulderL',                { width: 0.22, height: 0.20, depth: 0.30 }, [-0.48, 1.16, 0],     armorMat);
    add('sShoulderR',                { width: 0.22, height: 0.20, depth: 0.30 }, [0.48,  1.16, 0],     armorMat);
    const scarMat = mk(0.14, 0.06, 0.04, 0.60); // dark reddish scar tissue

    const addSphere = (name, diam, scaleX, scaleY, scaleZ, pos, mat) => {
        const s = BABYLON.MeshBuilder.CreateSphere(name + '_' + Math.random(), { diameter: diam, segments: 5 }, scene);
        s.scaling = new BABYLON.Vector3(scaleX, scaleY, scaleZ);
        s.position = new BABYLON.Vector3(...pos);
        s.material = mat;
        s.parent = g;
        s.isPickable = false;
        return s;
    };

    // Arms (thick, muscular)
    const armLeft   = add('sArmL',   { width: 0.30, height: 0.26, depth: 0.44 }, [-0.48, 1.06, 0.20], skinMat);
    const armRight  = add('sArmR',   { width: 0.30, height: 0.26, depth: 0.44 }, [0.48,  1.06, 0.20], skinMat);
    // Bicep half-circle muscle bumps (flattened sphere, only front half visible)
    addSphere('sBicepL', 0.22, 1.0, 0.7, 0.55, [-0.48, 1.14, 0.04], skinMat);
    addSphere('sBicepR', 0.22, 1.0, 0.7, 0.55, [0.48,  1.14, 0.04], skinMat);
    // Forearm half-circle muscle bumps
    addSphere('sForearmL', 0.18, 1.0, 0.6, 0.50, [-0.48, 1.02, 0.30], skinMat);
    addSphere('sForearmR', 0.18, 1.0, 0.6, 0.50, [0.48,  1.02, 0.30], skinMat);
    const fistLeft  = add('sFistL',  { width: 0.28, height: 0.26, depth: 0.26 }, [-0.48, 1.06, 0.54], skinMat);
    const fistRight = add('sFistR',  { width: 0.28, height: 0.26, depth: 0.26 }, [0.48,  1.06, 0.54], skinMat);
    // Scars — thin dark slash marks on face and chest
    add('sScarFace1', { width: 0.18, height: 0.03, depth: 0.02 }, [0.08, 1.50, 0.33], scarMat);  // cheek scar
    add('sScarFace2', { width: 0.10, height: 0.03, depth: 0.02 }, [-0.12, 1.58, 0.33], scarMat); // forehead scar
    add('sScarChest1',{ width: 0.26, height: 0.03, depth: 0.02 }, [0.10,  1.02, 0.30], scarMat); // chest scar diagonal
    add('sScarChest2',{ width: 0.18, height: 0.03, depth: 0.02 }, [-0.08, 0.88, 0.30], scarMat);
    add('sScarArmL',  { width: 0.14, height: 0.03, depth: 0.02 }, [-0.48, 1.08, 0.36], scarMat); // arm scar
    add('sScarArmR',  { width: 0.14, height: 0.03, depth: 0.02 }, [0.48,  1.08, 0.36], scarMat);
    // Legs
    const legLeft   = add('sLegL',   { width: 0.26, height: 0.34, depth: 0.30 }, [-0.16, 0.50, 0],    darkMat);
    const legRight  = add('sLegR',   { width: 0.26, height: 0.34, depth: 0.30 }, [0.16,  0.50, 0],    darkMat);
    // Armored greaves
    add('sGrL',                      { width: 0.28, height: 0.20, depth: 0.12 }, [-0.16, 0.48, 0.16], armorMat);
    add('sGrR',                      { width: 0.28, height: 0.20, depth: 0.12 }, [0.16,  0.48, 0.16], armorMat);
    const bootLeft  = add('sBootL',  { width: 0.28, height: 0.22, depth: 0.32 }, [-0.16, 0.24, 0.02], bootsMat);
    const bootRight = add('sBootR',  { width: 0.28, height: 0.22, depth: 0.32 }, [0.16,  0.24, 0.02], bootsMat);

    const soldier = {
        group: g,
        speed: 0.22,
        health: 10,
        maxHealth: 10,
        type: 'green',
        isSoldier: true,
        hitPlayer: false,
        isDead: false,
        healthBar: null,
        head, body, eyeL, eyeR,
        armLeft, armRight, fistLeft, fistRight,
        legLeft, legRight, bootLeft, bootRight,
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0.005,
        deathTimer: 0
    };

    soldier.healthBar = createZombieHealthBar(soldier);
    updateZombieHealthBar(soldier);
    zombies.push(soldier);
    zombieSoldier = soldier;

    // Announce arrival
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '⚠ Zombie Soldier leads the horde!';
    prompt.style.color = '#FF4444';
    prompt.style.borderColor = '#FF4444';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 4000);
}

// ===== SOLDIER ELF (hostile elf captain — spawns during mission 3) =====
let soldierElf = null;
function createSoldierElf() {
    let spawnPos;
    do {
        const angle = Math.random() * Math.PI * 2;
        spawnPos = new BABYLON.Vector3(
            camera.position.x + Math.cos(angle) * 28,
            1,
            camera.position.z + Math.sin(angle) * 28
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    const g = new BABYLON.TransformNode('soldierElfGroup_' + Math.random(), scene);
    g.position = spawnPos;

    const mk = (r, g2, b, em = 0.32) => {
        const m = new BABYLON.StandardMaterial('se_' + Math.random(), scene);
        m.diffuseColor  = new BABYLON.Color3(r, g2, b);
        m.emissiveColor = new BABYLON.Color3(r * em, g2 * em, b * em);
        return m;
    };

    const skinMat    = mk(0.82, 0.65, 0.40); // pale elf skin
    const armorMat   = mk(0.55, 0.12, 0.08); // dark red armor
    const beltMat    = mk(0.22, 0.16, 0.06); // dark brown belt
    const eyeMat     = mk(0.85, 0.10, 0.10, 0.6); // glowing red eyes
    const bladeMat   = mk(0.70, 0.70, 0.80, 0.5); // steel blade

    // Head
    const head = BABYLON.MeshBuilder.CreateBox('seh_' + Math.random(), { width: 0.60, height: 0.56, depth: 0.58 }, scene);
    head.position.y = 1.50;
    head.material = skinMat;
    head.parent = g;
    // Pointed ears
    const earL = BABYLON.MeshBuilder.CreateBox('seal_' + Math.random(), { width: 0.08, height: 0.28, depth: 0.12 }, scene);
    earL.position = new BABYLON.Vector3(-0.35, 1.60, 0);
    earL.rotation.z = 0.35;
    earL.material = skinMat;
    earL.parent = g;
    const earR = BABYLON.MeshBuilder.CreateBox('sear_' + Math.random(), { width: 0.08, height: 0.28, depth: 0.12 }, scene);
    earR.position = new BABYLON.Vector3(0.35, 1.60, 0);
    earR.rotation.z = -0.35;
    earR.material = skinMat;
    earR.parent = g;
    // Eyes
    const eyeL = BABYLON.MeshBuilder.CreateBox('seel_' + Math.random(), { width: 0.12, height: 0.12, depth: 0.05 }, scene);
    eyeL.position = new BABYLON.Vector3(-0.14, 1.52, 0.30);
    eyeL.material = eyeMat;
    eyeL.parent = g;
    const eyeR = BABYLON.MeshBuilder.CreateBox('seer_' + Math.random(), { width: 0.12, height: 0.12, depth: 0.05 }, scene);
    eyeR.position = new BABYLON.Vector3(0.14, 1.52, 0.30);
    eyeR.material = eyeMat;
    eyeR.parent = g;
    // Torso
    const torso = BABYLON.MeshBuilder.CreateBox('set_' + Math.random(), { width: 0.60, height: 0.62, depth: 0.42 }, scene);
    torso.position.y = 0.90;
    torso.material = armorMat;
    torso.parent = g;
    // Belt
    const belt = BABYLON.MeshBuilder.CreateBox('sebt_' + Math.random(), { width: 0.62, height: 0.10, depth: 0.44 }, scene);
    belt.position.y = 0.60;
    belt.material = beltMat;
    belt.parent = g;
    // Arms
    const armLeft = BABYLON.MeshBuilder.CreateBox('seal2_' + Math.random(), { width: 0.20, height: 0.46, depth: 0.20 }, scene);
    armLeft.position = new BABYLON.Vector3(-0.42, 0.96, 0);
    armLeft.material = armorMat;
    armLeft.parent = g;
    const armRight = BABYLON.MeshBuilder.CreateBox('sear2_' + Math.random(), { width: 0.20, height: 0.46, depth: 0.20 }, scene);
    armRight.position = new BABYLON.Vector3(0.42, 0.96, 0);
    armRight.material = armorMat;
    armRight.parent = g;
    // Legs
    const legLeft = BABYLON.MeshBuilder.CreateBox('sell_' + Math.random(), { width: 0.24, height: 0.36, depth: 0.26 }, scene);
    legLeft.position = new BABYLON.Vector3(-0.16, 0.42, 0);
    legLeft.material = armorMat;
    legLeft.parent = g;
    const legRight = BABYLON.MeshBuilder.CreateBox('selr_' + Math.random(), { width: 0.24, height: 0.36, depth: 0.26 }, scene);
    legRight.position = new BABYLON.Vector3(0.16, 0.42, 0);
    legRight.material = armorMat;
    legRight.parent = g;
    // Sword blade (pointing forward)
    const blade = BABYLON.MeshBuilder.CreateBox('sebl_' + Math.random(), { width: 0.07, height: 0.75, depth: 0.07 }, scene);
    blade.position = new BABYLON.Vector3(0.55, 1.10, 0.45);
    blade.rotation.x = -0.6;
    blade.material = bladeMat;
    blade.parent = g;

    const elf = {
        group: g,
        speed: 0.18,
        health: 15,
        maxHealth: 15,
        type: 'purple',
        isSoldierElf: true,
        hitPlayer: false,
        isDead: false,
        healthBar: null,
        head, torso, armLeft, armRight, legLeft, legRight, blade,
        body: torso, // alias for animation system
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0.005,
        deathTimer: 0
    };
    elf.healthBar = createZombieHealthBar(elf);
    updateZombieHealthBar(elf);
    zombies.push(elf);
    soldierElf = elf;

    const prompt2 = document.getElementById('interact-prompt');
    prompt2.textContent = '⚠ A Soldier Elf charges from the treeline!';
    prompt2.style.color = '#FFAA22';
    prompt2.style.borderColor = '#FFAA22';
    prompt2.style.display = 'block';
    setTimeout(() => {
        prompt2.style.display = 'none';
        prompt2.style.color = '';
        prompt2.style.borderColor = '';
    }, 4000);
}

// ===== NECROMANCER BOSS (spawns in mission 4) =====
let necromancer = null;
function createNecromancer() {
    let spawnPos;
    do {
        const angle = Math.random() * Math.PI * 2;
        spawnPos = new BABYLON.Vector3(
            camera.position.x + Math.cos(angle) * 35,
            1,
            camera.position.z + Math.sin(angle) * 35
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    const g = new BABYLON.TransformNode('necroGroup_' + Math.random(), scene);
    g.position = spawnPos;
    g.scaling = new BABYLON.Vector3(1.3, 1.5, 1.3); // tall and imposing

    const mk = (r, g2, b, em = 0.4) => {
        const m = new BABYLON.StandardMaterial('nr_' + Math.random(), scene);
        m.diffuseColor  = new BABYLON.Color3(r, g2, b);
        m.emissiveColor = new BABYLON.Color3(r * em, g2 * em, b * em);
        return m;
    };

    const robeMat  = mk(0.10, 0.00, 0.18); // deep purple robe
    const boneMat  = mk(0.78, 0.74, 0.60); // pale bone/skull
    const eyeMat   = mk(0.10, 0.90, 0.10, 1.0); // glowing green eyes
    const staffMat = mk(0.20, 0.12, 0.28); // dark staff wood
    const crystalMat = mk(0.30, 0.00, 0.60, 1.2); // pulsing purple crystal

    // Head / skull
    const head = BABYLON.MeshBuilder.CreateBox('nrh_' + Math.random(), { width: 0.62, height: 0.60, depth: 0.60 }, scene);
    head.position.y = 1.52;
    head.material = boneMat;
    head.parent = g;
    // Eyes
    const eyeL = BABYLON.MeshBuilder.CreateBox('nrel_' + Math.random(), { width: 0.14, height: 0.14, depth: 0.05 }, scene);
    eyeL.position = new BABYLON.Vector3(-0.14, 1.54, 0.31);
    eyeL.material = eyeMat;
    eyeL.parent = g;
    const eyeR = BABYLON.MeshBuilder.CreateBox('nrer_' + Math.random(), { width: 0.14, height: 0.14, depth: 0.05 }, scene);
    eyeR.position = new BABYLON.Vector3(0.14, 1.54, 0.31);
    eyeR.material = eyeMat;
    eyeR.parent = g;
    // Robe body
    const body = BABYLON.MeshBuilder.CreateBox('nrb_' + Math.random(), { width: 0.68, height: 0.80, depth: 0.50 }, scene);
    body.position.y = 0.88;
    body.material = robeMat;
    body.parent = g;
    // Robe skirt (wider at bottom)
    const skirt = BABYLON.MeshBuilder.CreateBox('nrsk_' + Math.random(), { width: 0.80, height: 0.40, depth: 0.60 }, scene);
    skirt.position.y = 0.36;
    skirt.material = robeMat;
    skirt.parent = g;
    // Arms (sleeve-covered)
    const armLeft = BABYLON.MeshBuilder.CreateBox('nral_' + Math.random(), { width: 0.22, height: 0.52, depth: 0.22 }, scene);
    armLeft.position = new BABYLON.Vector3(-0.48, 1.00, 0);
    armLeft.material = robeMat;
    armLeft.parent = g;
    const armRight = BABYLON.MeshBuilder.CreateBox('nrar_' + Math.random(), { width: 0.22, height: 0.52, depth: 0.22 }, scene);
    armRight.position = new BABYLON.Vector3(0.48, 1.00, 0);
    armRight.material = robeMat;
    armRight.parent = g;
    // Staff in right hand
    const staffShaft = BABYLON.MeshBuilder.CreateBox('nrss_' + Math.random(), { width: 0.08, height: 1.60, depth: 0.08 }, scene);
    staffShaft.position = new BABYLON.Vector3(0.68, 1.10, 0.10);
    staffShaft.material = staffMat;
    staffShaft.parent = g;
    const staffCrystal = BABYLON.MeshBuilder.CreateBox('nrsc_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.22 }, scene);
    staffCrystal.position = new BABYLON.Vector3(0.68, 1.96, 0.10);
    staffCrystal.material = crystalMat;
    staffCrystal.rotation.y = Math.PI / 4;
    staffCrystal.parent = g;

    const nec = {
        group: g,
        speed: 0.05,
        health: 30,
        maxHealth: 30,
        type: 'purple',
        isNecromancer: true,
        hitPlayer: false,
        isDead: false,
        healthBar: null,
        head, body, armLeft, armRight,
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0.003,
        deathTimer: 0
    };
    nec.healthBar = createZombieHealthBar(nec);
    updateZombieHealthBar(nec);
    zombies.push(nec);
    necromancer = nec;

    const prompt3 = document.getElementById('interact-prompt');
    prompt3.textContent = '💀 Malachar the Undying has arrived!';
    prompt3.style.color = '#CC44FF';
    prompt3.style.borderColor = '#CC44FF';
    prompt3.style.display = 'block';
    setTimeout(() => {
        prompt3.style.display = 'none';
        prompt3.style.color = '';
        prompt3.style.borderColor = '';
    }, 5000);
}

// ===== AWARD DARK ENERGY (triggered first time player damages Necromancer) =====
function awardDarkEnergy() {
    if (player.hasDarkEnergy) return;
    player.hasDarkEnergy = true;
    document.getElementById('darkenergy-hud').style.display = 'block';
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '⚡ Dark Energy awakens within you! (Hold Q+R+E)';
    prompt.style.color = '#d8f';
    prompt.style.borderColor = '#d8f';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 5000);
}

// Function to create a 3D zombie model
function createZombie() {
    const zombieTypes = ['green', 'blue', 'purple'];
    const zombieType = zombieTypes[Math.floor(Math.random() * zombieTypes.length)];
    
    // Retry until position is at least 5 units clear of the house
    let spawnPos;
    do {
        spawnPos = new BABYLON.Vector3(
            (Math.random() - 0.5) * 100,
            1,
            (Math.random() - 0.5) * 100 + 30
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    // 10% chance: spawn a Dark Elf instead of a normal zombie.
    if (Math.random() < getDarkElfSpawnChance()) {
        const darkElfGroup = new BABYLON.TransformNode('darkElfGroup_' + Math.random(), scene);
        darkElfGroup.position = spawnPos;

        const mkMat = (r, g, b, em = 0.32) => {
            const m = new BABYLON.StandardMaterial('de_' + Math.random(), scene);
            m.diffuseColor = new BABYLON.Color3(r, g, b);
            m.emissiveColor = new BABYLON.Color3(r * em, g * em, b * em);
            return m;
        };

        const hoodMat = mkMat(0.08, 0.06, 0.12, 0.30);
        const clothMat = mkMat(0.13, 0.06, 0.20, 0.35);
        const armorMat = mkMat(0.16, 0.12, 0.22, 0.30);
        const eyeMat = mkMat(0.95, 0.28, 0.08, 0.95);
        const swordMat = mkMat(0.55, 0.18, 0.80, 0.75);
        const bootMat = mkMat(0.08, 0.07, 0.11, 0.22);

        const head = BABYLON.MeshBuilder.CreateBox('deHead_' + Math.random(), { width: 0.64, height: 0.58, depth: 0.60 }, scene);
        head.position.y = 1.52;
        head.material = hoodMat;
        head.parent = darkElfGroup;

        const hoodFront = BABYLON.MeshBuilder.CreateBox('deHoodF_' + Math.random(), { width: 0.54, height: 0.22, depth: 0.18 }, scene);
        hoodFront.position = new BABYLON.Vector3(0, 1.62, 0.26);
        hoodFront.material = hoodMat;
        hoodFront.parent = darkElfGroup;

        const eyeLeft = BABYLON.MeshBuilder.CreateBox('deEyeL_' + Math.random(), { width: 0.11, height: 0.11, depth: 0.05 }, scene);
        eyeLeft.position = new BABYLON.Vector3(-0.12, 1.52, 0.31);
        eyeLeft.material = eyeMat;
        eyeLeft.parent = darkElfGroup;
        const eyeRight = BABYLON.MeshBuilder.CreateBox('deEyeR_' + Math.random(), { width: 0.11, height: 0.11, depth: 0.05 }, scene);
        eyeRight.position = new BABYLON.Vector3(0.12, 1.52, 0.31);
        eyeRight.material = eyeMat;
        eyeRight.parent = darkElfGroup;

        const body = BABYLON.MeshBuilder.CreateBox('deBody_' + Math.random(), { width: 0.60, height: 0.64, depth: 0.46 }, scene);
        body.position.y = 0.92;
        body.material = clothMat;
        body.parent = darkElfGroup;

        const shoulderL = BABYLON.MeshBuilder.CreateBox('deShL_' + Math.random(), { width: 0.18, height: 0.16, depth: 0.24 }, scene);
        shoulderL.position = new BABYLON.Vector3(-0.34, 1.12, 0.03);
        shoulderL.material = armorMat;
        shoulderL.parent = darkElfGroup;
        const shoulderR = BABYLON.MeshBuilder.CreateBox('deShR_' + Math.random(), { width: 0.18, height: 0.16, depth: 0.24 }, scene);
        shoulderR.position = new BABYLON.Vector3(0.34, 1.12, 0.03);
        shoulderR.material = armorMat;
        shoulderR.parent = darkElfGroup;

        const armLeft = BABYLON.MeshBuilder.CreateBox('deArmL_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.40 }, scene);
        armLeft.position = new BABYLON.Vector3(-0.42, 1.02, 0.22);
        armLeft.material = clothMat;
        armLeft.parent = darkElfGroup;
        const armRight = BABYLON.MeshBuilder.CreateBox('deArmR_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.40 }, scene);
        armRight.position = new BABYLON.Vector3(0.42, 1.02, 0.22);
        armRight.material = clothMat;
        armRight.parent = darkElfGroup;

        const fistLeft = BABYLON.MeshBuilder.CreateBox('deFistL_' + Math.random(), { width: 0.20, height: 0.20, depth: 0.22 }, scene);
        fistLeft.position = new BABYLON.Vector3(-0.42, 1.02, 0.52);
        fistLeft.material = clothMat;
        fistLeft.parent = darkElfGroup;
        const fistRight = BABYLON.MeshBuilder.CreateBox('deFistR_' + Math.random(), { width: 0.20, height: 0.20, depth: 0.22 }, scene);
        fistRight.position = new BABYLON.Vector3(0.42, 1.02, 0.52);
        fistRight.material = clothMat;
        fistRight.parent = darkElfGroup;

        const sword = BABYLON.MeshBuilder.CreateBox('deSword_' + Math.random(), { width: 0.06, height: 0.55, depth: 0.06 }, scene);
        sword.position = new BABYLON.Vector3(0.56, 1.00, 0.50);
        sword.rotation.x = -0.55;
        sword.material = swordMat;
        sword.parent = darkElfGroup;

        const legLeft = BABYLON.MeshBuilder.CreateBox('deLegL_' + Math.random(), { width: 0.24, height: 0.32, depth: 0.28 }, scene);
        legLeft.position = new BABYLON.Vector3(-0.16, 0.50, 0.0);
        legLeft.material = armorMat;
        legLeft.parent = darkElfGroup;
        const legRight = BABYLON.MeshBuilder.CreateBox('deLegR_' + Math.random(), { width: 0.24, height: 0.32, depth: 0.28 }, scene);
        legRight.position = new BABYLON.Vector3(0.16, 0.50, 0.0);
        legRight.material = armorMat;
        legRight.parent = darkElfGroup;

        const bootLeft = BABYLON.MeshBuilder.CreateBox('deBootL_' + Math.random(), { width: 0.26, height: 0.20, depth: 0.30 }, scene);
        bootLeft.position = new BABYLON.Vector3(-0.16, 0.24, 0.02);
        bootLeft.material = bootMat;
        bootLeft.parent = darkElfGroup;
        const bootRight = BABYLON.MeshBuilder.CreateBox('deBootR_' + Math.random(), { width: 0.26, height: 0.20, depth: 0.30 }, scene);
        bootRight.position = new BABYLON.Vector3(0.16, 0.24, 0.02);
        bootRight.material = bootMat;
        bootRight.parent = darkElfGroup;

        const darkElf = {
            group: darkElfGroup,
            position: spawnPos,
            speed: 0.19,
            health: 4,
            maxHealth: 4,
            type: 'purple',
            isDarkElf: true,
            hitPlayer: false,
            isDead: false,
            kingTapHitsRemaining: 2,
            lastCorruptedWater: 0,
            healthBar: null,
            head, body,
            armLeft, armRight, fistLeft, fistRight,
            legLeft, legRight, bootLeft, bootRight,
            sword,
            animationState: 'walk',
            animationTimer: 0,
            animationSpeed: 0.006,
            deathTimer: 0,
            canJump: true,
            isJumping: false,
            jumpVelocity: 0,
            jumpCooldown: 0,
            jumpHeight: 0
        };

        darkElf.healthBar = createZombieHealthBar(darkElf);
        updateZombieHealthBar(darkElf);
        zombies.push(darkElf);
        return;
    }

    // 50% chance: spawn a skeleton instead of a normal zombie.
    if (Math.random() < 0.5) {
        const skeletonGroup = new BABYLON.TransformNode('skeletonGroup_' + Math.random(), scene);
        skeletonGroup.position = spawnPos;

        const mkMat = (r, g, b, em = 0.28) => {
            const m = new BABYLON.StandardMaterial('sk_' + Math.random(), scene);
            m.diffuseColor = new BABYLON.Color3(r, g, b);
            m.emissiveColor = new BABYLON.Color3(r * em, g * em, b * em);
            return m;
        };

        const boneMat = mkMat(0.92, 0.94, 0.98, 0.24);
        const jointMat = mkMat(0.72, 0.76, 0.84, 0.18);
        const eyeMat = mkMat(0.05, 0.05, 0.07, 0.08);
        const swordMat = mkMat(0.78, 0.80, 0.86, 0.28);
        const hiltMat = mkMat(0.82, 0.54, 0.10, 0.24);

        const head = BABYLON.MeshBuilder.CreateBox('skHead_' + Math.random(), { width: 0.62, height: 0.56, depth: 0.58 }, scene);
        head.position.y = 1.56;
        head.material = boneMat;
        head.parent = skeletonGroup;

        const eyeLeft = BABYLON.MeshBuilder.CreateBox('skEyeL_' + Math.random(), { width: 0.12, height: 0.16, depth: 0.04 }, scene);
        eyeLeft.position = new BABYLON.Vector3(-0.14, 1.55, 0.30);
        eyeLeft.material = eyeMat;
        eyeLeft.parent = skeletonGroup;
        const eyeRight = BABYLON.MeshBuilder.CreateBox('skEyeR_' + Math.random(), { width: 0.12, height: 0.16, depth: 0.04 }, scene);
        eyeRight.position = new BABYLON.Vector3(0.14, 1.55, 0.30);
        eyeRight.material = eyeMat;
        eyeRight.parent = skeletonGroup;

        const body = BABYLON.MeshBuilder.CreateBox('skBody_' + Math.random(), { width: 0.46, height: 0.54, depth: 0.30 }, scene);
        body.position.y = 0.98;
        body.material = boneMat;
        body.parent = skeletonGroup;

        for (let i = -1; i <= 1; i++) {
            const rib = BABYLON.MeshBuilder.CreateBox('skRib_' + i + '_' + Math.random(), { width: 0.56, height: 0.05, depth: 0.06 }, scene);
            rib.position = new BABYLON.Vector3(0, 0.88 + i * 0.12, 0.14);
            rib.material = jointMat;
            rib.parent = skeletonGroup;
        }

        const armLeft = BABYLON.MeshBuilder.CreateBox('skArmL_' + Math.random(), { width: 0.16, height: 0.18, depth: 0.36 }, scene);
        armLeft.position = new BABYLON.Vector3(-0.40, 1.04, 0.18);
        armLeft.material = boneMat;
        armLeft.parent = skeletonGroup;
        const armRight = BABYLON.MeshBuilder.CreateBox('skArmR_' + Math.random(), { width: 0.16, height: 0.18, depth: 0.36 }, scene);
        armRight.position = new BABYLON.Vector3(0.40, 1.04, 0.18);
        armRight.material = boneMat;
        armRight.parent = skeletonGroup;

        const fistLeft = BABYLON.MeshBuilder.CreateBox('skFistL_' + Math.random(), { width: 0.16, height: 0.16, depth: 0.18 }, scene);
        fistLeft.position = new BABYLON.Vector3(-0.40, 1.04, 0.46);
        fistLeft.material = boneMat;
        fistLeft.parent = skeletonGroup;
        const fistRight = BABYLON.MeshBuilder.CreateBox('skFistR_' + Math.random(), { width: 0.16, height: 0.16, depth: 0.18 }, scene);
        fistRight.position = new BABYLON.Vector3(0.40, 1.04, 0.46);
        fistRight.material = boneMat;
        fistRight.parent = skeletonGroup;

        const legLeft = BABYLON.MeshBuilder.CreateBox('skLegL_' + Math.random(), { width: 0.16, height: 0.34, depth: 0.18 }, scene);
        legLeft.position = new BABYLON.Vector3(-0.14, 0.48, 0.0);
        legLeft.material = boneMat;
        legLeft.parent = skeletonGroup;
        const legRight = BABYLON.MeshBuilder.CreateBox('skLegR_' + Math.random(), { width: 0.16, height: 0.34, depth: 0.18 }, scene);
        legRight.position = new BABYLON.Vector3(0.14, 0.48, 0.0);
        legRight.material = boneMat;
        legRight.parent = skeletonGroup;

        const bootLeft = BABYLON.MeshBuilder.CreateBox('skBootL_' + Math.random(), { width: 0.18, height: 0.14, depth: 0.24 }, scene);
        bootLeft.position = new BABYLON.Vector3(-0.14, 0.20, 0.04);
        bootLeft.material = jointMat;
        bootLeft.parent = skeletonGroup;
        const bootRight = BABYLON.MeshBuilder.CreateBox('skBootR_' + Math.random(), { width: 0.18, height: 0.14, depth: 0.24 }, scene);
        bootRight.position = new BABYLON.Vector3(0.14, 0.20, 0.04);
        bootRight.material = jointMat;
        bootRight.parent = skeletonGroup;

        const swordHilt = BABYLON.MeshBuilder.CreateBox('skSwordHilt_' + Math.random(), { width: 0.07, height: 0.18, depth: 0.07 }, scene);
        swordHilt.position = new BABYLON.Vector3(0.52, 0.98, 0.44);
        swordHilt.rotation.x = -0.45;
        swordHilt.material = hiltMat;
        swordHilt.parent = skeletonGroup;
        const sword = BABYLON.MeshBuilder.CreateBox('skSword_' + Math.random(), { width: 0.07, height: 0.54, depth: 0.05 }, scene);
        sword.position = new BABYLON.Vector3(0.55, 1.14, 0.42);
        sword.rotation.x = -0.45;
        sword.material = swordMat;
        sword.parent = skeletonGroup;

        const skeleton = {
            group: skeletonGroup,
            position: spawnPos,
            speed: 0.17,
            health: 2,
            maxHealth: 2,
            type: 'white',
            isSkeleton: true,
            hitPlayer: false,
            isDead: false,
            healthBar: null,
            head, body,
            armLeft, armRight, fistLeft, fistRight,
            legLeft, legRight, bootLeft, bootRight,
            sword,
            animationState: 'walk',
            animationTimer: 0,
            animationSpeed: 0.006,
            deathTimer: 0
        };

        skeleton.healthBar = createZombieHealthBar(skeleton);
        updateZombieHealthBar(skeleton);
        zombies.push(skeleton);
        return;
    }

    // ===== MATERIALS =====
    // Skin color varies by type; clothing/pants/boots stay the same
    const skinColors = {
        green:  { r: 0.35, g: 0.78, b: 0.12 },
        blue:   { r: 0.22, g: 0.50, b: 0.88 },
        purple: { r: 0.60, g: 0.20, b: 0.80 }
    };
    const patchColors = {
        green:  { r: 0.18, g: 0.44, b: 0.06 },
        blue:   { r: 0.10, g: 0.26, b: 0.55 },
        purple: { r: 0.35, g: 0.08, b: 0.50 }
    };
    const sc = skinColors[zombieType];
    const pc = patchColors[zombieType];

    const zombieGroup = new BABYLON.TransformNode('zombieGroup_' + Math.random(), scene);
    zombieGroup.position = spawnPos;

    const mkMat = (r, g, b, em = 0.28) => {
        const m = new BABYLON.StandardMaterial('zm_' + Math.random(), scene);
        m.diffuseColor  = new BABYLON.Color3(r, g, b);
        m.emissiveColor = new BABYLON.Color3(r * em, g * em, b * em);
        return m;
    };

    const skinMat    = mkMat(sc.r, sc.g, sc.b, 0.30);
    const patchMat   = mkMat(pc.r, pc.g, pc.b, 0.28);
    const clothMat   = mkMat(0.32, 0.15, 0.04, 0.28);  // brown ragged clothing
    const pantsMat   = mkMat(0.08, 0.06, 0.11, 0.20);  // near-black pants
    const bootsMat   = mkMat(0.27, 0.13, 0.04, 0.25);  // dark brown boots
    const eyeMat     = mkMat(0.04, 0.04, 0.04, 0.10);  // black eyes

    // ===== HEAD =====
    const head = BABYLON.MeshBuilder.CreateBox('head_' + Math.random(), { width: 0.70, height: 0.62, depth: 0.62 }, scene);
    head.position.y = 1.52;
    head.material = skinMat;
    head.parent = zombieGroup;

    // Dark patch - upper-left of head
    const patchA = BABYLON.MeshBuilder.CreateBox('pA_' + Math.random(), { width: 0.22, height: 0.20, depth: 0.08 }, scene);
    patchA.position = new BABYLON.Vector3(-0.18, 1.60, 0.32);
    patchA.material = patchMat;
    patchA.parent = zombieGroup;

    // Dark patch - right side of head
    const patchB = BABYLON.MeshBuilder.CreateBox('pB_' + Math.random(), { width: 0.20, height: 0.16, depth: 0.08 }, scene);
    patchB.position = new BABYLON.Vector3(0.22, 1.46, 0.32);
    patchB.material = patchMat;
    patchB.parent = zombieGroup;

    // Side head-lumps (zombie ear bumps)
    const lumpL = BABYLON.MeshBuilder.CreateBox('lumpL_' + Math.random(), { width: 0.10, height: 0.18, depth: 0.16 }, scene);
    lumpL.position = new BABYLON.Vector3(-0.40, 1.50, 0.0);
    lumpL.material = skinMat;
    lumpL.parent = zombieGroup;

    const lumpR = BABYLON.MeshBuilder.CreateBox('lumpR_' + Math.random(), { width: 0.10, height: 0.18, depth: 0.16 }, scene);
    lumpR.position = new BABYLON.Vector3(0.40, 1.50, 0.0);
    lumpR.material = skinMat;
    lumpR.parent = zombieGroup;

    // Eyes - large black squares
    const eyeLeft = BABYLON.MeshBuilder.CreateBox('eyeL_' + Math.random(), { width: 0.16, height: 0.16, depth: 0.05 }, scene);
    eyeLeft.position = new BABYLON.Vector3(-0.17, 1.54, 0.32);
    eyeLeft.material = eyeMat;
    eyeLeft.parent = zombieGroup;

    const eyeRight = BABYLON.MeshBuilder.CreateBox('eyeR_' + Math.random(), { width: 0.16, height: 0.16, depth: 0.05 }, scene);
    eyeRight.position = new BABYLON.Vector3(0.17, 1.54, 0.32);
    eyeRight.material = eyeMat;
    eyeRight.parent = zombieGroup;

    // ===== TORSO - brown ragged clothing =====
    const body = BABYLON.MeshBuilder.CreateBox('body_' + Math.random(), { width: 0.58, height: 0.58, depth: 0.44 }, scene);
    body.position.y = 0.92;
    body.material = clothMat;
    body.parent = zombieGroup;

    // Skin showing through torn clothing
    const torsoSkinL = BABYLON.MeshBuilder.CreateBox('tsl_' + Math.random(), { width: 0.14, height: 0.20, depth: 0.08 }, scene);
    torsoSkinL.position = new BABYLON.Vector3(-0.18, 0.98, 0.24);
    torsoSkinL.material = skinMat;
    torsoSkinL.parent = zombieGroup;

    const torsoSkinR = BABYLON.MeshBuilder.CreateBox('tsr_' + Math.random(), { width: 0.14, height: 0.18, depth: 0.08 }, scene);
    torsoSkinR.position = new BABYLON.Vector3(0.16, 0.88, 0.24);
    torsoSkinR.material = skinMat;
    torsoSkinR.parent = zombieGroup;

    // ===== ARMS - green, outstretched forward (zombie pose) =====
    const armLeft = BABYLON.MeshBuilder.CreateBox('armL_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.40 }, scene);
    armLeft.position = new BABYLON.Vector3(-0.44, 1.06, 0.22);
    armLeft.material = skinMat;
    armLeft.parent = zombieGroup;

    const armRight = BABYLON.MeshBuilder.CreateBox('armR_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.40 }, scene);
    armRight.position = new BABYLON.Vector3(0.44, 1.06, 0.22);
    armRight.material = skinMat;
    armRight.parent = zombieGroup;

    // Fists
    const fistLeft = BABYLON.MeshBuilder.CreateBox('fistL_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.22 }, scene);
    fistLeft.position = new BABYLON.Vector3(-0.44, 1.06, 0.53);
    fistLeft.material = skinMat;
    fistLeft.parent = zombieGroup;

    const fistRight = BABYLON.MeshBuilder.CreateBox('fistR_' + Math.random(), { width: 0.22, height: 0.22, depth: 0.22 }, scene);
    fistRight.position = new BABYLON.Vector3(0.44, 1.06, 0.53);
    fistRight.material = skinMat;
    fistRight.parent = zombieGroup;

    // ===== PANTS - near black =====
    const legLeft = BABYLON.MeshBuilder.CreateBox('legL_' + Math.random(), { width: 0.24, height: 0.32, depth: 0.28 }, scene);
    legLeft.position = new BABYLON.Vector3(-0.16, 0.50, 0.0);
    legLeft.material = pantsMat;
    legLeft.parent = zombieGroup;

    const legRight = BABYLON.MeshBuilder.CreateBox('legR_' + Math.random(), { width: 0.24, height: 0.32, depth: 0.28 }, scene);
    legRight.position = new BABYLON.Vector3(0.16, 0.50, 0.0);
    legRight.material = pantsMat;
    legRight.parent = zombieGroup;

    // ===== BOOTS - dark brown =====
    const bootLeft = BABYLON.MeshBuilder.CreateBox('bootL_' + Math.random(), { width: 0.26, height: 0.20, depth: 0.30 }, scene);
    bootLeft.position = new BABYLON.Vector3(-0.16, 0.24, 0.02);
    bootLeft.material = bootsMat;
    bootLeft.parent = zombieGroup;

    const bootRight = BABYLON.MeshBuilder.CreateBox('bootR_' + Math.random(), { width: 0.26, height: 0.20, depth: 0.30 }, scene);
    bootRight.position = new BABYLON.Vector3(0.16, 0.24, 0.02);
    bootRight.material = bootsMat;
    bootRight.parent = zombieGroup;
    
    // Create zombie data object
    const zombie = {
        group: zombieGroup,
        position: spawnPos,
        speed: 0.156,
        health: 2,
        type: zombieType,
        hitPlayer: false,
        isDead: false,
        healthBar: null,
        // Animated mesh parts
        head, body,
        armLeft, armRight, fistLeft, fistRight,
        legLeft, legRight, bootLeft, bootRight,
        // Animation state
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0.005,
        deathTimer: 0
    };
    
    // Create health bar for zombie
    zombie.healthBar = createZombieHealthBar(zombie);
    updateZombieHealthBar(zombie);
    
    zombies.push(zombie);
}

// Spawn first zombie immediately
createZombie();

// Cutscene system
let cutsceneActive = false;
let cutsceneTimer = 0;
let cutsceneResetDone = false;
const elves = [];
let campGroup = null;
let kingCastleGroup = null;

// ===== HOUSE & MISSION STATE =====
let playerInsideHouse = false;
let playerExteriorPos = null;
let playerExteriorRot = { x: 0, y: 0 };
let missionUIOpen = false;
let activeMission = null;
let missionKills = 0;
let promptLockedUntil = 0;
const completedMissions = new Set();
const MISSIONS = [
    { id: 1, name: 'First Blood',       desc: 'The undead creep ever closer. Kill 5 zombies to prove yourself worthy.',               killGoal: 5  },
    { id: 2, name: 'The Horde Rises',   desc: 'A greater horde approaches from the east. Eliminate 15 of the undead.',               killGoal: 15 },
    { id: 3, name: 'Stand Your Ground', desc: "The Necromancer's army grows bolder. Slay 30 of his minions and send him a message.", killGoal: 30 },
    { id: 4, name: 'Malachar Rising',    desc: 'The Necromancer himself has descended upon the forest. Face Malachar the Undying — and end this war.',     killGoal: 1  },
    { id: 5, name: 'The Inferanoth Strike', desc: 'Fire Dragons of the Inferanoth descend from the volcanic peaks, drawn by the chaos. Slay 3 of the magma dragons.', killGoal: 3 },
    { id: 6, name: 'Storm of the Veltharyn', desc: 'Wind Dragons of the Veltharyn spiral down from the high peaks. They are faster than fire and strike before you hear them. Slay 4.', killGoal: 4 },
];

function createElf(x, z) {
    const elfGroup = new BABYLON.TransformNode('elfGroup_' + Math.random(), scene);
    elfGroup.position = new BABYLON.Vector3(x, 1, z);

    // ===== MATERIALS =====
    // Bright yellow hair
    const yellowMat = new BABYLON.StandardMaterial('yellow_' + Math.random(), scene);
    yellowMat.diffuseColor = new BABYLON.Color3(1.0, 0.88, 0.0);
    yellowMat.emissiveColor = new BABYLON.Color3(0.45, 0.36, 0.0);

    // Orange/skin - face, ears, arms
    const skinMat = new BABYLON.StandardMaterial('skin_' + Math.random(), scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.92, 0.62, 0.35);
    skinMat.emissiveColor = new BABYLON.Color3(0.38, 0.22, 0.08);

    // Dark forest green - main tunic body
    const darkGreenMat = new BABYLON.StandardMaterial('dgreen_' + Math.random(), scene);
    darkGreenMat.diffuseColor = new BABYLON.Color3(0.07, 0.40, 0.07);
    darkGreenMat.emissiveColor = new BABYLON.Color3(0.02, 0.16, 0.02);

    // Lighter green - tunic front accent + shield center
    const lightGreenMat = new BABYLON.StandardMaterial('lgreen_' + Math.random(), scene);
    lightGreenMat.diffuseColor = new BABYLON.Color3(0.18, 0.62, 0.18);
    lightGreenMat.emissiveColor = new BABYLON.Color3(0.06, 0.26, 0.06);

    // Gold/yellow - belt
    const goldMat = new BABYLON.StandardMaterial('gold_' + Math.random(), scene);
    goldMat.diffuseColor = new BABYLON.Color3(0.88, 0.70, 0.06);
    goldMat.emissiveColor = new BABYLON.Color3(0.36, 0.26, 0.02);

    // Brown - boots/legs
    const brownMat = new BABYLON.StandardMaterial('brown_' + Math.random(), scene);
    brownMat.diffuseColor = new BABYLON.Color3(0.40, 0.20, 0.04);
    brownMat.emissiveColor = new BABYLON.Color3(0.15, 0.07, 0.01);

    // Light gray - sword blade, shield rim, shoulder pads
    const grayMat = new BABYLON.StandardMaterial('gray_' + Math.random(), scene);
    grayMat.diffuseColor = new BABYLON.Color3(0.78, 0.78, 0.78);
    grayMat.emissiveColor = new BABYLON.Color3(0.30, 0.30, 0.30);

    // Black - eyes
    const eyeMat = new BABYLON.StandardMaterial('eye_' + Math.random(), scene);
    eyeMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    eyeMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    // ===== HEAD =====
    // Yellow flat hair cap on top (wider/flatter than head)
    const hair = BABYLON.MeshBuilder.CreateBox('hair_' + Math.random(), { width: 0.58, height: 0.14, depth: 0.50 }, scene);
    hair.position.y = 1.54;
    hair.material = yellowMat;
    hair.parent = elfGroup;
    // Back-of-head hair flap (visible in back/side views)
    const hairBack = BABYLON.MeshBuilder.CreateBox('hairBack_' + Math.random(), { width: 0.50, height: 0.32, depth: 0.14 }, scene);
    hairBack.position = new BABYLON.Vector3(0, 1.36, -0.28);
    hairBack.material = yellowMat;
    hairBack.parent = elfGroup;

    // Head/face block - large skin-colored square
    const head = BABYLON.MeshBuilder.CreateBox('head_' + Math.random(), { width: 0.52, height: 0.44, depth: 0.44 }, scene);
    head.position.y = 1.30;
    head.material = skinMat;
    head.parent = elfGroup;

    // Left ear - base nub
    const earLeft = BABYLON.MeshBuilder.CreateBox('earL_' + Math.random(), { width: 0.11, height: 0.18, depth: 0.14 }, scene);
    earLeft.position = new BABYLON.Vector3(-0.32, 1.26, 0.0);
    earLeft.material = skinMat;
    earLeft.parent = elfGroup;
    // Left ear - pointy tip (cone leaning outward-upward)
    const earLeftTip = BABYLON.MeshBuilder.CreateCylinder('earLTip_' + Math.random(), { height: 0.24, diameterBottom: 0.12, diameterTop: 0, tessellation: 6 }, scene);
    earLeftTip.position = new BABYLON.Vector3(-0.34, 1.42, 0.0);
    earLeftTip.rotation.z = Math.PI / 9;  // lean tip outward-left
    earLeftTip.material = skinMat;
    earLeftTip.parent = elfGroup;

    // Right ear - base nub
    const earRight = BABYLON.MeshBuilder.CreateBox('earR_' + Math.random(), { width: 0.11, height: 0.18, depth: 0.14 }, scene);
    earRight.position = new BABYLON.Vector3(0.32, 1.26, 0.0);
    earRight.material = skinMat;
    earRight.parent = elfGroup;
    // Right ear - pointy tip (cone leaning outward-upward)
    const earRightTip = BABYLON.MeshBuilder.CreateCylinder('earRTip_' + Math.random(), { height: 0.24, diameterBottom: 0.12, diameterTop: 0, tessellation: 6 }, scene);
    earRightTip.position = new BABYLON.Vector3(0.34, 1.42, 0.0);
    earRightTip.rotation.z = -Math.PI / 9;  // lean tip outward-right
    earRightTip.material = skinMat;
    earRightTip.parent = elfGroup;

    // Left eye - large black square (very prominent like reference)
    const eyeLeft = BABYLON.MeshBuilder.CreateBox('eyeL_' + Math.random(), { width: 0.13, height: 0.14, depth: 0.06 }, scene);
    eyeLeft.position = new BABYLON.Vector3(-0.12, 1.31, 0.24);
    eyeLeft.material = eyeMat;
    eyeLeft.parent = elfGroup;

    // Right eye - large black square
    const eyeRight = BABYLON.MeshBuilder.CreateBox('eyeR_' + Math.random(), { width: 0.13, height: 0.14, depth: 0.06 }, scene);
    eyeRight.position = new BABYLON.Vector3(0.12, 1.31, 0.24);
    eyeRight.material = eyeMat;
    eyeRight.parent = elfGroup;

    // ===== BODY - dark green tunic (no neck, head sits directly on torso) =====
    // Main tunic - dark green, tall block covering shoulders to waist
    const torso = BABYLON.MeshBuilder.CreateBox('torso_' + Math.random(), { width: 0.54, height: 0.74, depth: 0.42 }, scene);
    torso.position.y = 0.74;
    torso.material = darkGreenMat;
    torso.parent = elfGroup;

    // Lighter green front panel accent on tunic
    const tFront = BABYLON.MeshBuilder.CreateBox('tFront_' + Math.random(), { width: 0.30, height: 0.56, depth: 0.08 }, scene);
    tFront.position = new BABYLON.Vector3(0, 0.80, 0.24);
    tFront.material = lightGreenMat;
    tFront.parent = elfGroup;

    // Gold belt at waist
    const belt = BABYLON.MeshBuilder.CreateBox('belt_' + Math.random(), { width: 0.52, height: 0.10, depth: 0.40 }, scene);
    belt.position.y = 0.40;
    belt.material = goldMat;
    belt.parent = elfGroup;

    // Gray shoulder pad left
    const shoulderLeft = BABYLON.MeshBuilder.CreateBox('shoulderL_' + Math.random(), { width: 0.16, height: 0.18, depth: 0.32 }, scene);
    shoulderLeft.position = new BABYLON.Vector3(-0.38, 1.06, 0.0);
    shoulderLeft.material = grayMat;
    shoulderLeft.parent = elfGroup;

    // Gray shoulder pad right
    const shoulderRight = BABYLON.MeshBuilder.CreateBox('shoulderR_' + Math.random(), { width: 0.16, height: 0.18, depth: 0.32 }, scene);
    shoulderRight.position = new BABYLON.Vector3(0.38, 1.06, 0.0);
    shoulderRight.material = grayMat;
    shoulderRight.parent = elfGroup;

    // ===== ARMS - short, wide skin-colored blocks =====
    const armLeft = BABYLON.MeshBuilder.CreateBox('armL_' + Math.random(), { width: 0.18, height: 0.30, depth: 0.22 }, scene);
    armLeft.position = new BABYLON.Vector3(-0.42, 0.82, 0.0);
    armLeft.material = skinMat;
    armLeft.parent = elfGroup;

    const armRight = BABYLON.MeshBuilder.CreateBox('armR_' + Math.random(), { width: 0.18, height: 0.30, depth: 0.22 }, scene);
    armRight.position = new BABYLON.Vector3(0.42, 0.82, 0.0);
    armRight.material = skinMat;
    armRight.parent = elfGroup;

    // ===== LEGS/BOOTS - wide brown blocks =====
    const legLeft = BABYLON.MeshBuilder.CreateBox('legL_' + Math.random(), { width: 0.22, height: 0.30, depth: 0.26 }, scene);
    legLeft.position = new BABYLON.Vector3(-0.14, 0.15, 0.0);
    legLeft.material = brownMat;
    legLeft.parent = elfGroup;

    const legRight = BABYLON.MeshBuilder.CreateBox('legR_' + Math.random(), { width: 0.22, height: 0.30, depth: 0.26 }, scene);
    legRight.position = new BABYLON.Vector3(0.14, 0.15, 0.0);
    legRight.material = brownMat;
    legRight.parent = elfGroup;

    // ===== SWORD ARM PIVOT (all sword parts rotate with arm as one unit) =====
    const swordArm = new BABYLON.TransformNode('swordArm_' + Math.random(), scene);
    swordArm.position = new BABYLON.Vector3(0.42, 1.05, 0); // right shoulder pivot
    swordArm.parent = elfGroup;

    // Right arm mesh attached to pivot
    armRight.parent = swordArm;
    armRight.position = new BABYLON.Vector3(0, -0.23, 0);

    // Handle - at hand level below pivot
    const handle = BABYLON.MeshBuilder.CreateBox('handle_' + Math.random(), { width: 0.09, height: 0.26, depth: 0.09 }, scene);
    handle.position = new BABYLON.Vector3(0, -0.44, 0.05);
    handle.material = brownMat;
    handle.parent = swordArm;

    // Crossguard
    const crossguard = BABYLON.MeshBuilder.CreateBox('cg_' + Math.random(), { width: 0.26, height: 0.08, depth: 0.08 }, scene);
    crossguard.position = new BABYLON.Vector3(0, -0.57, 0.05);
    crossguard.material = grayMat;
    crossguard.parent = swordArm;

    // Blade - extends down from crossguard
    const blade = BABYLON.MeshBuilder.CreateBox('blade_' + Math.random(), { width: 0.08, height: 0.80, depth: 0.06 }, scene);
    blade.position = new BABYLON.Vector3(0, -1.00, 0.05);
    blade.material = grayMat;
    blade.parent = swordArm;

    // Default rest angle (sword hanging at side, arm forward)
    swordArm.rotation.x = -0.2;

    // ===== SHIELD - left hand, gray rim + dark green + light green boss (50% larger) =====
    // Gray outer rim
    const shield = BABYLON.MeshBuilder.CreateBox('shield_' + Math.random(), { width: 0.63, height: 0.66, depth: 0.15 }, scene);
    shield.position = new BABYLON.Vector3(-0.52, 0.76, 0.10);
    shield.rotation.y = Math.PI / 8;
    shield.material = grayMat;
    shield.parent = elfGroup;

    // Dark green inner shield
    const shieldInner = BABYLON.MeshBuilder.CreateBox('shieldInner_' + Math.random(), { width: 0.42, height: 0.45, depth: 0.17 }, scene);
    shieldInner.position = new BABYLON.Vector3(-0.52, 0.76, 0.20);
    shieldInner.rotation.y = Math.PI / 8;
    shieldInner.material = darkGreenMat;
    shieldInner.parent = elfGroup;

    // Light green center boss
    const shieldBoss = BABYLON.MeshBuilder.CreateBox('shieldBoss_' + Math.random(), { width: 0.20, height: 0.20, depth: 0.18 }, scene);
    shieldBoss.position = new BABYLON.Vector3(-0.52, 0.76, 0.28);
    shieldBoss.rotation.y = Math.PI / 8;
    shieldBoss.material = lightGreenMat;
    shieldBoss.parent = elfGroup;

    return {
        group: elfGroup,
        position: new BABYLON.Vector3(x, 1, z),
        targetZombie: null,
        isAttacking: false,
        animationState: 'idle',
        animationTimer: 0,
        animationSpeed: 0.08,
        head: head,
        torso: torso,
        armLeft: armLeft,
        armRight: armRight,
        swordArm: swordArm,
        legLeft: legLeft,
        legRight: legRight,
        blade: blade,
        shield: shield,
        canJump: true,
        isJumping: false,
        jumpVelocity: 0,
        jumpCooldown: 0,
        jumpHeight: 0
    };
}

// Function to create Elf King (special variant with crown and royal colors)
function createElfKing(x, z) {
    const elfGroup = new BABYLON.TransformNode('elfKingGroup_' + Math.random(), scene);
    elfGroup.position = new BABYLON.Vector3(x, 1, z);

    // ===== MATERIALS =====
    const crownMat = new BABYLON.StandardMaterial('k_crown_' + Math.random(), scene);
    crownMat.diffuseColor = new BABYLON.Color3(1.0, 0.80, 0.0);
    crownMat.emissiveColor = new BABYLON.Color3(0.7, 0.45, 0.0);

    const gemMat = new BABYLON.StandardMaterial('k_gem_' + Math.random(), scene);
    gemMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 1.0);
    gemMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 1.0);

    const yellowMat = new BABYLON.StandardMaterial('k_yellow_' + Math.random(), scene);
    yellowMat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.0);
    yellowMat.emissiveColor = new BABYLON.Color3(0.55, 0.40, 0.0);

    const skinMat = new BABYLON.StandardMaterial('k_skin_' + Math.random(), scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.92, 0.65, 0.38);
    skinMat.emissiveColor = new BABYLON.Color3(0.40, 0.24, 0.10);

    const blueMat = new BABYLON.StandardMaterial('k_blue_' + Math.random(), scene);
    blueMat.diffuseColor = new BABYLON.Color3(0.12, 0.22, 0.72);
    blueMat.emissiveColor = new BABYLON.Color3(0.04, 0.08, 0.28);

    const redMat = new BABYLON.StandardMaterial('k_red_' + Math.random(), scene);
    redMat.diffuseColor = new BABYLON.Color3(0.85, 0.10, 0.10);
    redMat.emissiveColor = new BABYLON.Color3(0.40, 0.03, 0.03);

    const goldMat = new BABYLON.StandardMaterial('k_gold_' + Math.random(), scene);
    goldMat.diffuseColor = new BABYLON.Color3(1.0, 0.78, 0.0);
    goldMat.emissiveColor = new BABYLON.Color3(0.55, 0.35, 0.0);

    const brownMat = new BABYLON.StandardMaterial('k_brown_' + Math.random(), scene);
    brownMat.diffuseColor = new BABYLON.Color3(0.42, 0.22, 0.05);
    brownMat.emissiveColor = new BABYLON.Color3(0.16, 0.08, 0.01);

    const eyeMat = new BABYLON.StandardMaterial('k_eye_' + Math.random(), scene);
    eyeMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    eyeMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    // Glowing gold sword blade
    const glowBladeMat = new BABYLON.StandardMaterial('k_glowBlade_' + Math.random(), scene);
    glowBladeMat.diffuseColor = new BABYLON.Color3(1.0, 0.90, 0.2);
    glowBladeMat.emissiveColor = new BABYLON.Color3(1.0, 0.75, 0.0);
    glowBladeMat.specularColor = new BABYLON.Color3(1, 1, 0.5);
    glowBladeMat.specularPower = 64;

    // ===== CROWN =====
    const crownBase = BABYLON.MeshBuilder.CreateBox('k_crownBase', { width: 0.62, height: 0.22, depth: 0.54 }, scene);
    crownBase.position.y = 1.65;
    crownBase.material = crownMat;
    crownBase.parent = elfGroup;

    // 5 crown spikes: front taller with blue gem, others regular gold
    const spikeAngles = [0, Math.PI/2, Math.PI, -Math.PI/2]; // front, right, back, left
    const spikeHeights = [0.44, 0.30, 0.28, 0.30]; // front spike tallest
    for (let i = 0; i < 4; i++) {
        const sp = BABYLON.MeshBuilder.CreateCylinder('k_sp_' + i, {
            height: spikeHeights[i], diameterBottom: 0.11, diameterTop: 0.02, tessellation: 6
        }, scene);
        const dist = i === 0 ? 0.22 : 0.26;
        sp.position = new BABYLON.Vector3(
            Math.sin(spikeAngles[i]) * dist,
            1.65 + spikeHeights[i] / 2 + 0.11,
            Math.cos(spikeAngles[i]) * dist
        );
        sp.material = crownMat;
        sp.parent = elfGroup;
    }
    // Blue gem on front spike
    const gem = BABYLON.MeshBuilder.CreateSphere('k_gem', { diameter: 0.10, segments: 4 }, scene);
    gem.position = new BABYLON.Vector3(0, 1.65 + 0.44 + 0.11 + 0.06, 0.22);
    gem.material = gemMat;
    gem.parent = elfGroup;

    // ===== HEAD =====
    const hair = BABYLON.MeshBuilder.CreateBox('k_hair', { width: 0.60, height: 0.16, depth: 0.52 }, scene);
    hair.position.y = 1.55;
    hair.material = yellowMat;
    hair.parent = elfGroup;

    const head = BABYLON.MeshBuilder.CreateBox('k_head', { width: 0.54, height: 0.46, depth: 0.46 }, scene);
    head.position.y = 1.30;
    head.material = skinMat;
    head.parent = elfGroup;

    // Pointed ears
    for (const side of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateBox('k_ear_' + side, { width: 0.10, height: 0.17, depth: 0.13 }, scene);
        ear.position = new BABYLON.Vector3(side * 0.33, 1.26, 0.0);
        ear.material = skinMat;
        ear.parent = elfGroup;
        const tip = BABYLON.MeshBuilder.CreateCylinder('k_earTip_' + side, { height: 0.22, diameterBottom: 0.11, diameterTop: 0, tessellation: 5 }, scene);
        tip.position = new BABYLON.Vector3(side * 0.35, 1.42, 0.0);
        tip.rotation.z = side * (-Math.PI / 9);
        tip.material = skinMat;
        tip.parent = elfGroup;
    }

    // Eyes
    for (const side of [-1, 1]) {
        const eye = BABYLON.MeshBuilder.CreateBox('k_eye_' + side, { width: 0.12, height: 0.13, depth: 0.06 }, scene);
        eye.position = new BABYLON.Vector3(side * 0.12, 1.30, 0.24);
        eye.material = eyeMat;
        eye.parent = elfGroup;
    }

    // ===== CAPE (multi-segment, prominent) =====
    // Cape collar across shoulders
    const capeCollar = BABYLON.MeshBuilder.CreateBox('k_capeCollar', { width: 0.68, height: 0.18, depth: 0.20 }, scene);
    capeCollar.position = new BABYLON.Vector3(0, 1.08, -0.22);
    capeCollar.material = redMat;
    capeCollar.parent = elfGroup;

    // Cape upper body (flows from shoulders down)
    const capeUpper = BABYLON.MeshBuilder.CreateBox('k_capeUpper', { width: 0.62, height: 0.38, depth: 0.16 }, scene);
    capeUpper.position = new BABYLON.Vector3(0, 0.82, -0.28);
    capeUpper.material = redMat;
    capeUpper.parent = elfGroup;

    // Cape lower (wider, flares at bottom)
    const capeLower = BABYLON.MeshBuilder.CreateBox('k_capeLower', { width: 0.72, height: 0.40, depth: 0.14 }, scene);
    capeLower.position = new BABYLON.Vector3(0, 0.46, -0.30);
    capeLower.material = redMat;
    capeLower.parent = elfGroup;

    // ===== BODY =====
    const torso = BABYLON.MeshBuilder.CreateBox('k_torso', { width: 0.54, height: 0.72, depth: 0.42 }, scene);
    torso.position.y = 0.76;
    torso.material = blueMat;
    torso.parent = elfGroup;

    // Gold center strip
    const strip = BABYLON.MeshBuilder.CreateBox('k_strip', { width: 0.14, height: 0.58, depth: 0.08 }, scene);
    strip.position = new BABYLON.Vector3(0, 0.82, 0.24);
    strip.material = goldMat;
    strip.parent = elfGroup;

    // Gold belt
    const belt = BABYLON.MeshBuilder.CreateBox('k_belt', { width: 0.52, height: 0.11, depth: 0.40 }, scene);
    belt.position.y = 0.41;
    belt.material = goldMat;
    belt.parent = elfGroup;

    // Gold shoulder pads
    const shoulderL = BABYLON.MeshBuilder.CreateBox('k_shoulderL', { width: 0.18, height: 0.16, depth: 0.34 }, scene);
    shoulderL.position = new BABYLON.Vector3(-0.38, 1.08, 0.0);
    shoulderL.material = goldMat;
    shoulderL.parent = elfGroup;

    const shoulderR = BABYLON.MeshBuilder.CreateBox('k_shoulderR', { width: 0.18, height: 0.16, depth: 0.34 }, scene);
    shoulderR.position = new BABYLON.Vector3(0.38, 1.08, 0.0);
    shoulderR.material = goldMat;
    shoulderR.parent = elfGroup;

    // Left arm (free)
    const armLeft = BABYLON.MeshBuilder.CreateBox('k_armL', { width: 0.18, height: 0.32, depth: 0.22 }, scene);
    armLeft.position = new BABYLON.Vector3(-0.42, 0.82, 0.0);
    armLeft.material = skinMat;
    armLeft.parent = elfGroup;

    // Legs
    const legLeft = BABYLON.MeshBuilder.CreateBox('k_legL', { width: 0.22, height: 0.32, depth: 0.26 }, scene);
    legLeft.position = new BABYLON.Vector3(-0.14, 0.14, 0.0);
    legLeft.material = brownMat;
    legLeft.parent = elfGroup;

    const legRight = BABYLON.MeshBuilder.CreateBox('k_legR', { width: 0.22, height: 0.32, depth: 0.26 }, scene);
    legRight.position = new BABYLON.Vector3(0.14, 0.14, 0.0);
    legRight.material = brownMat;
    legRight.parent = elfGroup;

    // ===== SWORD ARM PIVOT (sword rotates with arm) =====
    const swordArm = new BABYLON.TransformNode('k_swordArm_' + Math.random(), scene);
    swordArm.position = new BABYLON.Vector3(0.42, 1.05, 0); // at right shoulder
    swordArm.parent = elfGroup;

    // Right arm mesh parented to swordArm pivot
    const armRight = BABYLON.MeshBuilder.CreateBox('k_armR', { width: 0.18, height: 0.32, depth: 0.22 }, scene);
    armRight.position = new BABYLON.Vector3(0, -0.16, 0);
    armRight.material = skinMat;
    armRight.parent = swordArm;

    // Sword pieces parented to swordArm so they rotate together
    // Handle at hand position
    const handle = BABYLON.MeshBuilder.CreateBox('k_handle', { width: 0.08, height: 0.24, depth: 0.08 }, scene);
    handle.position = new BABYLON.Vector3(0.0, -0.34, 0.06);
    handle.material = goldMat;
    handle.parent = swordArm;

    // Crossguard
    const crossguard = BABYLON.MeshBuilder.CreateBox('k_cg', { width: 0.30, height: 0.08, depth: 0.08 }, scene);
    crossguard.position = new BABYLON.Vector3(0.0, -0.47, 0.06);
    crossguard.material = goldMat;
    crossguard.parent = swordArm;

    // Glowing golden blade
    const blade = BABYLON.MeshBuilder.CreateBox('k_blade', { width: 0.08, height: 0.88, depth: 0.06 }, scene);
    blade.position = new BABYLON.Vector3(0.0, -0.93, 0.06);
    blade.material = glowBladeMat;
    blade.parent = swordArm;

    // Blade tip glow cap
    const bladeTip = BABYLON.MeshBuilder.CreateCylinder('k_bladeTip', { height: 0.14, diameterBottom: 0.07, diameterTop: 0, tessellation: 4 }, scene);
    bladeTip.position = new BABYLON.Vector3(0.0, -1.44, 0.06);
    bladeTip.material = glowBladeMat;
    bladeTip.parent = swordArm;

    // Default rest angle (sword hanging at side, arm forward)
    swordArm.rotation.x = -0.2;

    return {
        group: elfGroup,
        position: new BABYLON.Vector3(x, 1, z),
        targetZombie: null,
        isAttacking: false,
        animationState: 'idle',
        animationTimer: 0,
        animationSpeed: 0.08,
        head: head,
        torso: torso,
        armLeft: armLeft,
        armRight: armRight,
        legLeft: legLeft,
        legRight: legRight,
        swordArm: swordArm,
        blade: blade,
        capeCollar: capeCollar,
        capeUpper: capeUpper,
        capeLower: capeLower,
        isKing: true,
        canJump: true,
        isJumping: false,
        jumpVelocity: 0,
        jumpCooldown: 0,
        jumpHeight: 0
    };
}

// Track hut world positions for elf collision avoidance
const hutColliders = [];

// Returns true if (x,z) is within minDist of the house's rectangular footprint
function nearHouse(x, z, minDist = 10) {
    return (
        x > HOUSE_POS.x - 3.5 - minDist && x < HOUSE_POS.x + 3.5 + minDist &&
        z > HOUSE_POS.z - 4.5 - minDist && z < HOUSE_POS.z + 4.5 + minDist
    );
}

// Returns a random wander position around (cx,cz) within maxRadius that is
// at least 5 units clear of the house.
function safeCampPos(cx, cz, maxRadius) {
    let x, z, attempts = 0;
    do {
        const angle = Math.random() * Math.PI * 2;
        const r = maxRadius * (0.4 + Math.random() * 0.6);
        x = cx + Math.cos(angle) * r;
        z = cz + Math.sin(angle) * r;
        attempts++;
    } while ((nearHouse(x, z) || isInRiver(x, z, 2.5)) && attempts < 30);
    return new BABYLON.Vector3(x, 1, z);
}

function getClosestRiverPointAndNormal(x, z) {
    let best = null;

    for (let i = 0; i < RIVER_CENTERLINE.length - 1; i++) {
        const a = RIVER_CENTERLINE[i];
        const b = RIVER_CENTERLINE[i + 1];
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const abLenSq = abx * abx + abz * abz;
        if (abLenSq <= 0.000001) continue;

        const apx = x - a.x;
        const apz = z - a.z;
        const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
        const cx = a.x + abx * t;
        const cz = a.z + abz * t;
        const dx = x - cx;
        const dz = z - cz;
        const d = Math.sqrt(dx * dx + dz * dz);

        if (!best || d < best.distance) {
            const tangent = new BABYLON.Vector3(abx, 0, abz);
            tangent.normalize();
            const normal = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
            best = { x: cx, z: cz, distance: d, normal };
        }
    }

    return best;
}

function createKingCastleNearRiver(campX, campZ) {
    if (kingCastleGroup) {
        kingCastleGroup.dispose();
        kingCastleGroup = null;
    }

    const campPos = new BABYLON.Vector3(campX, 0, campZ);
    const towardCenter = new BABYLON.Vector3(-campX, 0, -campZ);
    if (towardCenter.length() < 0.001) towardCenter.z = -1;
    towardCenter.normalize();
    const side = new BABYLON.Vector3(-towardCenter.z, 0, towardCenter.x);

    const isOpenSpace = (x, z) => {
        if (nearHouse(x, z, 8)) return false;
        if (isInRiver(x, z, 6)) return false;
        for (const hut of hutColliders) {
            const dx = x - hut.x;
            const dz = z - hut.z;
            if (Math.sqrt(dx * dx + dz * dz) < hut.radius + 4) return false;
        }
        for (const t of treePositions) {
            const dx = x - t[0];
            const dz = z - t[1];
            if (Math.sqrt(dx * dx + dz * dz) < 4.2) return false;
        }
        return true;
    };

    let castlePos = null;
    const ringDistances = [26, 34, 42, 50, 58];
    const lateralOffsets = [0, -12, 12, -22, 22];
    for (const d of ringDistances) {
        for (const lat of lateralOffsets) {
            const p = campPos
                .add(towardCenter.scale(d))
                .add(side.scale(lat));
            if (isOpenSpace(p.x, p.z)) {
                castlePos = new BABYLON.Vector3(p.x, 0, p.z);
                break;
            }
        }
        if (castlePos) break;
    }

    if (!castlePos) {
        const fallback = campPos.add(towardCenter.scale(42));
        castlePos = new BABYLON.Vector3(fallback.x, 0, fallback.z);
    }

    kingCastleGroup = new BABYLON.TransformNode('kingCastleGroup_' + Math.random(), scene);
    kingCastleGroup.position = new BABYLON.Vector3(castlePos.x, 0, castlePos.z);
    kingCastleGroup.rotation.y = Math.atan2(campX - castlePos.x, campZ - castlePos.z) + Math.PI;

    const stoneMat = new BABYLON.StandardMaterial('kCastleStone_' + Math.random(), scene);
    stoneMat.diffuseColor = new BABYLON.Color3(0.16, 0.34, 0.92);
    stoneMat.emissiveColor = new BABYLON.Color3(0.36, 0.30, 0.06);
    stoneMat.specularColor = new BABYLON.Color3(0.95, 0.90, 0.25);

    const flagMat = new BABYLON.StandardMaterial('kCastleFlag_' + Math.random(), scene);
    flagMat.diffuseColor = new BABYLON.Color3(0.11, 0.25, 0.52);
    flagMat.emissiveColor = new BABYLON.Color3(0.05, 0.09, 0.18);
    flagMat.backFaceCulling = false;

    const mk = (name, mesh) => {
        mesh.name = name + '_' + Math.random();
        mesh.parent = kingCastleGroup;
        mesh.material = stoneMat;
        mesh.checkCollisions = true;
        return mesh;
    };

    // Plinth and keep
    const plinth = mk('kCastlePlinth', BABYLON.MeshBuilder.CreateBox('kCastlePlinth', { width: 20, height: 1.2, depth: 14 }, scene));
    plinth.position = new BABYLON.Vector3(0, 0.6, 0);

    const keep = mk('kCastleKeep', BABYLON.MeshBuilder.CreateBox('kCastleKeep', { width: 12, height: 4.8, depth: 7.4 }, scene));
    keep.position = new BABYLON.Vector3(0, 3.2, -0.3);

    // Front wall with gate opening section
    const frontWallL = mk('kCastleFrontL', BABYLON.MeshBuilder.CreateBox('kCastleFrontL', { width: 5.0, height: 3.8, depth: 1.1 }, scene));
    frontWallL.position = new BABYLON.Vector3(-4.5, 2.5, 4.9);
    const frontWallR = mk('kCastleFrontR', BABYLON.MeshBuilder.CreateBox('kCastleFrontR', { width: 5.0, height: 3.8, depth: 1.1 }, scene));
    frontWallR.position = new BABYLON.Vector3(4.5, 2.5, 4.9);

    const gateArch = mk('kCastleGate', BABYLON.MeshBuilder.CreateCylinder('kCastleGate', {
        height: 1.0,
        diameterTop: 2.3,
        diameterBottom: 2.3,
        tessellation: 20,
        arc: 0.5
    }, scene));
    gateArch.position = new BABYLON.Vector3(0, 1.3, 4.95);
    gateArch.rotation.x = Math.PI / 2;

    // Corner towers and center tower
    const towerOffsets = [
        [-7.2, -4.6], [7.2, -4.6],
        [-7.2, 4.7], [7.2, 4.7]
    ];
    towerOffsets.forEach((p, i) => {
        const tower = mk('kCastleTower' + i, BABYLON.MeshBuilder.CreateCylinder('kCastleTower' + i, {
            diameter: 3.2,
            height: 7.8,
            tessellation: 18
        }, scene));
        tower.position = new BABYLON.Vector3(p[0], 4.0, p[1]);
    });

    const centerTower = mk('kCastleCenterTower', BABYLON.MeshBuilder.CreateCylinder('kCastleCenterTower', {
        diameter: 3.6,
        height: 9.2,
        tessellation: 18
    }, scene));
    centerTower.position = new BABYLON.Vector3(0, 4.8, -2.4);

    // Battlements
    for (let i = -5; i <= 5; i++) {
        if (Math.abs(i) <= 1) continue;
        const tooth = mk('kCastleToothF' + i, BABYLON.MeshBuilder.CreateBox('kCastleToothF' + i, {
            width: 0.9,
            height: 0.8,
            depth: 0.8
        }, scene));
        tooth.position = new BABYLON.Vector3(i * 1.05, 5.7, 3.65);
    }

    for (let i = -4; i <= 4; i++) {
        const tooth = mk('kCastleToothB' + i, BABYLON.MeshBuilder.CreateBox('kCastleToothB' + i, {
            width: 0.9,
            height: 0.8,
            depth: 0.8
        }, scene));
        tooth.position = new BABYLON.Vector3(i * 1.2, 5.7, -4.0);
    }

    // Blue flags
    const addFlag = (x, y, z, scale = 1) => {
        const pole = BABYLON.MeshBuilder.CreateBox('kCastlePole_' + Math.random(), {
            width: 0.08 * scale,
            height: 2.0 * scale,
            depth: 0.08 * scale
        }, scene);
        pole.parent = kingCastleGroup;
        pole.position = new BABYLON.Vector3(x, y, z);
        pole.material = stoneMat;

        const flag = BABYLON.MeshBuilder.CreatePlane('kCastleFlag_' + Math.random(), {
            width: 1.2 * scale,
            height: 0.62 * scale
        }, scene);
        flag.parent = kingCastleGroup;
        flag.position = new BABYLON.Vector3(x + 0.62 * scale, y + 0.58 * scale, z);
        flag.rotation.y = Math.PI / 2;
        flag.material = flagMat;
    };

    addFlag(0, 9.6, -2.4, 1.2);
    addFlag(-7.2, 7.3, -4.6, 0.85);
    addFlag(7.2, 7.3, -4.6, 0.85);
    addFlag(-7.2, 7.3, 4.7, 0.85);
    addFlag(7.2, 7.3, 4.7, 0.85);

    return kingCastleGroup;
}

// Function to create elf camp
function createCamp(centerX, centerZ) {
    campGroup = new BABYLON.TransformNode('campGroup_' + Math.random(), scene);
    campGroup.position = new BABYLON.Vector3(centerX, 0, centerZ);
    
    const woodMat = new BABYLON.StandardMaterial('campWood_' + Math.random(), scene);
    woodMat.diffuse = new BABYLON.Color3(0.6, 0.4, 0.2);
    woodMat.emissiveColor = new BABYLON.Color3(0.2, 0.1, 0.05);
    
    const roofMat = new BABYLON.StandardMaterial('campRoof_' + Math.random(), scene);
    roofMat.diffuse = new BABYLON.Color3(0.8, 0.7, 0.3); // Golden thatch
    roofMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.1);
    
    // Create 3 camp huts positioned in a circle (where elves were)
    const hutDistance = 20; // Position huts at guard distance
    const huts = [
        { angle: 0 },
        { angle: Math.PI * 2 / 3 },
        { angle: Math.PI * 4 / 3 }
    ];
    
    huts.forEach(hut => {
        let hutX = Math.cos(hut.angle) * hutDistance;
        let hutZ = Math.sin(hut.angle) * hutDistance;
        let guard = 0;
        while (isInRiver(centerX + hutX, centerZ + hutZ, 2.5) && guard < 18) {
            hutX += Math.cos(hut.angle) * 1.8;
            hutZ += Math.sin(hut.angle) * 1.8;
            guard++;
        }
        
        // Main hut base
        const base = BABYLON.MeshBuilder.CreateBox('hutBase_' + Math.random(), { width: 2, height: 2, depth: 2 }, scene);
        base.position = new BABYLON.Vector3(hutX, 1.5, hutZ);
        base.material = woodMat;
        base.parent = campGroup;
        base.checkCollisions = true;

        // Track world position for elf avoidance (relative to camp center)
        hutColliders.push({ x: centerX + hutX, z: centerZ + hutZ, radius: 2.2 });
        
        // Roof (tapered cylinder to look like a cone)
        const roof = BABYLON.MeshBuilder.CreateCylinder('roof_' + Math.random(), { height: 2, diameterTop: 0.5, diameterBottom: 3 }, scene);
        roof.position = new BABYLON.Vector3(hutX, 2.8, hutZ);
        roof.material = roofMat;
        roof.parent = campGroup;
        
        // Door
        const door = BABYLON.MeshBuilder.CreateBox('door_' + Math.random(), { width: 0.8, height: 1.5, depth: 0.2 }, scene);
        door.position = new BABYLON.Vector3(hutX, 1.2, hutZ + 1.1);
        door.material = woodMat;
        door.parent = campGroup;
    });

    createKingCastleNearRiver(centerX, centerZ);
    
    return campGroup;
}

// ===== ELDER'S HOUSE =====
function createElderHouse() {
    const x = HOUSE_POS.x, z = HOUSE_POS.z;

    const stoneMat = new BABYLON.StandardMaterial('eStoneMat', scene);
    stoneMat.diffuseColor = new BABYLON.Color3(0.50, 0.46, 0.40);
    stoneMat.emissiveColor = new BABYLON.Color3(0.06, 0.05, 0.04);

    const roofMat = new BABYLON.StandardMaterial('eRoofMat', scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.07);
    roofMat.emissiveColor = new BABYLON.Color3(0.06, 0.03, 0.01);

    const doorMat = new BABYLON.StandardMaterial('eDoorMat', scene);
    doorMat.diffuseColor = new BABYLON.Color3(0.12, 0.06, 0.02);
    doorMat.emissiveColor = new BABYLON.Color3(0.04, 0.02, 0.005);

    const winMat = new BABYLON.StandardMaterial('eWinMat', scene);
    winMat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.40);
    winMat.emissiveColor = new BABYLON.Color3(0.55, 0.35, 0.10);

    const signMat = new BABYLON.StandardMaterial('eSignMat', scene);
    signMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.12);
    signMat.emissiveColor = new BABYLON.Color3(0.14, 0.08, 0.03);

    // Main walls
    const walls = BABYLON.MeshBuilder.CreateBox('eWalls', { width: 7, height: 4.5, depth: 9 }, scene);
    walls.position = new BABYLON.Vector3(x, 2.25, z);
    walls.material = stoneMat;
    walls.checkCollisions = true;

    // Pyramid roof
    const roof = BABYLON.MeshBuilder.CreateCylinder('eRoof', { height: 3.5, diameterTop: 0, diameterBottom: 10.0, tessellation: 4 }, scene);
    roof.position = new BABYLON.Vector3(x, 6.25, z);
    roof.rotation.y = Math.PI / 4;
    roof.material = roofMat;

    // Door (dark opening)
    const door = BABYLON.MeshBuilder.CreateBox('eDoor', { width: 1.6, height: 2.8, depth: 0.5 }, scene);
    door.position = new BABYLON.Vector3(x, 1.4, z + 4.75);
    door.material = doorMat;

    // Glowing windows
    [-2, 2].forEach(wx => {
        const win = BABYLON.MeshBuilder.CreateBox('eWin', { width: 1.0, height: 1.0, depth: 0.2 }, scene);
        win.position = new BABYLON.Vector3(x + wx, 2.8, z + 4.6);
        win.material = winMat;
    });

    // Sign post
    const post = BABYLON.MeshBuilder.CreateBox('ePost', { width: 0.15, height: 2.8, depth: 0.15 }, scene);
    post.position = new BABYLON.Vector3(x + 3.2, 1.4, z + 5.3);
    post.material = signMat;
    const sign = BABYLON.MeshBuilder.CreateBox('eSign', { width: 1.5, height: 0.65, depth: 0.16 }, scene);
    sign.position = new BABYLON.Vector3(x + 3.2, 2.95, z + 5.3);
    sign.material = signMat;
}

// ===== HOUSE INTERIOR =====
function createHouseInterior() {
    const cx = 0, cz = 600;
    const W = 16, H = 5, D = 12;

    const stoneMat = new BABYLON.StandardMaterial('intStone', scene);
    stoneMat.diffuseColor = new BABYLON.Color3(0.38, 0.32, 0.26);
    stoneMat.emissiveColor = new BABYLON.Color3(0.05, 0.04, 0.03);

    const floorMat = new BABYLON.StandardMaterial('intFloor', scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.30, 0.24, 0.14);
    floorMat.emissiveColor = new BABYLON.Color3(0.04, 0.03, 0.01);

    const ceilMat = new BABYLON.StandardMaterial('intCeil', scene);
    ceilMat.diffuseColor = new BABYLON.Color3(0.22, 0.17, 0.11);
    ceilMat.emissiveColor = new BABYLON.Color3(0.03, 0.02, 0.01);

    const fireStoneMat = new BABYLON.StandardMaterial('intFS', scene);
    fireStoneMat.diffuseColor = new BABYLON.Color3(0.34, 0.28, 0.22);
    fireStoneMat.emissiveColor = new BABYLON.Color3(0.06, 0.04, 0.02);

    const flameMat = new BABYLON.StandardMaterial('intFlame', scene);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.55, 0.10);
    flameMat.emissiveColor = new BABYLON.Color3(0.80, 0.30, 0.05);

    const rugMat = new BABYLON.StandardMaterial('intRug', scene);
    rugMat.diffuseColor = new BABYLON.Color3(0.48, 0.10, 0.10);
    rugMat.emissiveColor = new BABYLON.Color3(0.10, 0.02, 0.02);

    const exitMat = new BABYLON.StandardMaterial('intExit', scene);
    exitMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.2);
    exitMat.emissiveColor = new BABYLON.Color3(0.5, 0.4, 0.05);

    // Floor & ceiling
    const floor = BABYLON.MeshBuilder.CreateBox('intF', { width: W, height: 0.5, depth: D }, scene);
    floor.position = new BABYLON.Vector3(cx, -0.25, cz);
    floor.material = floorMat;
    const ceil = BABYLON.MeshBuilder.CreateBox('intC', { width: W, height: 0.5, depth: D }, scene);
    ceil.position = new BABYLON.Vector3(cx, H + 0.25, cz);
    ceil.material = ceilMat;

    // Walls
    const wallL = BABYLON.MeshBuilder.CreateBox('intWL', { width: 0.5, height: H, depth: D }, scene);
    wallL.position = new BABYLON.Vector3(cx - W / 2, H / 2, cz);
    wallL.material = stoneMat;
    const wallR = BABYLON.MeshBuilder.CreateBox('intWR', { width: 0.5, height: H, depth: D }, scene);
    wallR.position = new BABYLON.Vector3(cx + W / 2, H / 2, cz);
    wallR.material = stoneMat;
    const wallBack = BABYLON.MeshBuilder.CreateBox('intWBack', { width: W, height: H, depth: 0.5 }, scene);
    wallBack.position = new BABYLON.Vector3(cx, H / 2, cz - D / 2);
    wallBack.material = stoneMat;
    const wallFront = BABYLON.MeshBuilder.CreateBox('intWFront', { width: W, height: H, depth: 0.5 }, scene);
    wallFront.position = new BABYLON.Vector3(cx, H / 2, cz + D / 2);
    wallFront.material = stoneMat;

    // Fireplace
    const fpBase = BABYLON.MeshBuilder.CreateBox('intFpB', { width: 3.5, height: 0.5, depth: 1.2 }, scene);
    fpBase.position = new BABYLON.Vector3(cx, 0.25, cz - D / 2 + 1.0);
    fpBase.material = fireStoneMat;
    const fpBack2 = BABYLON.MeshBuilder.CreateBox('intFpBk', { width: 3.5, height: 3.0, depth: 0.5 }, scene);
    fpBack2.position = new BABYLON.Vector3(cx, 1.5, cz - D / 2 + 1.3);
    fpBack2.material = fireStoneMat;
    const fpL = BABYLON.MeshBuilder.CreateBox('intFpL', { width: 0.5, height: 3.0, depth: 1.2 }, scene);
    fpL.position = new BABYLON.Vector3(cx - 2.0, 1.5, cz - D / 2 + 1.0);
    fpL.material = fireStoneMat;
    const fpR = BABYLON.MeshBuilder.CreateBox('intFpR', { width: 0.5, height: 3.0, depth: 1.2 }, scene);
    fpR.position = new BABYLON.Vector3(cx + 2.0, 1.5, cz - D / 2 + 1.0);
    fpR.material = fireStoneMat;
    const fpMantle = BABYLON.MeshBuilder.CreateBox('intFpM', { width: 4.2, height: 0.4, depth: 1.4 }, scene);
    fpMantle.position = new BABYLON.Vector3(cx, 3.2, cz - D / 2 + 1.0);
    fpMantle.material = fireStoneMat;
    const flame = BABYLON.MeshBuilder.CreateBox('intFlm', { width: 2.0, height: 1.4, depth: 0.5 }, scene);
    flame.position = new BABYLON.Vector3(cx, 1.2, cz - D / 2 + 1.1);
    flame.material = flameMat;

    // Fire light
    const fireLight = new BABYLON.PointLight('intFireLight', new BABYLON.Vector3(cx, 1.8, cz - D / 2 + 2.5), scene);
    fireLight.diffuse = new BABYLON.Color3(1.0, 0.55, 0.10);
    fireLight.intensity = 1.4;
    fireLight.range = 24;

    // Rug
    const rug = BABYLON.MeshBuilder.CreateBox('intRug', { width: 8, height: 0.06, depth: 5 }, scene);
    rug.position = new BABYLON.Vector3(cx, 0.03, cz);
    rug.material = rugMat;

    // Exit marker — glowing slab near front wall
    const exitMarker = BABYLON.MeshBuilder.CreateBox('intExit', { width: 2.4, height: 0.12, depth: 0.8 }, scene);
    exitMarker.position = new BABYLON.Vector3(cx, 0.06, cz + D / 2 - 1.2);
    exitMarker.material = exitMat;

    // Old elf NPC
    createOldElfNPC(cx, cz - D / 2 + 2.8);
}

// ===== OLD ELF NPC =====
function createOldElfNPC(x, z) {
    const g = new BABYLON.TransformNode('oldElfGroup', scene);
    g.position = new BABYLON.Vector3(x, 1, z);
    g.rotation.y = 0; // faces +Z (toward entrance)

    const mk = (name, col, emi) => {
        const m = new BABYLON.StandardMaterial(name, scene);
        m.diffuseColor  = new BABYLON.Color3(...col);
        m.emissiveColor = new BABYLON.Color3(...emi);
        return m;
    };
    const whiteMat   = mk('oeW',  [0.90,0.88,0.84], [0.22,0.20,0.18]);
    const skinMat    = mk('oeS',  [0.86,0.62,0.38], [0.26,0.16,0.06]);
    const robeMat    = mk('oeR',  [0.16,0.08,0.28], [0.05,0.02,0.09]);
    const accentMat  = mk('oeA',  [0.60,0.48,0.08], [0.20,0.14,0.02]);
    const blackMat   = mk('oeB',  [0.04,0.04,0.04], [0.01,0.01,0.01]);
    const staffMat   = mk('oeSt', [0.42,0.26,0.10], [0.12,0.07,0.02]);
    const gemMat     = mk('oeG',  [0.25,0.75,0.55], [0.10,0.50,0.30]);

    const add = (name, opts, pos, mat, rotZ) => {
        const mesh = BABYLON.MeshBuilder.CreateBox(name, opts, scene);
        mesh.position = new BABYLON.Vector3(...pos);
        mesh.material = mat;
        mesh.parent = g;
        if (rotZ) mesh.rotation.z = rotZ;
        return mesh;
    };
    const cone = (name, pos, mat, rotZ) => {
        const mesh = BABYLON.MeshBuilder.CreateCylinder(name, { height: 0.22, diameterTop: 0, diameterBottom: 0.11, tessellation: 6 }, scene);
        mesh.position = new BABYLON.Vector3(...pos);
        mesh.rotation.z = rotZ;
        mesh.material = mat;
        mesh.parent = g;
        return mesh;
    };

    add('oeHairTop',  { width:0.52,height:0.13,depth:0.46 }, [0,1.54,0],    whiteMat);
    add('oeHairBack', { width:0.46,height:0.32,depth:0.14 }, [0,1.34,-0.26],whiteMat);
    add('oeHead',     { width:0.50,height:0.44,depth:0.44 }, [0,1.30,0],    skinMat);
    add('oeEarLB',    { width:0.10,height:0.16,depth:0.13 }, [-0.30,1.24,0],skinMat);
    cone('oeEarLT', [-0.32,1.38,0], skinMat,  Math.PI/9);
    add('oeEarRB',    { width:0.10,height:0.16,depth:0.13 }, [0.30,1.24,0], skinMat);
    cone('oeEarRT', [0.32,1.38,0],  skinMat, -Math.PI/9);
    add('oeEyeL',     { width:0.12,height:0.12,depth:0.05 }, [-0.12,1.30,0.23],blackMat);
    add('oeEyeR',     { width:0.12,height:0.12,depth:0.05 }, [0.12,1.30,0.23], blackMat);
    add('oeBeard',    { width:0.30,height:0.28,depth:0.10 }, [0,1.07,0.22], whiteMat);
    add('oeRobeTop',  { width:0.60,height:0.55,depth:0.50 }, [0,0.84,0],    robeMat);
    add('oeStripe',   { width:0.20,height:0.55,depth:0.09 }, [0,0.84,0.26], accentMat);
    add('oeRobeMid',  { width:0.68,height:0.58,depth:0.54 }, [0,0.29,0],    robeMat);
    add('oeRobeBase', { width:0.74,height:0.18,depth:0.58 }, [0,0.0,0],     robeMat);
    add('oeArmL',     { width:0.18,height:0.44,depth:0.22 }, [-0.44,0.78,0],robeMat);
    add('oeArmR',     { width:0.18,height:0.44,depth:0.22 }, [0.44,0.78,0], robeMat);
    add('oeHandL',    { width:0.15,height:0.16,depth:0.16 }, [-0.44,0.50,0.06],skinMat);
    add('oeHandR',    { width:0.15,height:0.16,depth:0.16 }, [0.44,0.50,0.06], skinMat);
    add('oeStaffH',   { width:0.08,height:1.44,depth:0.08 }, [0.44,1.16,0.08], staffMat);
    add('oeStaffOrb', { width:0.22,height:0.22,depth:0.22 }, [0.44,1.96,0.08], gemMat);
    return g;
}

// ===== ENTER / EXIT HOUSE =====
function enterHouse() {
    playerExteriorPos = camera.position.clone();
    playerExteriorRot = { x: cameraRotation.x, y: cameraRotation.y };
    camera.position = new BABYLON.Vector3(0, 2, 604);
    cameraRotation.x = 0;
    cameraRotation.y = Math.PI; // face inward toward fireplace
    player.currentY = 2;
    playerInsideHouse = true;
    document.getElementById('interact-prompt').style.display = 'none';
}

function exitHouse() {
    // Place player safely outside the front of the house (z + 7 clears the eWalls box boundary
    // at HOUSE_POS.z + 4.5), avoiding the invisible-wall bug from restoring a position that was
    // saved inside the solid house mesh.
    camera.position = new BABYLON.Vector3(HOUSE_POS.x, 2, HOUSE_POS.z + 7);
    cameraRotation.x = 0;
    cameraRotation.y = 0; // face away from the house (toward the open field)
    player.currentY = 2;
    player.isJumping = false;
    player.velocityY = 0;
    playerInsideHouse = false;
    closeMissionUI();
}

// ===== MISSION UI =====
let missionScrollSetupDone = false;

function setupMissionUIScrolling() {
    if (missionScrollSetupDone) return;

    const missionUiEl = document.getElementById('mission-ui');
    const dialogEl = document.getElementById('mission-dialog');
    const listEl = document.getElementById('mission-list');
    const scrollUpBtn = document.getElementById('mission-scroll-up');
    const scrollDownBtn = document.getElementById('mission-scroll-down');
    if (!missionUiEl || !dialogEl || !listEl) return;

    const forwardWheelToScroll = (target) => (e) => {
        target.scrollTop += e.deltaY;
        e.preventDefault();
        e.stopPropagation();
    };

    dialogEl.addEventListener('wheel', forwardWheelToScroll(listEl), { passive: false });
    listEl.addEventListener('wheel', forwardWheelToScroll(listEl), { passive: false });
    missionUiEl.addEventListener('wheel', forwardWheelToScroll(listEl), { passive: false });

    let lastTouchY = 0;
    const onTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        lastTouchY = e.touches[0].clientY;
        e.stopPropagation();
    };

    const onTouchMove = (target) => (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const currentY = e.touches[0].clientY;
        const deltaY = lastTouchY - currentY;
        target.scrollTop += deltaY;
        lastTouchY = currentY;
        e.preventDefault();
        e.stopPropagation();
    };

    dialogEl.addEventListener('touchstart', onTouchStart, { passive: true });
    listEl.addEventListener('touchstart', onTouchStart, { passive: true });
    missionUiEl.addEventListener('touchstart', onTouchStart, { passive: true });
    dialogEl.addEventListener('touchmove', onTouchMove(listEl), { passive: false });
    listEl.addEventListener('touchmove', onTouchMove(listEl), { passive: false });
    missionUiEl.addEventListener('touchmove', onTouchMove(listEl), { passive: false });

    window.addEventListener('keydown', (e) => {
        if (!missionUIOpen) return;

        const keyStep = 70;
        const pageStep = Math.max(180, Math.floor(listEl.clientHeight * 0.85));
        if (e.key === 'ArrowDown') {
            listEl.scrollBy({ top: keyStep, behavior: 'smooth' });
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            listEl.scrollBy({ top: -keyStep, behavior: 'smooth' });
            e.preventDefault();
        } else if (e.key === 'PageDown') {
            listEl.scrollBy({ top: pageStep, behavior: 'smooth' });
            e.preventDefault();
        } else if (e.key === 'PageUp') {
            listEl.scrollBy({ top: -pageStep, behavior: 'smooth' });
            e.preventDefault();
        }
    });

    const BUTTON_SCROLL_STEP = 140;
    if (scrollUpBtn) {
        scrollUpBtn.addEventListener('click', () => {
            listEl.scrollBy({ top: -BUTTON_SCROLL_STEP, behavior: 'smooth' });
        });
    }
    if (scrollDownBtn) {
        scrollDownBtn.addEventListener('click', () => {
            listEl.scrollBy({ top: BUTTON_SCROLL_STEP, behavior: 'smooth' });
        });
    }

    missionScrollSetupDone = true;
}

function openMissionUI() {
    setupMissionUIScrolling();
    missionUIOpen = true;
    clearGameplayInput();
    const dialogueEl = document.getElementById('mission-dialogue-text');
    const listEl     = document.getElementById('mission-list');

    if (activeMission) {
        dialogueEl.textContent = `You are on a mission: "${activeMission.name}". Fight on, brave warrior! Return when your task is done.`;
    } else if (completedMissions.size === MISSIONS.length) {
        dialogueEl.textContent = 'You have proven yourself beyond measure. The forest owes you a great debt. Rest now, hero.';
    } else {
        dialogueEl.textContent = 'Greetings, brave soul. The undead plague our lands. Choose a mission and drive them back. May the forest guide your blade.';
    }

    listEl.innerHTML = '';
    MISSIONS.forEach(m => {
        const isCompleted = completedMissions.has(m.id);
        const isActive    = activeMission && activeMission.id === m.id;
        const isLocked    = m.id > 1 && !completedMissions.has(m.id - 1);
        const isAvailable = !isLocked && !isCompleted && !activeMission;

        let cls = 'locked', bCls = 'badge-locked', bTxt = '🔒 Locked';
        if (isCompleted)  { cls = 'completed'; bCls = 'badge-completed'; bTxt = '✓ Completed'; }
        else if (isActive){ cls = 'active';    bCls = 'badge-active';    bTxt = `⚔ ${missionKills} / ${m.killGoal}`; }
        else if (isAvailable){ cls = 'available'; bCls = 'badge-available'; bTxt = '▶ Accept'; }

        const card = document.createElement('div');
        card.className = `mission-card ${cls}`;
        card.innerHTML = `<div class="mission-card-body"><div class="mission-card-name">${m.name}</div><div class="mission-card-desc">${m.desc}</div></div><div class="mission-card-badge ${bCls}">${bTxt}</div>`;
        if (isAvailable) card.onclick = () => selectMission(m.id);
        listEl.appendChild(card);
    });

    document.getElementById('mission-ui').style.display = 'flex';
    document.getElementById('mission-dialog').scrollTop = 0;
    listEl.scrollTop = 0;
    document.body.classList.add('mission-ui-open');
    camera.detachControl(canvas);
}

function closeMissionUI() {
    missionUIOpen = false;
    document.getElementById('mission-ui').style.display = 'none';
    document.body.classList.remove('mission-ui-open');
    camera.attachControl(canvas, true);
}

function selectMission(id) {
    activeMission = MISSIONS.find(m => m.id === id);
    missionKills = 0;
    closeMissionUI();
    updateMissionHUD();
    document.getElementById('mission-status').style.display = 'block';
    
    // Give player a sword when accepting a mission
    if (!player.hasSword) {
        createPlayerSword();
    }
    // Mission 3: zombie soldier leads the horde; soldier elf captain arrives shortly after
    if (id === 3 && !zombieSoldier) {
        setTimeout(() => createZombieSoldier(), 3000);
        setTimeout(() => createSoldierElf(), 9000);
    }
    // Mission 4: the Necromancer himself arrives
    if (id === 4 && !necromancer) {
        setTimeout(() => createNecromancer(), 3000);
    }
    // Mission 5: Fire Dragons of the Inferanoth
    if (id === 5) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => createFireDragonEnemy(), 2000 + i * 4000);
        }
        const prompt = document.getElementById('interact-prompt');
        prompt.textContent = '\uD83D\uDD25 The Inferanoth descend!';
        prompt.style.color = '#f84';
        prompt.style.borderColor = '#f84';
        prompt.style.display = 'block';
        setTimeout(() => { prompt.style.display = 'none'; prompt.style.color = ''; prompt.style.borderColor = ''; }, 4000);
    }
    // Mission 6: Wind Dragons of the Veltharyn
    if (id === 6) {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => createWindDragonEnemy(), 1500 + i * 3000);
        }
        const prompt = document.getElementById('interact-prompt');
        prompt.textContent = '\uD83C\uDF2C\uFE0F The Veltharyn descend!';
        prompt.style.color = '#aef';
        prompt.style.borderColor = '#aef';
        prompt.style.display = 'block';
        setTimeout(() => { prompt.style.display = 'none'; prompt.style.color = ''; prompt.style.borderColor = ''; }, 4000);
    }
}

function updateMissionHUD() {
    if (!activeMission) return;
    document.getElementById('mission-status-name').textContent = '⚔ ' + activeMission.name;
    document.getElementById('mission-status-progress').textContent = missionKills + ' / ' + activeMission.killGoal + ' kills';
}

// ===== MAGIC DIALOGUE (Thornwood explains magic after mission 1) =====
const thornwoodMagicLines = [
    "You have proven yourself in battle, young one. But steel alone will not hold back the darkness that is coming. Sit. There are things you must understand before the storm breaks.",
    "In the age before memory, the world was shaped by five great forces — each bound to a people, each carrying a name that echoed through time. The first, and most terrible, is the Dark Necromancer, Malachar the Undying. He does not kill — he collects. Every warrior who falls to his horde rises again to serve him. He has consumed kingdoms. He hungers for this forest.",
    "But there is older power than death. The Water Elves — the Aqualhari — have dwelt in the deep rivers since the world was young. They are not like us. They do not fight with swords. They reshape the river's will into a blade and send it flying like a crescent of living current. It was they who taught my order the first words of magic. Their gift flows in this very stream beside us.",
    "Then there are the Fire Dragons — the Inferanoth. Ancient beyond reckoning, they sleep beneath the southern volcanoes. When war calls them from their slumber, the sky turns red. A single breath can level a fortress wall. They are not evil — but they are not kind. They remember debts, and they collect them in flame.",
    "The Wind Dragons are different. The Veltharyn ride the high storms between mountain peaks. They are swift where the Inferanoth are fierce — they speak in riddles and they strike before you hear them coming. Legends say they once carried messages between gods. Now they circle the dying world, watching to see who will be left standing.",
    "And last — the Humans of Legend. Not ordinary men and women, but those few in every generation who were touched by all four forces at once. Warriors who carried flame in one hand and storm in the other. Scholars who could still a river with a word. They are gone now — scattered or dead. But their bloodlines... are not entirely cold. Some say that is why Malachar wants this land so badly. He knows what could be born here.",
    "You stand at the crossroads of all of this. I do not say that to flatter you. I say it because you need to understand what we face — and what you might become.",
    "For now, I can give you the first lesson of the Aqualhari. The Water Slash. Hold [ F ] to charge it and release — a crescent of water will fly forward and strike for two wounds. The magic needs five full seconds to recover between uses. Guard that cooldown well. Now go — the horde will not wait."
];
let magicDialoguePage = 0;
let magicDialogueOpen = false;
let magicWaterDemoShown = false;
let magicDemoTimer = null;

function speakMagicLine(text) {
    if (!magicDialogueOpen) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

    const cleanText = text.replace(/\[/g, '').replace(/\]/g, '');
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    utterance.pitch = 0.90;
    utterance.volume = 1.0;

    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => /en/i.test(v.lang) && /david|mark|james|guy|male/i.test(v.name))
        || voices.find(v => /en/i.test(v.lang));
    if (preferredVoice) utterance.voice = preferredVoice;

    synth.speak(utterance);
}

function openMagicDialogue() {
    magicDialoguePage = 0;
    magicDialogueOpen = true;
    magicWaterDemoShown = false;
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    const overlay = document.getElementById('magic-dialogue');
    overlay.style.display = 'flex';
    showMagicPage();
    document.getElementById('magic-dialogue-btn').onclick = advanceMagicDialogue;
}

function showMagicPage() {
    document.getElementById('magic-dialogue-text').textContent = thornwoodMagicLines[magicDialoguePage];
    const btn = document.getElementById('magic-dialogue-btn');
    btn.textContent = magicDialoguePage < thornwoodMagicLines.length - 1 ? '[ Continue ]' : '[ I understand ]';
    speakMagicLine(thornwoodMagicLines[magicDialoguePage]);

    // Show combo demo in cutscene: sword slash first, then Water Slash.
    if (magicDialoguePage === thornwoodMagicLines.length - 1 && !magicWaterDemoShown) {
        playCutsceneSwordDemo();
        magicDemoTimer = setTimeout(() => {
            if (magicDialogueOpen) playCutsceneWaterSlashDemo();
            magicDemoTimer = null;
        }, 700);
        magicWaterDemoShown = true;
    }
}

function advanceMagicDialogue() {
    magicDialoguePage++;
    if (magicDialoguePage >= thornwoodMagicLines.length) {
        closeMagicDialogue();
        awardWaterSlash();
    } else {
        showMagicPage();
    }
}

function closeMagicDialogue() {
    magicDialogueOpen = false;
    if (magicDemoTimer) {
        clearTimeout(magicDemoTimer);
        magicDemoTimer = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('magic-dialogue').style.display = 'none';
}

function playCutsceneSwordDemo() {
    const root = (player.sword && player.hasSword) ? player.sword.swordRoot : null;
    const startRotX = root ? root.rotation.x : 0;
    const swingDuration = 280;
    const startTime = Date.now();

    const trailMat = new BABYLON.StandardMaterial('cutsceneSlashTrail_' + Date.now(), scene);
    trailMat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.0);
    trailMat.emissiveColor = new BABYLON.Color3(1.0, 0.75, 0.0);
    trailMat.alpha = 0.78;
    trailMat.backFaceCulling = false;

    const trailPieces = [];
    const numPieces = 7;
    for (let i = 0; i < numPieces; i++) {
        const t = i / (numPieces - 1);
        const sz = 0.05 + t * 0.09;
        const p = BABYLON.MeshBuilder.CreateBox('cutsceneTrail_' + i + '_' + Date.now(),
            { width: sz * 2.5, height: sz, depth: 0.01 }, scene);
        p.parent = camera;
        const arcAngle = 0.8 - t * 1.8;
        const arcR = 0.45;
        p.position = new BABYLON.Vector3(
            0.30 + Math.cos(arcAngle) * arcR,
            -0.16,
            1.01
        );
        p.rotation.z = arcAngle;
        p.material = trailMat;
        p.isPickable = false;
        trailPieces.push(p);
    }

    const trailBorn = Date.now();
    const fadeTrail = () => {
        const alpha = Math.max(0, 0.78 * (1 - (Date.now() - trailBorn) / 240));
        trailMat.alpha = alpha;
        if (alpha > 0) {
            requestAnimationFrame(fadeTrail);
        } else {
            trailPieces.forEach(p => p.dispose());
            trailMat.dispose();
        }
    };
    requestAnimationFrame(fadeTrail);

    const animateSwing = () => {
        if (!root) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / swingDuration, 1);
        root.rotation.y = 0.65 - progress * 1.65;
        root.rotation.x = startRotX - Math.sin(progress * Math.PI) * 0.16;
        if (progress < 1) {
            requestAnimationFrame(animateSwing);
        } else {
            root.rotation.y = 0.65;
            root.rotation.x = startRotX;
        }
    };
    if (root) requestAnimationFrame(animateSwing);
}

function awardWaterSlash() {
    player.hasWaterSlash = true;
    document.getElementById('waterslash-hud').style.display = 'block';
    // Flash award message
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '💧 Learned: Water Slash! (Press Q)';
    prompt.style.color = '#4af';
    prompt.style.borderColor = '#4af';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 4000);
}

// ===== WATER SLASH PROJECTILE =====
const waterSlashProjectiles = [];
const WATER_SLASH_TEXTURE_PATH = 'assets/Copilot_20260531_181340.png';
const WATER_SPRITE_COLS = 7;
const WATER_SPRITE_ROWS = 9;
const WATER_FRAME_DUR = 150;

function spawnWaterSlashProjectile(startPos, forward, speed, canHit = true) {
    const now = Date.now();

    const plane = BABYLON.MeshBuilder.CreatePlane('wsPlane_' + now, { width: 3.2, height: 1.5 }, scene);
    plane.position = startPos.clone();
    plane.position.y -= 0.25;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const mat = new BABYLON.StandardMaterial('wsSpriteMat_' + now, scene);
    const tex = new BABYLON.Texture(WATER_SLASH_TEXTURE_PATH, scene, false, true);
    tex.hasAlpha = true;
    tex.uScale = 1 / WATER_SPRITE_COLS;
    tex.vScale = 1 / WATER_SPRITE_ROWS;
    tex.uOffset = 0;
    tex.vOffset = (WATER_SPRITE_ROWS - 1) / WATER_SPRITE_ROWS;

    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    mat.alpha = 1.0;
    mat.backFaceCulling = false;
    plane.material = mat;

    waterSlashProjectiles.push({
        plane,
        mat,
        tex,
        vel: forward.scale(speed),
        born: now,
        hit: false,
        frame: 0,
        canHit
    });
}

function fireWaterSlash() {
    if (!player.hasWaterSlash) return;
    const now = Date.now();
    if (now - player.lastWaterSlash < player.waterSlashCooldown) return;
    player.lastWaterSlash = now;

    const forward = new BABYLON.Vector3(
        Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x),
        -Math.sin(cameraRotation.x),
        Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x)
    );

    spawnWaterSlashProjectile(camera.position, forward, 0.55, true);
}

function playCutsceneWaterSlashDemo() {
    const forward = new BABYLON.Vector3(
        Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x),
        -Math.sin(cameraRotation.x),
        Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x)
    );
    const origin = camera.position.add(forward.scale(1.2));
    spawnWaterSlashProjectile(origin, forward, 0.42, false);
}

// ===== WIND DIALOGUE (after mission 2 — elves realise the player is human) =====
const windDialogueLines = [
    "Elder Thornwood stands at the fireplace, his staff-orb flickering violet and white. He does not greet you. He stares. 'You should not have been able to do what you did out there. Not a second time. Not with wind.'",
    "'Two days ago I watched you wield the Aqualhari's Water Slash. An art that takes an elf apprentice three years to master. You handled it in hours.' He turns slowly. 'And just now — as you fought — I saw the air bend around your blade. The Wind Dragons are not subtle. They were watching you through the storm. They chose you.'",
    "The door opens without a knock. The Elf King steps inside, crown bright, eyes locked on you. He is silent for a long moment. Then: 'Take off your gauntlet. Left hand.'",
    "He studies your palm. Then he exhales — slow, like a man who has been holding his breath for years. 'Thornwood. Look at the wrist. There is no elf-mark. No forest-bond. This person has never had magic. Yet the water answered them. Now the wind. Do you understand what that means?'",
    "Thornwood's voice drops to almost nothing. 'A Human of Legend. The bloodline we thought died with the old wars. A human who resonates with every force — not bound to one, the way elves are bound to water, the way dragons are bound to fire and storm. A bridge across all five.' He looks at you differently now. Shaken. 'We thought Malachar wiped out the last of you centuries ago.'",
    "The King speaks again, harder. 'He did not. Which is exactly why the horde is not slowing down. Malachar does not want this forest. He wants you dead — or worse, turned. A Human of Legend in his army would make him unstoppable. Every force in the world bending to a Necromancer's will.'",
    "'But that also means,' Thornwood says, gripping his staff tighter, 'that every force in the world has a reason to stand with you. The Water Elves already gave you their gift. The Veltharyn — the Wind Dragons — they are giving you theirs right now. If you survive long enough...' He glances at the King. '...the Fire Dragons may come. And perhaps even the old Human fortresses will remember what they were built for.'",
    "He raises his staff. The orb blazes white. A cold gust swirls through the room — papers scatter, the fire dips, your hair lifts. 'The Wind Slash. Press Q to fire a fan of three wind blades — wide spread, one strike each. Three seconds to recover. Go. And do not die. You are the only one of your kind left.'"
];
let windDialoguePage = 0;
let windDialogueOpen = false;

function openWindDialogue() {
    windDialoguePage = 0;
    windDialogueOpen = true;
    // Teleport the player inside the house for the cutscene
    if (!playerInsideHouse) {
        enterHouse();
    }
    const overlay = document.getElementById('wind-dialogue');
    overlay.style.display = 'block';
    showWindPage();
    document.getElementById('wind-dialogue-btn').onclick = advanceWindDialogue;
    spawnNpcWindDragon();
}

function showWindPage() {
    document.getElementById('wind-dialogue-text').textContent = windDialogueLines[windDialoguePage];
    const btn = document.getElementById('wind-dialogue-btn');
    btn.textContent = windDialoguePage < windDialogueLines.length - 1 ? '[ Continue ]' : '[ I understand ]';
    // Update speaker name per page
    const speakers = ['Elder Thornwood', 'Elder Thornwood', 'The Elf King', 'The Elf King', 'Elder Thornwood', 'The Elf King', 'Elder Thornwood', 'Elder Thornwood'];
    const speakerEl = document.getElementById('wind-cutscene-speaker');
    if (speakerEl) speakerEl.textContent = speakers[windDialoguePage] || 'Elder Thornwood';
}

function advanceWindDialogue() {
    windDialoguePage++;
    if (windDialoguePage >= windDialogueLines.length) {
        closeWindDialogue();
        awardWindSlash();
    } else {
        showWindPage();
    }
}

function closeWindDialogue() {
    windDialogueOpen = false;
    document.getElementById('wind-dialogue').style.display = 'none';
    disposeNpcWindDragon();
}

function awardWindSlash() {
    player.hasWindSlash = true;
    document.getElementById('windslash-hud').style.display = 'block';
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '💨 Learned: Wind Slash! (Press Q)';
    prompt.style.color = '#aef';
    prompt.style.borderColor = '#aef';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 4000);
}

// ===== WIND SLASH PROJECTILE (sprite-sheet animated) =====
const windSlashProjectiles = [];
const WIND_SPRITE_COLS = 7;
const WIND_SPRITE_ROWS = 9;
const WIND_FRAME_DUR   = 160; // ms per frame — slightly faster than fire
const WIND_SLASH_TEXTURE_PATH = 'assets/Copilot_20260531_085637.png';

function fireWindSlash() {
    if (!player.hasWindSlash) return;
    const now = Date.now();
    if (now - player.lastWindSlash < player.windSlashCooldown) return;
    player.lastWindSlash = now;

    // Fire 2 blades in a fan: -13°, +13° offset from camera yaw
    const fanAngles = [-0.22, 0.22];
    fanAngles.forEach(yawOffset => {
        const yaw = cameraRotation.y + yawOffset;
        const forward = new BABYLON.Vector3(
            Math.sin(yaw) * Math.cos(cameraRotation.x),
            -Math.sin(cameraRotation.x),
            Math.cos(yaw) * Math.cos(cameraRotation.x)
        );

        const plane = BABYLON.MeshBuilder.CreatePlane('windPlane_' + now + '_' + yawOffset, { width: 3.6, height: 1.6 }, scene);
        plane.position = camera.position.clone();
        plane.position.y -= 0.28;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.isPickable = false;

        const mat = new BABYLON.StandardMaterial('windSpriteMat_' + now + '_' + yawOffset, scene);
        const tex = new BABYLON.Texture(WIND_SLASH_TEXTURE_PATH, scene, false, true);
        tex.uScale = 1 / WIND_SPRITE_COLS;
        tex.vScale = 1 / WIND_SPRITE_ROWS;
        tex.uOffset = 0;
        tex.vOffset = (WIND_SPRITE_ROWS - 1) / WIND_SPRITE_ROWS;
        tex.hasAlpha = true;

        mat.diffuseTexture = tex;
        mat.emissiveTexture = tex;
        mat.useAlphaFromDiffuseTexture = true;
        mat.disableLighting = true;
        mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
        mat.alpha = 1.0;
        mat.backFaceCulling = false;
        plane.material = mat;

        windSlashProjectiles.push({
            plane,
            mat,
            tex,
            vel: forward.scale(0.92),
            born: now,
            hit: false,
            frame: 0
        });
    });
}

function updateWindSlashProjectiles(dt) {
    const maxLife = 1600; // ms — faster projectile so shorter lifetime
    for (let i = windSlashProjectiles.length - 1; i >= 0; i--) {
        const proj = windSlashProjectiles[i];
        const age = Date.now() - proj.born;
        const lifeRatio = 1 - age / maxLife;

        if (proj.hit || lifeRatio <= 0) {
            proj.plane.dispose();
            proj.mat.dispose();
            windSlashProjectiles.splice(i, 1);
            continue;
        }

        // Move forward
        proj.plane.position.addInPlace(proj.vel);

        const frame = Math.min(WIND_SPRITE_COLS - 1, Math.floor(age / WIND_FRAME_DUR));
        if (frame !== proj.frame) {
            proj.frame = frame;
            proj.tex.uOffset = frame / WIND_SPRITE_COLS;
        }

        // Fade out
        const alpha = Math.min(1, lifeRatio * 2.5);
        proj.mat.alpha = alpha;

        // Hit detection — 1 damage (less than water's 2)
        zombies.forEach(zombie => {
            if (proj.hit || zombie.health <= 0) return;
            const dist = BABYLON.Vector3.Distance(proj.plane.position, zombie.group.position);
            if (dist < 1.5) {
                proj.hit = true;
                zombie.health -= 1;
                updateZombieHealthBar(zombie);
                createExplosion(zombie.group.position, 'white');
                if (zombie.isNecromancer) awardDarkEnergy();
                if (zombie.health <= 0) {
                    zombie.isDead = true;
                    onZombieKilled();
                }
            }
        });
    }

    // Update wind cooldown HUD
    if (player.hasWindSlash) {
        const elapsed = Date.now() - player.lastWindSlash;
        const cdEl = document.getElementById('windslash-cooldown-text');
        if (elapsed < player.windSlashCooldown) {
            cdEl.textContent = `(${((player.windSlashCooldown - elapsed) / 1000).toFixed(1)}s)`;
            cdEl.style.color = '#888';
        } else {
            cdEl.textContent = '(Ready)';
            cdEl.style.color = '#aef';
        }
    }
}


// ===== FIRE DIALOGUE (after zombie soldier dies \u2014 Fire Dragon gifts fire slash) =====
const fireDialogueLines = [
    "The ground shakes. The sky above cracks open \u2014 not with lightning, but with heat. An enormous shape descends through the smoke, scales like cooling magma, eyes like furnace-coals. A Fire Dragon. One of the Inferanoth. It is old beyond reckoning. It lands twenty metres away and the earth scorches black beneath its claws.",
    "It does not attack. It watches you. Then it speaks \u2014 not in any language, but directly into your skull, a voice like iron ore melting: 'We have watched three wars from our mountains. We came to none of them. This one... is different.'",
    "'The Necromancer has begun burning the southern passes \u2014 our nesting grounds. And yet we still would not have moved. Until we saw you.' A long silence. Smoke curls from its nostrils. 'We know what you are. Human of Legend. The old bridge. We felt the water answer you. We felt the wind answer you. There is only one reason both would do that.'",
    "'The last Human of Legend who walked this world stood between the Fire Dragons and extinction. She asked nothing in return. We gave her fire anyway.' Another silence. 'We are not sentimental creatures. But we remember debts.' It lowers its massive head until one eye \u2014 the size of a cart wheel \u2014 is level with yours.",
    "'Hold E \u2014 longer than a breath. Feel the heat climb your arm. Then release.' The air around your hands shimmers and your palms blaze orange for a moment. 'One fireball. Three wounds of damage. Four seconds before the flame recovers. Do not waste it.' It lifts its head, spreads its wings, and the downdraft nearly knocks you flat.",
    "'Malachar fears fire most of all. He is made of cold things \u2014 dead things. And dead things burn.' It launches skyward, punches through the cloud ceiling, and is gone. The smell of sulphur lingers for a long time."
];
let fireDialoguePage = 0;
let fireDialogueOpen = false;

function openFireDialogue() {
    fireDialoguePage = 0;
    fireDialogueOpen = true;
    const overlay = document.getElementById('fire-dialogue');
    overlay.style.display = 'flex';
    showFirePage();
    document.getElementById('fire-dialogue-btn').onclick = advanceFireDialogue;
    spawnNpcFireDragon();
}

function showFirePage() {
    document.getElementById('fire-dialogue-text').textContent = fireDialogueLines[fireDialoguePage];
    const btn = document.getElementById('fire-dialogue-btn');
    btn.textContent = fireDialoguePage < fireDialogueLines.length - 1 ? '[ Continue ]' : '[ I am ready ]';
}

function advanceFireDialogue() {
    fireDialoguePage++;
    if (fireDialoguePage >= fireDialogueLines.length) {
        closeFireDialogue();
        awardFireSlash();
    } else {
        showFirePage();
    }
}

function closeFireDialogue() {
    fireDialogueOpen = false;
    document.getElementById('fire-dialogue').style.display = 'none';
}

function awardFireSlash() {
    player.hasFireSlash = true;
    document.getElementById('fireslash-hud').style.display = 'block';
    // Dragon does its fireball attack before flying away
    playNpcFireDragonAttack();
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '\uD83D\uDD25 Learned: Fire Slash! (Hold E)';
    prompt.style.color = '#f84';
    prompt.style.borderColor = '#f84';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 4000);
}

// ===== FIRE SLASH PROJECTILE (sprite-sheet animated) =====
const fireSlashProjectiles = [];
const FIRE_SPRITE_COLS = 7;
const FIRE_SPRITE_ROWS = 9;
const FIRE_FRAME_DUR   = 180; // ms per frame

function fireFireSlash() {
    if (!player.hasFireSlash) return;
    const now = Date.now();
    if (now - player.lastFireSlash < player.fireSlashCooldown) return;
    player.lastFireSlash = now;

    const forward = new BABYLON.Vector3(
        Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x),
        -Math.sin(cameraRotation.x),
        Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x)
    );

    // Billboard plane — always faces the camera
    const plane = BABYLON.MeshBuilder.CreatePlane('firePlane_' + now, { width: 3.4, height: 2.0 }, scene);
    plane.position = camera.position.clone();
    plane.position.y -= 0.2;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const mat = new BABYLON.StandardMaterial('fireSpriteMat_' + now, scene);
    const tex = new BABYLON.Texture('assets/Copilot_20260531_091326.png', scene, false, true);
    tex.uScale  = 1 / FIRE_SPRITE_COLS;
    tex.vScale  = 1 / FIRE_SPRITE_ROWS;
    tex.uOffset = 0; // start at frame 0, column 0
    // FRONT row = top of image; with Babylon invertY=true, top row sits at high V
    tex.vOffset = (FIRE_SPRITE_ROWS - 1) / FIRE_SPRITE_ROWS;

    mat.diffuseTexture  = tex;
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.alphaMode = BABYLON.Engine.ALPHA_ADD; // additive blending — fire glows in dark
    mat.alpha = 1.0;
    mat.backFaceCulling = false;
    plane.material = mat;

    fireSlashProjectiles.push({
        plane, mat, tex,
        vel: forward.scale(0.55),
        born: now,
        hit: false,
        frame: 0
    });
}

function updateFireSlashProjectiles(dt) {
    const maxLife = FIRE_SPRITE_COLS * FIRE_FRAME_DUR;
    for (let i = fireSlashProjectiles.length - 1; i >= 0; i--) {
        const proj = fireSlashProjectiles[i];
        const age = Date.now() - proj.born;
        const lifeRatio = 1 - age / maxLife;

        if (proj.hit || lifeRatio <= 0) {
            proj.plane.dispose();
            proj.mat.dispose();
            fireSlashProjectiles.splice(i, 1);
            continue;
        }

        // Move forward
        proj.plane.position.addInPlace(proj.vel);

        // Advance sprite frame
        const frame = Math.min(FIRE_SPRITE_COLS - 1, Math.floor(age / FIRE_FRAME_DUR));
        if (frame !== proj.frame) {
            proj.frame = frame;
            proj.tex.uOffset = frame / FIRE_SPRITE_COLS;
        }

        // Fade out in last third of life
        proj.mat.alpha = Math.min(1, lifeRatio * 3.0);

        // Hit detection
        zombies.forEach(zombie => {
            if (proj.hit || zombie.health <= 0) return;
            const dist = BABYLON.Vector3.Distance(proj.plane.position, zombie.group.position);
            if (dist < 1.7) {
                proj.hit = true;
                zombie.health -= 3;
                updateZombieHealthBar(zombie);
                createExplosion(zombie.group.position, zombie.type);
                if (zombie.isNecromancer) awardDarkEnergy();
                if (zombie.health <= 0) {
                    zombie.isDead = true;
                    onZombieKilled();
                }
            }
        });
    }

    // Update fire cooldown HUD
    if (player.hasFireSlash) {
        const elapsed = Date.now() - player.lastFireSlash;
        const cdEl = document.getElementById('fireslash-cooldown-text');
        if (!cdEl) return;
        if (elapsed < player.fireSlashCooldown) {
            cdEl.textContent = `(${((player.fireSlashCooldown - elapsed) / 1000).toFixed(1)}s)`;
            cdEl.style.color = '#888';
        } else {
            cdEl.textContent = '(Ready)';
            cdEl.style.color = '#f84';
        }
    }
}


const darkEnergyEffects = [];
const DARK_SPRITE_COLS = 7;
const DARK_SPRITE_ROWS = 9;
const DARK_FRAME_DUR   = 140; // ms per frame

function fireDarkEnergy() {
    const radius = 12;
    const dmg = 4;
    const now = Date.now();

    // Hit all zombies in radius
    zombies.forEach(zombie => {
        if (zombie.health <= 0) return;
        const dist = BABYLON.Vector3.Distance(camera.position, zombie.group.position);
        if (dist <= radius) {
            zombie.health -= dmg;
            updateZombieHealthBar(zombie);
            createExplosion(zombie.group.position, 'purple');
            if (zombie.health <= 0) {
                zombie.isDead = true;
                onZombieKilled();
            }
        }
    });

    // Visual: 3 expanding dark rings outward from player
    const ringMats = [
        (() => { const m = new BABYLON.StandardMaterial('deM0_' + now, scene); m.diffuseColor = new BABYLON.Color3(0.4,0.0,0.6); m.emissiveColor = new BABYLON.Color3(0.5,0.0,0.8); m.alpha = 0.85; m.backFaceCulling = false; return m; })(),
        (() => { const m = new BABYLON.StandardMaterial('deM1_' + now, scene); m.diffuseColor = new BABYLON.Color3(0.1,0.0,0.3); m.emissiveColor = new BABYLON.Color3(0.2,0.0,0.4); m.alpha = 0.70; m.backFaceCulling = false; return m; })(),
        (() => { const m = new BABYLON.StandardMaterial('deM2_' + now, scene); m.diffuseColor = new BABYLON.Color3(0.6,0.4,0.0); m.emissiveColor = new BABYLON.Color3(0.8,0.5,0.0); m.alpha = 0.55; m.backFaceCulling = false; return m; })()
    ];
    const rings = ringMats.map((mat, idx) => {
        const torus = BABYLON.MeshBuilder.CreateTorus('deTorus_' + idx + '_' + now, {
            diameter: 0.5,
            thickness: 0.4 + idx * 0.15,
            tessellation: 20
        }, scene);
        torus.position = camera.position.clone();
        torus.position.y = 1;
        torus.material = mat;
        torus.isPickable = false;
        return { mesh: torus, mat, delay: idx * 120 };
    });

    // Sprite burst — large billboard in front of player showing dark magic slash
    const yaw = cameraRotation.y;
    const spawnPos = camera.position.clone();
    spawnPos.x += Math.sin(yaw) * 2.5;
    spawnPos.y -= 0.3;
    spawnPos.z += Math.cos(yaw) * 2.5;

    const plane = BABYLON.MeshBuilder.CreatePlane('darkSpritePlane_' + now, { width: 5.0, height: 3.0 }, scene);
    plane.position = spawnPos;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const spriteMat = new BABYLON.StandardMaterial('darkSpriteMat_' + now, scene);
    const tex = new BABYLON.Texture('assets/Copilot_20260531_182230.png', scene, false, true);
    tex.uScale  = 1 / DARK_SPRITE_COLS;
    tex.vScale  = 1 / DARK_SPRITE_ROWS;
    tex.uOffset = 0;
    tex.vOffset = (DARK_SPRITE_ROWS - 1) / DARK_SPRITE_ROWS; // FRONT row (top)
    spriteMat.diffuseTexture  = tex;
    spriteMat.emissiveTexture = tex;
    spriteMat.disableLighting = true;
    spriteMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    spriteMat.alpha = 1.0;
    spriteMat.backFaceCulling = false;
    plane.material = spriteMat;

    darkEnergyEffects.push({ rings, plane, spriteMat, tex, born: now, maxRadius: radius, frame: 0 });

    // Prompt
    const prompt = document.getElementById('interact-prompt');
    prompt.textContent = '\u26A1 Dark Energy released!';
    prompt.style.color = '#d8f';
    prompt.style.borderColor = '#d8f';
    prompt.style.display = 'block';
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.color = '';
        prompt.style.borderColor = '';
    }, 1500);
}

function updateDarkEnergyEffects(dt) {
    const lifespan = 900;
    const spriteLifespan = DARK_SPRITE_COLS * DARK_FRAME_DUR;
    for (let i = darkEnergyEffects.length - 1; i >= 0; i--) {
        const ef = darkEnergyEffects[i];
        const age = Date.now() - ef.born;
        if (age > lifespan) {
            ef.rings.forEach(r => { r.mesh.dispose(); r.mat.dispose(); });
            if (ef.plane) { ef.plane.dispose(); ef.spriteMat.dispose(); }
            darkEnergyEffects.splice(i, 1);
            continue;
        }

        // Expand torus rings
        ef.rings.forEach(r => {
            const ringAge = Math.max(0, age - r.delay);
            const t = ringAge / (lifespan - r.delay);
            const curR = t * ef.maxRadius;
            r.mesh.scaling = new BABYLON.Vector3(curR * 0.18, 1, curR * 0.18);
            r.mat.alpha = Math.max(0, 0.85 * (1 - t));
        });

        // Advance sprite frame
        if (ef.plane) {
            const frame = Math.min(DARK_SPRITE_COLS - 1, Math.floor(age / DARK_FRAME_DUR));
            if (frame !== ef.frame) {
                ef.frame = frame;
                ef.tex.uOffset = frame / DARK_SPRITE_COLS;
            }
            // Fade out after mid-life
            ef.spriteMat.alpha = Math.max(0, 1.0 - age / spriteLifespan);
            if (age > spriteLifespan) {
                ef.plane.dispose();
                ef.spriteMat.dispose();
                ef.plane = null;
            }
        }
    }
}

// ===== FIRE DRAGON SPRITE =====
const DRAGON_COLS      = 7;
const DRAGON_ROWS      = 6;
const DRAGON_FRAME_DUR = 120; // ms per frame
// Row vOffsets (invertY=true → top of image = highest vOffset)
const DRAGON_ROW = {
    IDLE:     5 / DRAGON_ROWS,
    RUN:      4 / DRAGON_ROWS,
    FIREBALL: 3 / DRAGON_ROWS,
    SCRATCH:  2 / DRAGON_ROWS,
    DEATH:    1 / DRAGON_ROWS,
};

// ---- NPC Dragon (visible during fire dialogue) ----
let npcFireDragon = null;

function spawnNpcFireDragon() {
    if (npcFireDragon) return;
    const yaw = cameraRotation.y;
    const pos = camera.position.clone();
    pos.x += Math.sin(yaw) * 12;
    pos.y  = 1.5;
    pos.z += Math.cos(yaw) * 12;

    const plane = BABYLON.MeshBuilder.CreatePlane('npcDragonPlane', { width: 6, height: 4 }, scene);
    plane.position = pos;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    plane.isPickable = false;

    const mat = new BABYLON.StandardMaterial('npcDragonMat', scene);
    const tex = new BABYLON.Texture('assets/dragon_fire.png', scene, false, true);
    tex.hasAlpha = true;
    tex.getAlphaFromRGB = true;
    tex.uScale  = 1 / DRAGON_COLS;
    tex.vScale  = 1 / DRAGON_ROWS;
    tex.uOffset = 0;
    tex.vOffset = DRAGON_ROW.IDLE;
    mat.diffuseTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND;
    mat.alphaCutOff = 0.22;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    plane.material = mat;

    npcFireDragon = { plane, mat, tex, frame: 0, born: Date.now(), state: 'idle' };
}

function playNpcFireDragonAttack() {
    if (!npcFireDragon) return;
    npcFireDragon.state = 'fireball';
    npcFireDragon.frame = 0;
    npcFireDragon.born  = Date.now();
    npcFireDragon.tex.uOffset = 0;
    npcFireDragon.tex.vOffset = DRAGON_ROW.FIREBALL;
    // Dispose after full attack animation
    setTimeout(() => {
        if (npcFireDragon) {
            npcFireDragon.plane.dispose();
            npcFireDragon.mat.dispose();
            npcFireDragon = null;
        }
    }, DRAGON_COLS * DRAGON_FRAME_DUR + 200);
}

function disposeNpcFireDragon() {
    if (!npcFireDragon) return;
    npcFireDragon.plane.dispose();
    npcFireDragon.mat.dispose();
    npcFireDragon = null;
}

function updateNpcFireDragon() {
    if (!npcFireDragon) return;
    const age   = Date.now() - npcFireDragon.born;
    const frame = npcFireDragon.state === 'idle'
        ? Math.floor(age / DRAGON_FRAME_DUR) % DRAGON_COLS
        : Math.min(DRAGON_COLS - 1, Math.floor(age / DRAGON_FRAME_DUR));
    if (frame !== npcFireDragon.frame) {
        npcFireDragon.frame = frame;
        npcFireDragon.tex.uOffset = frame / DRAGON_COLS;
    }
}

// ===== WIND DRAGON SPRITE =====
const WIND_DRAGON_COLS      = 4;
const WIND_DRAGON_ROWS      = 12;
const WIND_DRAGON_FRAME_DUR = 130; // ms per frame
// Skip col 0 (label column) — usable frames: 1-3
const WIND_DRAGON_ROW = {
    FRONT: (WIND_DRAGON_ROWS - 1) / WIND_DRAGON_ROWS, // top row
};

// ---- NPC Wind Dragon (visible during wind dialogue) ----
let npcWindDragon = null;

function spawnNpcWindDragon() {
    if (npcWindDragon) return;
    const yaw = cameraRotation.y;
    const pos = camera.position.clone();
    pos.x += Math.sin(yaw) * 10;
    pos.y  = 1.5;
    pos.z += Math.cos(yaw) * 10;

    const plane = BABYLON.MeshBuilder.CreatePlane('npcWindDragonPlane', { width: 7, height: 5 }, scene);
    plane.position = pos;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    plane.isPickable = false;

    const mat = new BABYLON.StandardMaterial('npcWindDragonMat', scene);
    const tex = new BABYLON.Texture('assets/Copilot_20260531_181340.png', scene, false, true);
    tex.hasAlpha = true;
    tex.getAlphaFromRGB = true;
    tex.uScale  = 1 / WIND_DRAGON_COLS;
    tex.vScale  = 1 / WIND_DRAGON_ROWS;
    tex.uOffset = 1 / WIND_DRAGON_COLS; // skip label column
    tex.vOffset = WIND_DRAGON_ROW.FRONT;
    mat.diffuseTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND;
    mat.alphaCutOff = 0.22;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    plane.material = mat;

    npcWindDragon = { plane, mat, tex, frame: 1, born: Date.now() };
}

function disposeNpcWindDragon() {
    if (!npcWindDragon) return;
    npcWindDragon.plane.dispose();
    npcWindDragon.mat.dispose();
    npcWindDragon = null;
}

function updateNpcWindDragon() {
    if (!npcWindDragon) return;
    const age   = Date.now() - npcWindDragon.born;
    // Loop frames 1-3 (skip frame 0)
    const frame = 1 + (Math.floor(age / WIND_DRAGON_FRAME_DUR) % (WIND_DRAGON_COLS - 1));
    if (frame !== npcWindDragon.frame) {
        npcWindDragon.frame = frame;
        npcWindDragon.tex.uOffset = frame / WIND_DRAGON_COLS;
    }
}

// ---- Enemy Wind Dragons ----
function createStylizedDragonModel(parent, variant) {
    const isFire = variant === 'fire';

    const bodyMat = new BABYLON.StandardMaterial('dBody_' + Math.random(), scene);
    bodyMat.diffuseColor = isFire
        ? new BABYLON.Color3(0.45, 0.06, 0.05)
        : new BABYLON.Color3(0.06, 0.26, 0.62);
    bodyMat.emissiveColor = isFire
        ? new BABYLON.Color3(0.18, 0.02, 0.01)
        : new BABYLON.Color3(0.02, 0.10, 0.24);

    const wingMat = new BABYLON.StandardMaterial('dWing_' + Math.random(), scene);
    wingMat.diffuseColor = isFire
        ? new BABYLON.Color3(0.08, 0.04, 0.04)
        : new BABYLON.Color3(0.02, 0.14, 0.34);
    wingMat.emissiveColor = isFire
        ? new BABYLON.Color3(0.14, 0.06, 0.03)
        : new BABYLON.Color3(0.02, 0.14, 0.28);

    const eyeMat = new BABYLON.StandardMaterial('dEye_' + Math.random(), scene);
    eyeMat.diffuseColor = isFire
        ? new BABYLON.Color3(1.0, 0.42, 0.1)
        : new BABYLON.Color3(0.35, 0.85, 1.0);
    eyeMat.emissiveColor = isFire
        ? new BABYLON.Color3(0.75, 0.22, 0.06)
        : new BABYLON.Color3(0.18, 0.54, 0.82);

    const core = new BABYLON.TransformNode('dragonCore_' + Math.random(), scene);
    core.parent = parent;
    core.position.y = 1.5;

    const torso = BABYLON.MeshBuilder.CreateBox('dragonTorso_' + Math.random(), { width: 1.7, height: 0.8, depth: 2.2 }, scene);
    torso.parent = core;
    torso.material = bodyMat;

    const neck = BABYLON.MeshBuilder.CreateBox('dragonNeck_' + Math.random(), { width: 0.7, height: 0.5, depth: 0.9 }, scene);
    neck.parent = core;
    neck.position = new BABYLON.Vector3(0, 0.15, 1.45);
    neck.material = bodyMat;

    const head = BABYLON.MeshBuilder.CreateBox('dragonHead_' + Math.random(), { width: 0.9, height: 0.55, depth: 0.95 }, scene);
    head.parent = core;
    head.position = new BABYLON.Vector3(0, 0.22, 2.05);
    head.material = bodyMat;

    const eyeL = BABYLON.MeshBuilder.CreateBox('dragonEyeL_' + Math.random(), { width: 0.12, height: 0.12, depth: 0.05 }, scene);
    eyeL.parent = core;
    eyeL.position = new BABYLON.Vector3(-0.22, 0.26, 2.48);
    eyeL.material = eyeMat;
    const eyeR = BABYLON.MeshBuilder.CreateBox('dragonEyeR_' + Math.random(), { width: 0.12, height: 0.12, depth: 0.05 }, scene);
    eyeR.parent = core;
    eyeR.position = new BABYLON.Vector3(0.22, 0.26, 2.48);
    eyeR.material = eyeMat;

    const tail = BABYLON.MeshBuilder.CreateBox('dragonTail_' + Math.random(), { width: 0.55, height: 0.40, depth: 1.9 }, scene);
    tail.parent = core;
    tail.position = new BABYLON.Vector3(0, -0.05, -1.95);
    tail.material = bodyMat;

    const wingRootL = new BABYLON.TransformNode('dragonWingRootL_' + Math.random(), scene);
    wingRootL.parent = core;
    wingRootL.position = new BABYLON.Vector3(-0.88, 0.24, -0.08);
    const wingL = BABYLON.MeshBuilder.CreateBox('dragonWingL_' + Math.random(), { width: 2.2, height: 0.10, depth: 1.35 }, scene);
    wingL.parent = wingRootL;
    wingL.position = new BABYLON.Vector3(-1.05, 0, 0.02);
    wingL.material = wingMat;

    const wingRootR = new BABYLON.TransformNode('dragonWingRootR_' + Math.random(), scene);
    wingRootR.parent = core;
    wingRootR.position = new BABYLON.Vector3(0.88, 0.24, -0.08);
    const wingR = BABYLON.MeshBuilder.CreateBox('dragonWingR_' + Math.random(), { width: 2.2, height: 0.10, depth: 1.35 }, scene);
    wingR.parent = wingRootR;
    wingR.position = new BABYLON.Vector3(1.05, 0, 0.02);
    wingR.material = wingMat;

    const legL = BABYLON.MeshBuilder.CreateBox('dragonLegL_' + Math.random(), { width: 0.28, height: 0.42, depth: 0.32 }, scene);
    legL.parent = core;
    legL.position = new BABYLON.Vector3(-0.34, -0.55, 0.4);
    legL.material = bodyMat;
    const legR = BABYLON.MeshBuilder.CreateBox('dragonLegR_' + Math.random(), { width: 0.28, height: 0.42, depth: 0.32 }, scene);
    legR.parent = core;
    legR.position = new BABYLON.Vector3(0.34, -0.55, 0.4);
    legR.material = bodyMat;

    return { core, wingRootL, wingRootR, tail, head, neck };
}

function createWindDragonEnemy() {
    let spawnPos;
    do {
        const angle = Math.random() * Math.PI * 2;
        spawnPos = new BABYLON.Vector3(
            camera.position.x + Math.cos(angle) * 28,
            1,
            camera.position.z + Math.sin(angle) * 28
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    const g = new BABYLON.TransformNode('windDragonGroup_' + Date.now(), scene);
    g.position = spawnPos;
    const model = createStylizedDragonModel(g, 'ice');

    const dragon = {
        group: g,
        health: 15, maxHealth: 15,
        speed: 0.06, // faster than fire dragons
        isWindDragon: true,
        isDead: false,
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0,
        deathTimer: 0,
        frame: 1, frameBorn: Date.now(),
        healthBar: null,
        model,
        head: { position: { y: 0 } },
        armLeft: g, armRight: g,
        fistLeft: g, fistRight: g,
        legLeft: g, legRight: g,
        bootLeft: g, bootRight: g,
    };
    dragon.healthBar = createZombieHealthBar(dragon);
    updateZombieHealthBar(dragon);
    zombies.push(dragon);
}

function updateWindDragonSprites(dt) {
    zombies.forEach(dragon => {
        if (!dragon.isWindDragon) return;
        if (dragon.model) {
            const t = Date.now() * 0.008;
            dragon.model.wingRootL.rotation.z = -0.55 + Math.sin(t + dragon.group.position.x) * 0.42;
            dragon.model.wingRootR.rotation.z = 0.55 - Math.sin(t + dragon.group.position.x) * 0.42;
            dragon.model.tail.rotation.x = Math.sin(t * 0.6 + dragon.group.position.z) * 0.24;
            dragon.model.neck.rotation.x = Math.sin(t * 0.5 + dragon.group.position.x) * 0.10;
            dragon.group.position.y = 1 + Math.sin(t + dragon.group.position.x * 0.12) * 0.18;
            return;
        }
        const age   = Date.now() - dragon.frameBorn;
        // Loop frames 1-3 (skip label col 0)
        const frame = 1 + (Math.floor(age / WIND_DRAGON_FRAME_DUR) % (WIND_DRAGON_COLS - 1));
        if (frame !== dragon.frame) {
            dragon.frame = frame;
            if (dragon.tex) dragon.tex.uOffset = frame / WIND_DRAGON_COLS;
        }
        // All rows use same sheet — keep FRONT row
        if (dragon.tex) dragon.tex.vOffset = WIND_DRAGON_ROW.FRONT;
    });
}

// ---- Enemy Fire Dragons ----
function createFireDragonEnemy() {
    let spawnPos;
    do {
        const angle = Math.random() * Math.PI * 2;
        spawnPos = new BABYLON.Vector3(
            camera.position.x + Math.cos(angle) * 30,
            1,
            camera.position.z + Math.sin(angle) * 30
        );
    } while (nearHouse(spawnPos.x, spawnPos.z) || isInRiver(spawnPos.x, spawnPos.z, 3));

    const g = new BABYLON.TransformNode('fireDragonGroup_' + Date.now(), scene);
    g.position = spawnPos;
    const model = createStylizedDragonModel(g, 'fire');

    const dragon = {
        group: g,
        health: 20, maxHealth: 20,
        speed: 0.045,
        isFireDragon: true,
        isDead: false,
        animationState: 'walk',
        animationTimer: 0,
        animationSpeed: 0,
        deathTimer: 0,
        frame: 0, frameBorn: Date.now(),
        spriteRow: DRAGON_ROW.IDLE,
        healthBar: null,
        model,
        // stub limbs (updateZombieAnimation guards these)
        head: { position: { y: 0 } },
        armLeft: g, armRight: g,
        fistLeft: g, fistRight: g,
        legLeft: g, legRight: g,
        bootLeft: g, bootRight: g,
    };
    dragon.healthBar = createZombieHealthBar(dragon);
    updateZombieHealthBar(dragon);
    zombies.push(dragon);
}

function updateFireDragonSprites(dt) {
    zombies.forEach(dragon => {
        if (!dragon.isFireDragon) return;
        if (dragon.model) {
            const t = Date.now() * 0.0085;
            dragon.model.wingRootL.rotation.z = -0.55 + Math.sin(t + dragon.group.position.x) * 0.38;
            dragon.model.wingRootR.rotation.z = 0.55 - Math.sin(t + dragon.group.position.x) * 0.38;
            dragon.model.tail.rotation.x = Math.sin(t * 0.7 + dragon.group.position.z) * 0.20;
            dragon.model.neck.rotation.x = Math.sin(t * 0.6 + dragon.group.position.x) * 0.09;
            dragon.group.position.y = 1 + Math.sin(t + dragon.group.position.z * 0.14) * 0.15;
            return;
        }
        if (dragon.health <= 0) {
            // death animation
            dragon.spriteRow = DRAGON_ROW.DEATH;
        } else {
            const dist = BABYLON.Vector3.Distance(dragon.group.position, camera.position);
            dragon.spriteRow = dist <= 2.5 ? DRAGON_ROW.FIREBALL : DRAGON_ROW.RUN;
        }
        if (dragon.tex) dragon.tex.vOffset = dragon.spriteRow;

        const age   = Date.now() - dragon.frameBorn;
        const frame = Math.floor(age / DRAGON_FRAME_DUR) % DRAGON_COLS;
        if (frame !== dragon.frame) {
            dragon.frame = frame;
            if (dragon.tex) dragon.tex.uOffset = frame / DRAGON_COLS;
        }
    });
}

function updateWaterSlashProjectiles(dt) {
    const maxLife = WATER_SPRITE_COLS * WATER_FRAME_DUR;
    for (let i = waterSlashProjectiles.length - 1; i >= 0; i--) {
        const proj = waterSlashProjectiles[i];
        const age = Date.now() - proj.born;
        const lifeRatio = 1 - age / maxLife;

        if (proj.hit || lifeRatio <= 0) {
            proj.plane.dispose();
            proj.mat.dispose();
            waterSlashProjectiles.splice(i, 1);
            continue;
        }

        // Move forward
        proj.plane.position.addInPlace(proj.vel);

        const frame = Math.min(WATER_SPRITE_COLS - 1, Math.floor(age / WATER_FRAME_DUR));
        if (frame !== proj.frame) {
            proj.frame = frame;
            proj.tex.uOffset = frame / WATER_SPRITE_COLS;
        }

        // Fade out as it travels
        const alpha = Math.min(1, lifeRatio * 2.5);
        proj.mat.alpha = alpha;

        if (proj.canHit) {
            // Hit detection
            zombies.forEach(zombie => {
                if (proj.hit || zombie.health <= 0) return;
                const dist = BABYLON.Vector3.Distance(proj.plane.position, zombie.group.position);
                if (dist < 1.6) {
                    proj.hit = true;
                    const nearRiver = isInRiver(camera.position.x, camera.position.z, 8)
                        || isInRiver(zombie.group.position.x, zombie.group.position.z, 8);
                    const waterDamage = nearRiver ? 3 : 2;
                    zombie.health -= waterDamage;
                    updateZombieHealthBar(zombie);
                    createExplosion(zombie.group.position, 'blue');
                    if (zombie.isNecromancer) awardDarkEnergy();
                    if (zombie.health <= 0) {
                        zombie.isDead = true;
                        onZombieKilled();
                    }
                }
            });
        }
    }

    // Update cooldown display
    if (player.hasWaterSlash) {
        const elapsed = Date.now() - player.lastWaterSlash;
        const cdText = document.getElementById('waterslash-cooldown-text');
        if (elapsed < player.waterSlashCooldown) {
            const remaining = ((player.waterSlashCooldown - elapsed) / 1000).toFixed(1);
            cdText.textContent = `(${remaining}s)`;
            cdText.style.color = '#888';
        } else {
            cdText.textContent = '(Ready)';
            cdText.style.color = '#4cf';
        }
    }
}

function onZombieKilled() {
    if (!activeMission) return;
    missionKills++;
    updateMissionHUD();
    if (missionKills >= activeMission.killGoal) {
        const completedId = activeMission.id;
        completedMissions.add(completedId);
        activeMission = null;
        missionKills = 0;
        document.getElementById('mission-status').style.display = 'none';
        // Flash completion message
        promptLockedUntil = Date.now() + 5000;
        const prompt = document.getElementById('interact-prompt');
        prompt.textContent = '✓ Mission Complete! Return to Elder Thornwood.';
        prompt.style.color = '#88CC66';
        prompt.style.borderColor = '#88CC66';
        prompt.style.display = 'block';
        setTimeout(() => {
            prompt.style.display = 'none';
            prompt.style.color = '';
            prompt.style.borderColor = '';
            promptLockedUntil = 0;
        }, 5000);
        // After mission 1: Thornwood teaches magic (water slash)
        if (completedId === 1 && !player.hasWaterSlash) {
            // Small delay so the "Mission Complete" prompt shows first
            setTimeout(() => {
                // Only show if player is inside the house (talking to elder)
                // or immediately if outside — the elder's voice carries!
                openMagicDialogue();
            }, 5200);
        }
        // After mission 2: Thornwood & King reveal the player is human; award wind slash
        if (completedId === 2 && !player.hasWindSlash) {
            setTimeout(() => openWindDialogue(), 5200);
        }
    }
}

// Function to start cutscene
function startCutscene() {
    cutsceneActive = true;
    cutsceneTimer = 0;
    cutsceneResetDone = false;

    // Create house, camp + elves only on first death; reuse on subsequent deaths
    if (elves.length === 0) {
        // Elder's house and interior appear for the first time
        createElderHouse();
        createHouseInterior();

        // Camp huts around the elder's house
        createCamp(HOUSE_POS.x, HOUSE_POS.z);

        // 8 guard elves scattered around camp
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            let elfX = HOUSE_POS.x + Math.cos(angle) * 18;
            let elfZ = HOUSE_POS.z + Math.sin(angle) * 18;
            if (nearHouse(elfX, elfZ)) {
                elfX = HOUSE_POS.x + Math.cos(angle) * 14;
                elfZ = HOUSE_POS.z + Math.sin(angle) * 14;
            }
            elves.push(createElf(elfX, elfZ));
        }

        // Elf king in front of the house
        elves.push(createElfKing(HOUSE_POS.x, HOUSE_POS.z + 8));
    }

    // Scatter guard elves near the player so they rush in dramatically
    elves.forEach((elf, i) => {
        if (elf.isKing) return;
        const angle = (Math.PI * 2 * i) / Math.max(1, elves.length - 1);
        let ex = camera.position.x + Math.cos(angle) * 20;
        let ez = camera.position.z + Math.sin(angle) * 20;
        if (nearHouse(ex, ez)) {
            ex = HOUSE_POS.x + Math.cos(angle) * 14;
            ez = HOUSE_POS.z + Math.sin(angle) * 14;
        }
        elf.group.position.x = ex;
        elf.group.position.z = ez;
        elf.animationState = 'run';
    });
}

// Function to clear cutscene (but keep elves at camp)
function clearCutscene() {
    cutsceneActive = false;
    cutsceneResetDone = false;
}

// King swoop cutscene — triggered when zombie soldier kills the player
function startKingSwoopCutscene() {
    // Make sure world exists
    if (elves.length === 0) {
        createElderHouse();
        createHouseInterior();
        createCamp(HOUSE_POS.x, HOUSE_POS.z);
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            let ex = HOUSE_POS.x + Math.cos(angle) * 18;
            let ez = HOUSE_POS.z + Math.sin(angle) * 18;
            if (nearHouse(ex, ez)) { ex = HOUSE_POS.x + Math.cos(angle) * 14; ez = HOUSE_POS.z + Math.sin(angle) * 14; }
            elves.push(createElf(ex, ez));
        }
        elves.push(createElfKing(HOUSE_POS.x, HOUSE_POS.z + 8));
    }

    kingSwoopActive = true;
    kingSwoopTimer = 0;
    kingSwoopDone = false;
    cutsceneActive = true; // block gameplay

    // Clear all zombies immediately — they scatter as the king arrives
    zombies.forEach(z => {
        if (z.healthBar && z.healthBar.barGroup) z.healthBar.barGroup.dispose();
        z.group.dispose();
    });
    zombies.length = 0;
    zombieSoldier = null;
    spawnTimer = 0;

    // Teleport king right behind the player to start the swoop
    const king = elves.find(e => e.isKing);
    if (king) {
        king.group.position = new BABYLON.Vector3(
            camera.position.x - Math.sin(cameraRotation.y) * 3,
            1,
            camera.position.z - Math.cos(cameraRotation.y) * 3
        );
        king.animationState = 'run';
    }
}

// Function to update elf animation
// ===== ZOMBIE ANIMATION =====
function updateZombieAnimation(zombie, deltaTime) {
    if (zombie.isFireDragon || zombie.isWindDragon) return; // sprite-based
    zombie.animationTimer += deltaTime * zombie.animationSpeed;
    const t = zombie.animationTimer;
    const hasPart = (part) => zombie[part] && zombie[part].position;

    // Cache original positions once
    if (!zombie._origPos) {
        zombie._origPos = {};
        ['armLeft', 'armRight', 'fistLeft', 'fistRight', 'legLeft', 'legRight', 'bootLeft', 'bootRight'].forEach((part) => {
            if (hasPart(part)) {
                zombie._origPos[part] = zombie[part].position.clone();
            }
        });
        zombie._baseY = zombie.group.position.y;
    }
    const o = zombie._origPos;

    if (zombie.animationState === 'idle') {
        // Gentle sway, arms slightly raised forward
        const sway = Math.sin(t * 0.4) * 0.015;
        if (zombie.head && zombie.head.position) zombie.head.position.y = 1.52 + sway;
        if (hasPart('armLeft') && o.armLeft) zombie.armLeft.position.z = o.armLeft.z + 0.14;
        if (hasPart('armRight') && o.armRight) zombie.armRight.position.z = o.armRight.z + 0.14;
        if (hasPart('fistLeft') && o.fistLeft) zombie.fistLeft.position.z = o.fistLeft.z + 0.14;
        if (hasPart('fistRight') && o.fistRight) zombie.fistRight.position.z = o.fistRight.z + 0.14;

    } else if (zombie.animationState === 'walk') {
        // Lurching zombie walk — arms outstretched and swinging alternately
        const swing = Math.sin(t);
        // Left arm forward / right arm back, then swap
        if (hasPart('armLeft') && o.armLeft) {
            zombie.armLeft.position.z = o.armLeft.z + 0.26 + swing * 0.20;
            zombie.armLeft.position.y = o.armLeft.y + swing * 0.05;
        }
        if (hasPart('fistLeft') && o.fistLeft) {
            zombie.fistLeft.position.z = o.fistLeft.z + 0.26 + swing * 0.20;
            zombie.fistLeft.position.y = o.fistLeft.y + swing * 0.05;
        }

        if (hasPart('armRight') && o.armRight) {
            zombie.armRight.position.z = o.armRight.z + 0.26 - swing * 0.20;
            zombie.armRight.position.y = o.armRight.y - swing * 0.05;
        }
        if (hasPart('fistRight') && o.fistRight) {
            zombie.fistRight.position.z = o.fistRight.z + 0.26 - swing * 0.20;
            zombie.fistRight.position.y = o.fistRight.y - swing * 0.05;
        }

        // Legs stride
        if (hasPart('legLeft') && o.legLeft) zombie.legLeft.position.z = o.legLeft.z + swing * 0.10;
        if (hasPart('legRight') && o.legRight) zombie.legRight.position.z = o.legRight.z - swing * 0.10;
        if (hasPart('bootLeft') && o.bootLeft) zombie.bootLeft.position.z = o.bootLeft.z + swing * 0.10;
        if (hasPart('bootRight') && o.bootRight) zombie.bootRight.position.z = o.bootRight.z - swing * 0.10;
        // Slight up/down body bob
        zombie.group.position.y = (zombie._baseY || 1) - Math.abs(swing) * 0.04;

    } else if (zombie.animationState === 'attack') {
        // Both arms lunge hard forward, body dips
        const lunge = Math.abs(Math.sin(t * 1.8));
        if (hasPart('armLeft') && o.armLeft) {
            zombie.armLeft.position.z = o.armLeft.z + 0.20 + lunge * 0.36;
            zombie.armLeft.position.y = o.armLeft.y - lunge * 0.10;
        }
        if (hasPart('armRight') && o.armRight) {
            zombie.armRight.position.z = o.armRight.z + 0.20 + lunge * 0.36;
            zombie.armRight.position.y = o.armRight.y - lunge * 0.10;
        }
        if (hasPart('fistLeft') && o.fistLeft) {
            zombie.fistLeft.position.z = o.fistLeft.z + 0.20 + lunge * 0.36;
            zombie.fistLeft.position.y = o.fistLeft.y - lunge * 0.10;
        }
        if (hasPart('fistRight') && o.fistRight) {
            zombie.fistRight.position.z = o.fistRight.z + 0.20 + lunge * 0.36;
            zombie.fistRight.position.y = o.fistRight.y - lunge * 0.10;
        }
        // Reset legs
        if (hasPart('legLeft') && o.legLeft) zombie.legLeft.position.z = o.legLeft.z;
        if (hasPart('legRight') && o.legRight) zombie.legRight.position.z = o.legRight.z;
        if (hasPart('bootLeft') && o.bootLeft) zombie.bootLeft.position.z = o.bootLeft.z;
        if (hasPart('bootRight') && o.bootRight) zombie.bootRight.position.z = o.bootRight.z;

    } else if (zombie.animationState === 'death') {
        // Topple forward
        const fall = Math.min(zombie.deathTimer * 0.0018, Math.PI / 2);
        zombie.group.rotation.x = fall;
        zombie.group.position.y = (zombie._baseY || 1) - Math.sin(fall) * 0.5;
    }
}

function updateElfAnimation(elf, deltaTime) {
    const speedMult = (elf._animMult !== undefined) ? elf._animMult : 1.0;
    elf.animationTimer += deltaTime * elf.animationSpeed * speedMult;
    
    // Get animation frame (0-3 for run cycle)
    const frame = Math.floor(elf.animationTimer) % 4;
    
    // Store original positions if not already stored
    if (!elf._originalPositions) {
        elf._originalPositions = {
            armLeft: elf.armLeft.position.clone(),
            legLeft: elf.legLeft.position.clone(),
            legRight: elf.legRight.position.clone()
        };
    }
    
    // Sword arm animation (both regular elf and king use swordArm pivot)
    if (elf.swordArm) {
        if (elf.animationState === 'idle') {
            elf.swordArm.rotation.x = -0.2 + Math.sin(elf.animationTimer * 0.5) * 0.06;
            if (elf.isKing) {
                elf.swordArm.rotation.z = Math.sin(elf.animationTimer * 0.4) * 0.04;
                if (elf.capeUpper) elf.capeUpper.rotation.x = Math.sin(elf.animationTimer * 0.5) * 0.06;
                if (elf.capeLower) elf.capeLower.rotation.x = Math.sin(elf.animationTimer * 0.5 + 0.4) * 0.09;
            }
        } else if (elf.animationState === 'run') {
            const swing = Math.sin(elf.animationTimer * 1.4);
            elf.swordArm.rotation.x = -0.2 + swing * 0.18;
            if (elf.isKing) {
                if (elf.capeLower) elf.capeLower.rotation.x = -0.15 + swing * 0.12;
                if (elf.capeUpper) elf.capeUpper.rotation.x = -0.08;
            }
        } else if (elf.animationState === 'attack') {
            const thrust = Math.abs(Math.sin(elf.animationTimer * 2.5));
            elf.swordArm.rotation.x = -0.2 - thrust * 1.0;
            if (elf.isKing) elf.swordArm.rotation.z = thrust * 0.3;
        }
    }

    if (elf.animationState === 'idle') {
        // Idle pose - slight head sway
        const sway = Math.sin(elf.animationTimer * 0.5) * 0.02;
        elf.head.position.y = (elf.isKing ? 1.30 : 1.30) + sway;

    } else if (elf.animationState === 'run') {
        // Smooth running — sine-wave leg stride + opposite arm swing
        const swing = Math.sin(elf.animationTimer * 1.4);
        const origArm = elf._originalPositions.armLeft;
        const origLeg = elf._originalPositions.legLeft;

        elf.legLeft.position.z  = origLeg.z + swing * 0.12;
        elf.legRight.position.z = origLeg.z - swing * 0.12;
        elf.legLeft.position.y  = origLeg.y + Math.max(0, swing) * 0.06;
        elf.legRight.position.y = origLeg.y + Math.max(0, -swing) * 0.06;

        elf.armLeft.position.z  = origArm.z - swing * 0.10;
        elf.armLeft.position.y  = origArm.y + swing * 0.08;
        // armRight is parented to swordArm pivot — do not move it directly

        // Body bob
        elf.head.position.y = 1.30 + Math.abs(swing) * 0.03;

    } else if (elf.animationState === 'attack') {
        // Sword arm handles the attack swing via swordArm pivot above
        // Arm body follows slightly
        if (!elf.isKing && elf._originalPositions) {
            const thrust = Math.abs(Math.sin(elf.animationTimer * 2.2));
            elf.armLeft.position.z = elf._originalPositions.armLeft.z - thrust * 0.06;
        }

    } else if (elf.animationState === 'death') {
        // Fall sideways
        const fallAmount = Math.min(elf.animationTimer * 0.0014, Math.PI / 2);
        elf.group.rotation.z = fallAmount;
        elf.group.position.y = 1 - Math.sin(fallAmount) * 0.7;
    }
}

function updateElfJumpAndSwim(elf, deltaMs) {
    if (!elf || !elf.group) return;

    const inRiver = isInRiver(elf.group.position.x, elf.group.position.z, 0.8);

    if (elf.canJump) {
        if (!elf.isJumping) {
            elf.jumpCooldown = (elf.jumpCooldown || 0) - deltaMs;
            const jumpChance = inRiver ? 0.018 : 0.0035;
            if (elf.jumpCooldown <= 0 && Math.random() < jumpChance) {
                elf.isJumping = true;
                elf.jumpVelocity = inRiver ? 0.13 : 0.09;
                elf.jumpCooldown = inRiver ? 700 : 1300;
            }
        }

        if (elf.isJumping) {
            elf.jumpHeight = (elf.jumpHeight || 0) + elf.jumpVelocity;
            elf.jumpVelocity -= 0.008;
            if (elf.jumpHeight <= 0) {
                elf.jumpHeight = 0;
                elf.isJumping = false;
            }
        }
    }

    if (elf.animationState === 'death') return;

    const swimBob = inRiver
        ? Math.sin(Date.now() * 0.009 + (elf.isKing ? 1.8 : 0)) * 0.08
        : Math.sin(Date.now() * 0.0012 + (elf.isKing ? 0.5 : 0)) * 0.06;
    const baseY = inRiver ? 0.82 : 1;
    elf.group.position.y = baseY + swimBob + (elf.jumpHeight || 0);
}

// Movement system
const keys = {};
const dragonDebugShortcut = {
    dTapCount: 0,
    lastDTapAt: 0,
    armedUntil: 0
};
function clearGameplayInput() {
    Object.keys(keys).forEach((k) => {
        keys[k] = false;
    });
}

function isMissionBlockedGameplayKey(e) {
    const key = e.key.toLowerCase();
    return key === 'w' || key === 'a' || key === 's' || key === 'd' ||
        key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright' ||
        e.code === 'Space';
}

window.addEventListener('keydown', (e) => {
    // Debug spawn shortcuts:
    // D + D + 1 => Fire Dragon
    // D + D + 2 => Wind Dragon
    const lowerKey = e.key.toLowerCase();
    const now = Date.now();

    if (lowerKey === 'd' && !e.repeat) {
        if (now - dragonDebugShortcut.lastDTapAt <= 450) {
            dragonDebugShortcut.dTapCount += 1;
        } else {
            dragonDebugShortcut.dTapCount = 1;
        }
        dragonDebugShortcut.lastDTapAt = now;

        // Arm combo for a short window after double tapping D
        if (dragonDebugShortcut.dTapCount >= 2) {
            dragonDebugShortcut.armedUntil = now + 1200;
            dragonDebugShortcut.dTapCount = 0;
        }
    }

    const dragonComboArmed = now <= dragonDebugShortcut.armedUntil;
    if (dragonComboArmed && (e.code === 'Digit1' || e.code === 'Digit2')) {
        e.preventDefault();
        dragonDebugShortcut.armedUntil = 0;
        if (e.code === 'Digit1') {
            createFireDragonEnemy();
        } else {
            createWindDragonEnemy();
        }

        const prompt = document.getElementById('interact-prompt');
        if (prompt) {
            prompt.textContent = e.code === 'Digit1'
                ? '🐉 Debug: Fire Dragon spawned (D + D + 1)'
                : '🐉 Debug: Wind Dragon spawned (D + D + 2)';
            prompt.style.color = '#9fd3ff';
            prompt.style.borderColor = '#9fd3ff';
            prompt.style.display = 'block';
            setTimeout(() => {
                prompt.style.display = 'none';
                prompt.style.color = '';
                prompt.style.borderColor = '';
            }, 1200);
        }
        return;
    }

    if (missionUIOpen && isMissionBlockedGameplayKey(e)) {
        e.preventDefault();
        return;
    }

    keys[lowerKey] = true;
    // Jump on spacebar
    if (e.code === 'Space' && !player.isJumping) {
        player.isJumping = true;
        player.velocityY = player.jumpForce;
    }
    
    // F key: tap = sword attack, hold (>=400ms) = dark energy
    if (e.code === 'KeyF') {
        player._fKeyDownTime = Date.now();
    }
    // Q key: water slash
    if (e.code === 'KeyQ' && player.hasWaterSlash && !magicDialogueOpen && !windDialogueOpen && !fireDialogueOpen) {
        fireWaterSlash();
    }
    // R key: wind slash
    if (e.code === 'KeyR' && player.hasWindSlash && !magicDialogueOpen && !windDialogueOpen && !fireDialogueOpen) {
        fireWindSlash();
    }
    // Interact with house / elder
    if (e.key.toLowerCase() === 'e') {
        player._eKeyDownTime = Date.now();
        if (missionUIOpen) { closeMissionUI(); return; }
        if (!playerInsideHouse) {
            const doorPos = new BABYLON.Vector3(HOUSE_POS.x, 2, HOUSE_POS.z + 4.75);
            if (BABYLON.Vector3.Distance(camera.position, doorPos) < 4) enterHouse();
        } else {
            const exitPos = new BABYLON.Vector3(0, 2, 605);
            const elfPos  = new BABYLON.Vector3(0, 2, 596.8);
            if (BABYLON.Vector3.Distance(camera.position, exitPos) < 3.5) { exitHouse(); return; }
            if (BABYLON.Vector3.Distance(camera.position, elfPos)  < 4.0) openMissionUI();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (missionUIOpen && isMissionBlockedGameplayKey(e)) {
        e.preventDefault();
        keys[e.key.toLowerCase()] = false;
        return;
    }

    keys[e.key.toLowerCase()] = false;
    // F key release: tap = sword, hold = dark energy
    if (e.code === 'KeyF') {
        const held = Date.now() - (player._fKeyDownTime || 0);
        if (held >= 400 && player.hasDarkEnergy && !magicDialogueOpen && !windDialogueOpen && !fireDialogueOpen) {
            const nowDE = Date.now();
            if (nowDE - player.lastDarkEnergy >= player.darkEnergyCooldown) {
                fireDarkEnergy();
                player.lastDarkEnergy = nowDE;
            }
        } else if (held < 400 && player.hasSword) {
            const now = Date.now();
            if (now - player.lastSwordAttack > player.swordCooldown) {
                performSwordAttack();
                player.lastSwordAttack = now;
            }
        }
        player._fKeyDownTime = 0;
    }
    // E key release: tap = interact, hold = fire slash
    if (e.code === 'KeyE') {
        const held = Date.now() - (player._eKeyDownTime || 0);
        if (held >= 400 && player.hasFireSlash && !magicDialogueOpen && !windDialogueOpen && !fireDialogueOpen) {
            fireFireSlash();
        } else if (held < 400) {
            if (missionUIOpen) { closeMissionUI(); }
            else if (!playerInsideHouse) {
                const doorPos = new BABYLON.Vector3(HOUSE_POS.x, 2, HOUSE_POS.z + 4.75);
                if (BABYLON.Vector3.Distance(camera.position, doorPos) < 4) enterHouse();
            } else {
                const exitPos = new BABYLON.Vector3(0, 2, 605);
                const elfPos  = new BABYLON.Vector3(0, 2, 596.8);
                if (BABYLON.Vector3.Distance(camera.position, exitPos) < 3.5) { exitHouse(); }
                else if (BABYLON.Vector3.Distance(camera.position, elfPos) < 4.0) openMissionUI();
            }
        }
        player._eKeyDownTime = 0;
    }
});

// Shared explosion materials (created once, reused across all explosions)
const _explosionMats = {};
function _getExplosionMat(colorKey) {
    if (_explosionMats[colorKey]) return _explosionMats[colorKey];
    const hexMap = { green: '#66BB6A', blue: '#42A5F5', purple: '#CE93D8', white: '#D8EEFF' };
    const hex = hexMap[colorKey] || hexMap.green;
    const m = new BABYLON.StandardMaterial('_expMat_' + colorKey, scene);
    const c = BABYLON.Color3.FromHexString(hex);
    m.diffuseColor  = c;
    m.emissiveColor = c.scale(1.2);
    m.backFaceCulling = false;
    _explosionMats[colorKey] = m;
    return m;
}

// Active explosion particles — updated in the render loop (no setInterval)
const activeExplosions = [];

function createExplosion(position, colorKey) {
    const particleCount = 8; // half as many — still looks good
    const mat = _getExplosionMat(colorKey || 'green');
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 0.22 + Math.random() * 0.14;
        const mesh = BABYLON.MeshBuilder.CreateBox('_exp_' + Math.random(), { size: 0.35 }, scene);
        mesh.position.copyFrom(position);
        mesh.material = mat;
        mesh.isPickable = false;
        activeExplosions.push({
            mesh,
            vx: Math.cos(angle) * speed,
            vy: 0.28 + Math.random() * 0.12,
            vz: Math.sin(angle) * speed,
            life: 1.0
        });
    }
}

function updateExplosions() {
    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        const p = activeExplosions[i];
        p.life -= 0.045;
        if (p.life <= 0) {
            p.mesh.dispose();
            activeExplosions.splice(i, 1);
            continue;
        }
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.015;
        const s = Math.max(0.05, p.life);
        p.mesh.scaling.setAll(s);
        p.mesh.material.alpha = p.life;
    }
}

// Function to draw minimap
function drawMinimap() {
    // Clear minimap with dark background
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    
    // Draw grid
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    minimapCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const line = (MINIMAP_SIZE / 4) * i;
        minimapCtx.beginPath();
        minimapCtx.moveTo(line, 0);
        minimapCtx.lineTo(line, MINIMAP_SIZE);
        minimapCtx.stroke();
        minimapCtx.beginPath();
        minimapCtx.moveTo(0, line);
        minimapCtx.lineTo(MINIMAP_SIZE, line);
        minimapCtx.stroke();
    }
    
    // Helper function to convert world coordinates to minimap coordinates
    function worldToMinimap(x, z) {
        return {
            x: MINIMAP_CENTER + (x * MINIMAP_SCALE),
            y: MINIMAP_CENTER + (z * MINIMAP_SCALE)
        };
    }
    
    // Draw trees
    minimapCtx.fillStyle = '#228B22';
    treePositions.forEach(pos => {
        const mm = worldToMinimap(pos[0], pos[1]);
        minimapCtx.beginPath();
        minimapCtx.arc(mm.x, mm.y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    
    // Draw zombies
    minimapCtx.fillStyle = '#FF4444';
    zombies.forEach(zombie => {
        const mm = worldToMinimap(zombie.group.position.x, zombie.group.position.z);
        minimapCtx.beginPath();
        minimapCtx.arc(mm.x, mm.y, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    
    // Draw player (in center, slightly larger)
    minimapCtx.fillStyle = '#FFFF00';
    minimapCtx.beginPath();
    minimapCtx.arc(MINIMAP_CENTER, MINIMAP_CENTER, 4, 0, Math.PI * 2);
    minimapCtx.fill();
    
    // Draw player direction indicator
    minimapCtx.strokeStyle = '#FFFF00';
    minimapCtx.lineWidth = 2;
    const dirLength = 12;
    const dirX = MINIMAP_CENTER + Math.sin(cameraRotation.y) * dirLength;
    const dirZ = MINIMAP_CENTER + Math.cos(cameraRotation.y) * dirLength;
    minimapCtx.beginPath();
    minimapCtx.moveTo(MINIMAP_CENTER, MINIMAP_CENTER);
    minimapCtx.lineTo(dirX, dirZ);
    minimapCtx.stroke();
    
    // Draw border
    minimapCtx.strokeStyle = '#FFFFFF';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
}

// ===== PLAYER SWORD MECHANICS =====
// Create a sword for the player (matching elf sword style)
function createPlayerSword() {
    if (player.sword) {
        player.sword.meshes.forEach(m => m.dispose());
        if (player.sword.swordRoot) player.sword.swordRoot.dispose();
    }

    const swordRoot = new BABYLON.TransformNode('playerSwordRoot', scene);
    swordRoot.parent = camera;
    // Right side, slightly below center — blade points forward along +Z
    swordRoot.position = new BABYLON.Vector3(0.28, -0.44, 0.45);
    // rotation.x = +PI/2 makes local Y point toward camera +Z (forward)
    swordRoot.rotation.x = Math.PI / 2 - 0.15; // blade forward, tip slightly up
    swordRoot.rotation.y = 0.65;                // resting position: far right

    // Materials matching reference image
    const brownMat = new BABYLON.StandardMaterial('pBrown', scene);
    brownMat.diffuseColor  = new BABYLON.Color3(0.35, 0.18, 0.05);
    brownMat.emissiveColor = new BABYLON.Color3(0.12, 0.06, 0.01);

    const goldMat = new BABYLON.StandardMaterial('pGold', scene);
    goldMat.diffuseColor  = new BABYLON.Color3(0.85, 0.65, 0.05);
    goldMat.emissiveColor = new BABYLON.Color3(0.30, 0.22, 0.01);
    goldMat.specularColor = new BABYLON.Color3(1, 0.9, 0.3);

    const bladeMat = new BABYLON.StandardMaterial('pBlade', scene);
    bladeMat.diffuseColor  = new BABYLON.Color3(0.72, 0.76, 0.82);
    bladeMat.emissiveColor = new BABYLON.Color3(0.22, 0.24, 0.28);
    bladeMat.specularColor = new BABYLON.Color3(1, 1, 1);
    bladeMat.specularPower = 64;

    const mk = (name, opts, mat, pos) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, opts, scene);
        m.parent = swordRoot;
        m.position = new BABYLON.Vector3(...pos);
        m.material = mat;
        m.isPickable = false;
        return m;
    };

    // Pommel (bottom — closest to player, negative Z from root)
    const pommel     = mk('pPommel',   { width: 0.14, height: 0.12, depth: 0.14 }, goldMat,  [0,  0.00, 0]);
    // Grip (brown)
    const grip       = mk('pGrip',     { width: 0.09, height: 0.26, depth: 0.09 }, brownMat, [0,  0.22, 0]);
    // Crossguard (wide gold bar)
    const crossguard = mk('pCG',       { width: 0.36, height: 0.10, depth: 0.10 }, goldMat,  [0,  0.44, 0]);
    // Blade (gray — extends forward toward enemy)
    const blade      = mk('pBlade',    { width: 0.09, height: 0.82, depth: 0.09 }, bladeMat, [0,  0.91, 0]);
    // Blade tip (slightly narrower)
    const tip        = mk('pTip',      { width: 0.055, height: 0.14, depth: 0.055 }, bladeMat, [0, 1.37, 0]);

    player.sword = {
        swordRoot,
        grip, pommel, crossguard, blade, tip,
        meshes: [pommel, grip, crossguard, blade, tip]
    };
    player.hasSword = true;
}

function createPlayerSwimArms() {
    if (player.swimArms && player.swimArms.root) {
        player.swimArms.root.dispose();
    }

    const root = new BABYLON.TransformNode('playerSwimArmsRoot', scene);
    root.parent = camera;
    root.position = new BABYLON.Vector3(0, -0.58, 0.60);

    const skinMat = new BABYLON.StandardMaterial('swimSkinMat', scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.92, 0.66, 0.42);
    skinMat.emissiveColor = new BABYLON.Color3(0.22, 0.12, 0.06);

    const armL = BABYLON.MeshBuilder.CreateBox('swimArmL', { width: 0.14, height: 0.22, depth: 0.40 }, scene);
    armL.parent = root;
    armL.position = new BABYLON.Vector3(-0.24, -0.02, 0.08);
    armL.rotation.x = -0.55;
    armL.material = skinMat;
    armL.isPickable = false;

    const armR = BABYLON.MeshBuilder.CreateBox('swimArmR', { width: 0.14, height: 0.22, depth: 0.40 }, scene);
    armR.parent = root;
    armR.position = new BABYLON.Vector3(0.24, -0.02, 0.08);
    armR.rotation.x = -0.55;
    armR.material = skinMat;
    armR.isPickable = false;

    const handL = BABYLON.MeshBuilder.CreateBox('swimHandL', { width: 0.12, height: 0.10, depth: 0.16 }, scene);
    handL.parent = root;
    handL.position = new BABYLON.Vector3(-0.24, -0.12, 0.30);
    handL.rotation.x = -0.40;
    handL.material = skinMat;
    handL.isPickable = false;

    const handR = BABYLON.MeshBuilder.CreateBox('swimHandR', { width: 0.12, height: 0.10, depth: 0.16 }, scene);
    handR.parent = root;
    handR.position = new BABYLON.Vector3(0.24, -0.12, 0.30);
    handR.rotation.x = -0.40;
    handR.material = skinMat;
    handR.isPickable = false;

    root.setEnabled(false);
    player.swimArms = { root, armL, armR, handL, handR };
}

function updatePlayerSwimArms() {
    if (!player.swimArms || !player.swimArms.root) return;

    const t = Date.now() * 0.006;
    const stroke = Math.sin(t);

    player.swimArms.armL.rotation.x = -0.62 + stroke * 0.26;
    player.swimArms.armR.rotation.x = -0.62 - stroke * 0.26;
    player.swimArms.handL.rotation.x = -0.38 + stroke * 0.18;
    player.swimArms.handR.rotation.x = -0.38 - stroke * 0.18;

    player.swimArms.armL.position.y = -0.02 + Math.abs(stroke) * 0.03;
    player.swimArms.armR.position.y = -0.02 + Math.abs(stroke) * 0.03;
}

// Perform sword attack — diagonal slash + yellow arc trail
function performSwordAttack() {
    if (!player.sword || !player.hasSword) return;

    player.lastDamagedZombies.clear();

    const root = player.sword.swordRoot;
    const startRotY = root.rotation.y;
    const startRotX = root.rotation.x;
    const swingDuration = 320;
    const startTime = Date.now();

    // ---- Yellow arc trail (screen-space quads parented to camera) ----
    const trailMat = new BABYLON.StandardMaterial('slashTrail_' + Date.now(), scene);
    trailMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.0);
    trailMat.emissiveColor = new BABYLON.Color3(1.0, 0.75, 0.0);
    trailMat.alpha = 0.82;
    trailMat.backFaceCulling = false;

    const trailPieces = [];
    const numPieces = 8;
    for (let i = 0; i < numPieces; i++) {
        const t = i / (numPieces - 1);
        const sz = 0.05 + t * 0.10;
        const p = BABYLON.MeshBuilder.CreateBox('trail_' + i + '_' + Date.now(),
            { width: sz * 2.6, height: sz, depth: 0.01 }, scene);
        p.parent = camera;
        // Arc sweeps from right to left across the screen
        const arcAngle = 0.8 - t * 1.8;  // right (+) to left (-)
        const arcR = 0.48;
        p.position = new BABYLON.Vector3(
            0.32 + Math.cos(arcAngle) * arcR,
            -0.15,
            1.02
        );
        p.rotation.z = arcAngle;
        p.material = trailMat;
        p.isPickable = false;
        trailPieces.push(p);
    }

    // Fade out trail over 260ms
    const trailBorn = Date.now();
    const fadeTrail = () => {
        const alpha = Math.max(0, 0.82 * (1 - (Date.now() - trailBorn) / 260));
        trailMat.alpha = alpha;
        if (alpha > 0) {
            requestAnimationFrame(fadeTrail);
        } else {
            trailPieces.forEach(p => p.dispose());
            trailMat.dispose();
        }
    };
    requestAnimationFrame(fadeTrail);

    // ---- Swing animation: snap to far right, sweep left ----
    const animateSwing = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / swingDuration, 1);
        // Linear sweep from +0.65 (right) to -1.0 (left)
        root.rotation.y = 0.65 - progress * 1.65;
        root.rotation.x = startRotX - Math.sin(progress * Math.PI) * 0.18;
        if (progress < 1) {
            requestAnimationFrame(animateSwing);
        } else {
            root.rotation.y = 0.65; // snap back to resting right position
            root.rotation.x = startRotX;
        }
    };
    requestAnimationFrame(animateSwing);

    // Hit detection
    const swordReach = 2.5;
    zombies.forEach(zombie => {
        const dist = BABYLON.Vector3.Distance(camera.position, zombie.group.position);
        if (dist < swordReach && !player.lastDamagedZombies.has(zombie)) {
            zombie.health -= 2;
            updateZombieHealthBar(zombie);
            player.lastDamagedZombies.add(zombie);
            if (zombie.isNecromancer) awardDarkEnergy();
            if (zombie.health <= 0) {
                zombie.isDead = true;
                onZombieKilled();
            }
        }
    });
}

// Camera rotation with arrow keys
let cameraRotation = { x: 0, y: 0 };
const rotationSpeed = 0.02;

// Main game loop
engine.runRenderLoop(() => {
    // Pause gameplay during magic/wind dialogue (but still render)
    if (magicDialogueOpen || windDialogueOpen || fireDialogueOpen) {
        drawMinimap();
        scene.render();
        return;
    }

    // Handle cutscene
    if (cutsceneActive) {
        cutsceneTimer += engine.getDeltaTime();

        // ===== KING SWOOP CUTSCENE =====
        if (kingSwoopActive) {
            kingSwoopTimer += engine.getDeltaTime();
            const king = elves.find(e => e.isKing);

            // Phase A (0-2s): King sprints to player
            if (kingSwoopTimer < 2000 && king) {
                const toPlayer = camera.position.subtract(king.group.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();
                if (dist > 1.5) {
                    toPlayer.normalize();
                    king.group.position.addInPlace(toPlayer.scale(0.45));
                    king.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
                    king.animationState = 'run';
                    king._animMult = 2.0;
                }
            }

            // Phase B (2-5s): King carries player — camera follows king toward camp
            if (kingSwoopTimer >= 2000 && kingSwoopTimer < 5000 && king) {
                const campCenter = campGroup ? campGroup.position : new BABYLON.Vector3(HOUSE_POS.x, 0, HOUSE_POS.z);
                const tocamp = campCenter.subtract(king.group.position);
                tocamp.y = 0;
                tocamp.normalize();
                king.group.position.addInPlace(tocamp.scale(0.38));
                king.group.rotation.y = Math.atan2(tocamp.x, tocamp.z);
                king.animationState = 'run';
                king._animMult = 1.6;
                // Camera tracks king from behind
                camera.position.x = king.group.position.x - tocamp.x * 3;
                camera.position.z = king.group.position.z - tocamp.z * 3;
                camera.position.y = 3.5;
                player.currentY = 3.5;
            }

            // Phase C (5s+): Teleport player inside house, restore health to 1
            if (kingSwoopTimer >= 5000 && !kingSwoopDone) {
                kingSwoopDone = true;
                player.health = 1;
                updateHealthBar();
                camera.position = new BABYLON.Vector3(0, 2, 604);
                cameraRotation.x = 0;
                cameraRotation.y = Math.PI;
                player.currentY = 2;
                player.isJumping = false;
                player.velocityY = 0;
                playerInsideHouse = true;

                // Reposition king outside the house
                if (king) {
                    const campCenter = campGroup ? campGroup.position : new BABYLON.Vector3(HOUSE_POS.x, 0, HOUSE_POS.z);
                    king.group.position = new BABYLON.Vector3(campCenter.x, 1, campCenter.z + 8);
                    king.animationState = 'idle';
                    king._animMult = 0.35;
                }

                setTimeout(() => {
                    kingSwoopActive = false;
                    kingSwoopTimer = 0;
                    cutsceneActive = false;
                    cutsceneResetDone = false;
                }, 1000);
            }

            updateElfAnimation(king || elves[0], engine.getDeltaTime());
            scene.render();
            return;
        }
        
        // Phase 1: Elves approach and attack zombies (0-3 seconds)
        if (cutsceneTimer < 3000) {
            elves.forEach(elf => {
                // Find nearest zombie
                if (!elf.targetZombie && zombies.length > 0) {
                    let nearestZombie = zombies[0];
                    let minDist = Infinity;
                    zombies.forEach(z => {
                        const dist = BABYLON.Vector3.Distance(elf.group.position, z.group.position);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestZombie = z;
                        }
                    });
                    elf.targetZombie = nearestZombie;
                }
                
                // Move elf toward target
                if (elf.targetZombie) {
                    const targetPos = elf.targetZombie.group.position;
                    const direction = targetPos.subtract(elf.group.position);
                    direction.normalize();
                    elf.group.position.addInPlace(direction.scale(0.3));

                    // Face target
                    elf.group.rotation.y = Math.atan2(direction.x, direction.z);

                    // Set animation state
                    const distance = BABYLON.Vector3.Distance(elf.group.position, targetPos);
                    elf.animationState = distance < 3 ? 'attack' : 'run';

                    // Remove zombie if close enough
                    if (distance < 2) {
                        if (elf.targetZombie.healthBar && elf.targetZombie.healthBar.barGroup) {
                            elf.targetZombie.healthBar.barGroup.dispose();
                        }
                        createExplosion(targetPos, elf.targetZombie.type);
                        elf.targetZombie.group.dispose();
                        zombies.splice(zombies.indexOf(elf.targetZombie), 1);
                        elf.targetZombie = null;
                    }
                }
            });
        }
        
        // Phase 2: Move to camp (3-8 seconds) — stop once Phase 3 has teleported player inside
        if (cutsceneTimer >= 3000 && !cutsceneResetDone) {
            const campPos = campGroup.position;
            const direction = campPos.subtract(camera.position);
            direction.normalize();
            
            // Move camera toward camp
            camera.position.addInPlace(direction.scale(0.5));
            player.currentY += direction.y * 0.5;
            
            // Move elves toward camp
            elves.forEach(elf => {
                const elfDir = campPos.subtract(elf.group.position);
                elfDir.normalize();
                elf.group.position.addInPlace(elfDir.scale(0.3));
                elf.group.rotation.y = Math.atan2(elfDir.x, elfDir.z);
                elf.animationState = 'run';
            });
        }
        
        // Phase 3: End cutscene and reset (8+ seconds) — runs once via flag
        if (cutsceneTimer >= 8000 && !cutsceneResetDone) {
            cutsceneResetDone = true;
            player.health = 3;
            updateHealthBar();
            // Teleport player inside the elder's house facing the elder
            camera.position = new BABYLON.Vector3(0, 2, 604);
            cameraRotation.x = 0;
            cameraRotation.y = Math.PI;
            player.currentY = 2;
            player.isJumping = false;
            player.velocityY = 0;
            playerInsideHouse = true;

            // Scatter elves near camp so wandering starts from sensible spots
            const campCenter = campGroup.position;
            elves.forEach((elf, idx) => {
                if (elf.isKing) {
                    // King stands in front of house, not inside it
                    elf.group.position = new BABYLON.Vector3(campCenter.x, 1, campCenter.z + 8);
                } else {
                    const a = (Math.PI * 2 * idx) / (elves.length - 1);
                    elf.group.position = new BABYLON.Vector3(
                        campCenter.x + Math.cos(a) * 8,
                        1,
                        campCenter.z + Math.sin(a) * 8
                    );
                    // Assign initial wander target
                    elf.wanderTarget = safeCampPos(campCenter.x, campCenter.z, 18);
                    elf.wanderTimer = 0;
                }
                elf.targetZombie = null;
                elf.returning = false;
            });

            // Remove all zombies and reset spawn
            zombies.forEach(z => {
                if (z.healthBar && z.healthBar.barGroup) {
                    z.healthBar.barGroup.dispose();
                }
                z.group.dispose();
            });
            zombies.length = 0;
            spawnTimer = 0;
            
            // Clear cutscene after 2 more seconds at camp
            setTimeout(() => {
                clearCutscene();
            }, 2000);
        }
        
        // Don't process normal gameplay during cutscene
        scene.render();
        return;
    }

    // Interaction prompt
    if (Date.now() > promptLockedUntil) {
        const _prompt = document.getElementById('interact-prompt');
        if (!playerInsideHouse) {
            const doorPos = new BABYLON.Vector3(HOUSE_POS.x, 2, HOUSE_POS.z + 4.75);
            if (BABYLON.Vector3.Distance(camera.position, doorPos) < 4) {
                _prompt.textContent = 'Press [E] to Enter';
                _prompt.style.display = 'block';
            } else {
                _prompt.style.display = 'none';
            }
        } else if (!missionUIOpen) {
            const elfPos  = new BABYLON.Vector3(0, 2, 596.8);
            const exitPos = new BABYLON.Vector3(0, 2, 605);
            if (BABYLON.Vector3.Distance(camera.position, elfPos) < 4) {
                _prompt.textContent = 'Press [E] to Talk to Elder Thornwood';
                _prompt.style.display = 'block';
            } else if (BABYLON.Vector3.Distance(camera.position, exitPos) < 3.5) {
                _prompt.textContent = 'Press [E] to Exit';
                _prompt.style.display = 'block';
            } else {
                _prompt.style.display = 'none';
            }
        }
    }

    // Update zombie spawning
    spawnTimer += engine.getDeltaTime();
    if (!playerInsideHouse && spawnTimer >= SPAWN_INTERVAL) {
        createZombie();
        spawnTimer = 0;
    } else if (playerInsideHouse) {
        spawnTimer = 0;
    }

    // Update zombies
    zombies.forEach((zombie, index) => {
        if (playerInsideHouse) return; // freeze zombies while player is inside
        const dt = engine.getDeltaTime();

        // Death animation — play then dispose
        if (zombie.health <= 0) {
            if (zombie.animationState !== 'death') {
                zombie.animationState = 'death';
                zombie.deathTimer = 0;
                onZombieKilled();
                if (kingDarkElfTarget === zombie) kingDarkElfTarget = null;
                // Clear soldier reference
                if (zombie.isSoldier) {
                    zombieSoldier = null;
                }
                // Soldier Elf killed — fire dragon descends and teaches fire slash
                if (zombie.isSoldierElf) {
                    soldierElf = null;
                    if (!player.hasFireSlash) {
                        setTimeout(() => openFireDialogue(), 2500);
                    }
                }
                // Necromancer killed — clear reference
                if (zombie.isNecromancer) {
                    necromancer = null;
                }
                // Fire/wind dragon killed — give longer death window for sprite\n                if (zombie.isFireDragon || zombie.isWindDragon) {\n                    zombie.deathTimer = -500;\n                }
            }
            zombie.deathTimer += dt;
            updateZombieAnimation(zombie, dt);
            if (zombie.deathTimer > (zombie.isFireDragon || zombie.isWindDragon ? DRAGON_COLS * DRAGON_FRAME_DUR : 900)) {
                if (zombie.healthBar && zombie.healthBar.barGroup) zombie.healthBar.barGroup.dispose();
                zombie.group.dispose();
                zombies.splice(index, 1);
            }
            return;
        }

        // Horde leadership: zombies near the soldier move faster
        const baseSpeed = zombie.isSoldier ? zombie.speed :
            (zombieSoldier && !zombieSoldier.isDead &&
             BABYLON.Vector3.Distance(zombie.group.position, zombieSoldier.group.position) < 25)
                ? zombie.speed * 1.5
                : zombie.speed;

        // Move zombie toward player
        const toPlayer = camera.position.subtract(zombie.group.position);
        const distance = toPlayer.length();

        if (zombie.isDarkElf) {
            const now = Date.now();
            if (distance < 14 && now - (zombie.lastCorruptedWater || 0) > 3200) {
                zombie.lastCorruptedWater = now;
                spawnCorruptedWaterBolt(
                    zombie.group.position.add(new BABYLON.Vector3(0, 0.8, 0)),
                    camera.position.clone()
                );
            }
        }

        if (distance > 0.5) {
            toPlayer.normalize();
            const nextX = zombie.group.position.x + toPlayer.x * baseSpeed;
            const nextZ = zombie.group.position.z + toPlayer.z * baseSpeed;
            const blockedByRiver = !zombie.isDarkElf && isInRiver(nextX, nextZ, 1.4);
            if (!blockedByRiver) {
                zombie.group.position.x = nextX;
                zombie.group.position.z = nextZ;
            }
        }

        // Make zombie look at player
        const direction = camera.position.subtract(zombie.group.position);
        zombie.group.rotation.y = Math.atan2(direction.x, direction.z);

        // Set animation state by distance
        if (distance <= 2.0) {
            zombie.animationState = 'attack';
        } else if (distance > 0.5) {
            zombie.animationState = 'walk';
        } else {
            zombie.animationState = 'idle';
        }

        updateZombieAnimation(zombie, dt);

        if (zombie.isDarkElf && zombie.health > 0 && !zombie.isDead) {
            const inRiver = isInRiver(zombie.group.position.x, zombie.group.position.z, 0.8);

            if (!zombie.isJumping) {
                zombie.jumpCooldown = (zombie.jumpCooldown || 0) - dt;
                const jumpChance = inRiver ? 0.02 : 0.004;
                if (zombie.jumpCooldown <= 0 && Math.random() < jumpChance) {
                    zombie.isJumping = true;
                    zombie.jumpVelocity = inRiver ? 0.12 : 0.09;
                    zombie.jumpCooldown = inRiver ? 650 : 1200;
                }
            }

            if (zombie.isJumping) {
                zombie.jumpHeight = (zombie.jumpHeight || 0) + zombie.jumpVelocity;
                zombie.jumpVelocity -= 0.008;
                if (zombie.jumpHeight <= 0) {
                    zombie.jumpHeight = 0;
                    zombie.isJumping = false;
                }
            }

            const swimBob = inRiver ? Math.sin(Date.now() * 0.01 + index) * 0.07 : 0;
            const baseY = zombie._baseY || 1;
            zombie.group.position.y = baseY + (zombie.jumpHeight || 0) + swimBob;
        }

        // Remove if too far
        if (distance > 150) {
            if (kingDarkElfTarget === zombie) kingDarkElfTarget = null;
            if (zombie.healthBar && zombie.healthBar.barGroup) zombie.healthBar.barGroup.dispose();
            zombie.group.dispose();
            zombies.splice(index, 1);
        }
    });

    // Update elf animations + AI (always active)
    elves.forEach(elf => {
        if (!cutsceneActive) {
            // Find nearest zombie
            let nearest = null;
            let minDist = Infinity;
            zombies.forEach(z => {
                if (z.health > 0) {
                    const d = BABYLON.Vector3.Distance(elf.group.position, z.group.position);
                    if (d < minDist) { minDist = d; nearest = z; }
                }
            });

            const campCenter = campGroup ? campGroup.position : new BABYLON.Vector3(HOUSE_POS.x, 0, HOUSE_POS.z);

            if (elf.isKing) {
                if (kingDarkElfTarget && kingDarkElfTarget.health > 0 && !kingDarkElfTarget.isDead) {
                    const target = kingDarkElfTarget;
                    const kDiff = target.group.position.subtract(elf.group.position);
                    kDiff.y = 0;
                    const kDist = kDiff.length();
                    const kDir = kDist > 0.0001 ? kDiff.normalize() : new BABYLON.Vector3(0, 0, 1);

                    if (kDist > 2.2) {
                        elf.group.position.addInPlace(kDir.scale(0.24));
                        elf.group.rotation.y = Math.atan2(kDir.x, kDir.z);
                        elf.animationState = 'run';
                        elf._animMult = 1.1;
                    } else {
                        elf.animationState = 'attack';
                        if (!elf._kingTapCooldown) elf._kingTapCooldown = 0;
                        elf._kingTapCooldown -= engine.getDeltaTime();
                        if (elf._kingTapCooldown <= 0) {
                            target.kingTapHitsRemaining = (target.kingTapHitsRemaining || 2) - 1;
                            createExplosion(target.group.position, 'white');
                            if (target.kingTapHitsRemaining <= 0) {
                                target.health = 0;
                                target.isDead = true;
                                kingDarkElfTarget = null;
                            }
                            elf._kingTapCooldown = 280;
                        }
                    }

                    updateElfJumpAndSwim(elf, engine.getDeltaTime());
                    updateElfAnimation(elf, engine.getDeltaTime());
                    return;
                }

                // King wanders slowly around the front of the house
                const kingHome = new BABYLON.Vector3(campCenter.x, 1, campCenter.z + 8);
                if (!elf.wanderTarget) {
                    elf.wanderTarget = kingHome.clone();
                    elf.wanderTimer = 0;
                }
                if (!elf.wanderTimer) elf.wanderTimer = 0;
                elf.wanderTimer += engine.getDeltaTime();

                const kDiff = new BABYLON.Vector3(
                    elf.wanderTarget.x - elf.group.position.x, 0,
                    elf.wanderTarget.z - elf.group.position.z
                );
                const kDist = kDiff.length();

                // New wander target every 7 seconds or when close, within 10 units of home
                if (kDist < 0.5 || elf.wanderTimer > 7000) {
                    elf.wanderTimer = 0;
                    elf.wanderTarget = safeCampPos(kingHome.x, kingHome.z, 8);
                }

                if (kDist > 0.5) {
                    const kDir = kDiff.normalize();
                    // Avoid house collision
                    const newKX = elf.group.position.x + kDir.x * 0.04;
                    const newKZ = elf.group.position.z + kDir.z * 0.04;
                    const hDx = newKX - HOUSE_POS.x, hDz = newKZ - HOUSE_POS.z;
                    if (Math.sqrt(hDx * hDx + hDz * hDz) > 5.5) {
                        elf.group.position.x = newKX;
                        elf.group.position.z = newKZ;
                    } else {
                        elf.wanderTimer = 6999; // pick new target
                    }
                    elf.group.rotation.y = Math.atan2(kDir.x, kDir.z);
                    elf.animationState = 'run';
                    elf._animMult = 0.35;
                    elf._animMult = 0.35;
                } else {
                    // Idle facing player
                    elf.group.rotation.y = Math.atan2(
                        camera.position.x - elf.group.position.x,
                        camera.position.z - elf.group.position.z
                    );
                    elf.animationState = 'idle';
                }
            } else if (nearest && minDist < 18) {
                // Regular elves flee from zombie soldier; they only fight normal zombies
                if (nearest.isSoldier) {
                    // Flee in opposite direction
                    const fleeDir = elf.group.position.subtract(nearest.group.position);
                    fleeDir.y = 0;
                    fleeDir.normalize();
                    const fleeX = elf.group.position.x + fleeDir.x * 0.18;
                    const fleeZ = elf.group.position.z + fleeDir.z * 0.18;
                    const hFleeDx = fleeX - HOUSE_POS.x, hFleeDz = fleeZ - HOUSE_POS.z;
                    if (Math.sqrt(hFleeDx * hFleeDx + hFleeDz * hFleeDz) > 10) {
                        elf.group.position.x = fleeX;
                        elf.group.position.z = fleeZ;
                    }
                    elf.group.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
                    elf.animationState = 'run';
                    elf._animMult = 1.4;
                } else {
                    // Chase and attack normal zombie
                    elf.returning = false;
                    const dir = nearest.group.position.subtract(elf.group.position);
                    dir.normalize();
                    elf.group.rotation.y = Math.atan2(dir.x, dir.z);

                    if (minDist > 2.2) {
                        elf.group.position.addInPlace(dir.scale(0.156));
                        elf.animationState = 'run';
                        elf._animMult = 1.0;
                    } else {
                        elf.animationState = 'attack';
                        if (!elf._attackCooldown) elf._attackCooldown = 0;
                        elf._attackCooldown -= engine.getDeltaTime();
                        if (elf._attackCooldown <= 0) {
                            if (nearest.isDarkElf && Math.random() < DARK_ELF_ELF_WIN_CHANCE) {
                                onDarkElfDefeatedElf(nearest, elf);
                                return;
                            }

                            nearest.health -= 1;
                            updateZombieHealthBar(nearest);
                            elf._attackCooldown = 300;
                            // When enemy dies, flag elf to return to camp
                            if (nearest.health <= 0) {
                                elf.returning = true;
                                elf.wanderTimer = 0;
                                elf.wanderTarget = safeCampPos(campCenter.x, campCenter.z, 18);
                            }
                        }
                    }
                }
            } else {
                // No zombie nearby — wander around camp
                if (!elf.wanderTarget) {
                    elf.wanderTarget = safeCampPos(campCenter.x, campCenter.z, 18);
                    elf.wanderTimer = 0;
                }

                if (!elf.wanderTimer) elf.wanderTimer = 0;
                elf.wanderTimer += engine.getDeltaTime();

                const diff = new BABYLON.Vector3(
                    elf.wanderTarget.x - elf.group.position.x,
                    0,
                    elf.wanderTarget.z - elf.group.position.z
                );
                const distToTarget = diff.length();

                // Pick a new target when close enough or every 6 seconds
                if (distToTarget < 0.5 || elf.wanderTimer > 6000) {
                    elf.wanderTimer = 0;
                    elf.returning = false;
                    elf.wanderTarget = safeCampPos(campCenter.x, campCenter.z, 18);
                }

                if (distToTarget > 0.5) {
                    const dir = diff.normalize();
                    const newX = elf.group.position.x + dir.x * 0.06;
                    const newZ = elf.group.position.z + dir.z * 0.06;

                    // Avoid house
                    const houseDx = newX - HOUSE_POS.x;
                    const houseDz = newZ - HOUSE_POS.z;
                    const houseDist = Math.sqrt(houseDx * houseDx + houseDz * houseDz);
                    const houseRadius = 10;

                    // Avoid huts
                    let blockedByHut = false;
                    for (const hut of hutColliders) {
                        const hx = newX - hut.x, hz = newZ - hut.z;
                        if (Math.sqrt(hx * hx + hz * hz) < hut.radius) { blockedByHut = true; break; }
                    }

                    if (houseDist > houseRadius && !blockedByHut) {
                        elf.group.position.x = newX;
                        elf.group.position.z = newZ;
                        elf.group.rotation.y = Math.atan2(dir.x, dir.z);
                        elf.animationState = 'run';
                        elf._animMult = 0.35;
                    } else {
                        // Blocked — pick a new target immediately, don't spin
                        elf.wanderTarget = safeCampPos(campCenter.x, campCenter.z, 18);
                        elf.wanderTimer = 0;
                        elf.animationState = 'idle';
                    }
                } else {
                    elf.animationState = 'idle';
                }
            }
        }

        updateElfJumpAndSwim(elf, engine.getDeltaTime());
        updateElfAnimation(elf, engine.getDeltaTime());
    });

    // Update bush billboarding (face camera)
    bushes.forEach(bush => {
        const direction = bush.position.subtract(camera.position);
        bush.rotation.y = Math.atan2(direction.x, direction.z);
    });

    // Movement with WASD (disabled during cutscene)
    if (!cutsceneActive && !missionUIOpen) {
        const moveSpeed = 0.24; // 20% slower than original 0.3
        const movement = new BABYLON.Vector3(0, 0, 0);

        // Calculate direction vectors based on rotation
        const forward = new BABYLON.Vector3(
            Math.sin(cameraRotation.y),
            0,
            Math.cos(cameraRotation.y)
        );
        const right = new BABYLON.Vector3(
            Math.cos(cameraRotation.y),
            0,
            -Math.sin(cameraRotation.y)
        );

        // Handle WASD input
        if (keys['w']) {
            movement.x += forward.x * moveSpeed;
            movement.z += forward.z * moveSpeed;
        }
        if (keys['s']) {
            movement.x -= forward.x * moveSpeed;
            movement.z -= forward.z * moveSpeed;
        }
        if (keys['a']) {
            movement.x -= right.x * moveSpeed;
            movement.z -= right.z * moveSpeed;
        }
        if (keys['d']) {
            movement.x += right.x * moveSpeed;
            movement.z += right.z * moveSpeed;
        }

        // Apply movement with collision detection
        // Only test world geometry (no parent) — excludes all NPC/enemy body parts which are
        // parented to TransformNode groups, preventing the player from getting stuck inside them.
        const isSolidWall = (mesh) => mesh !== ground && mesh.parent == null;
        const newPosition = camera.position.add(movement);
        
        // Check collision in x direction
        if (movement.x !== 0) {
            const rayX = new BABYLON.Ray(camera.position, new BABYLON.Vector3(Math.sign(movement.x), 0, 0), 1.0);
            const hitX = scene.pickWithRay(rayX, isSolidWall);
            if (!hitX || !hitX.hit) {
                camera.position.x = newPosition.x;
            }
        } else {
            camera.position.x = newPosition.x;
        }
        
        // Check collision in z direction
        if (movement.z !== 0) {
            const rayZ = new BABYLON.Ray(camera.position, new BABYLON.Vector3(0, 0, Math.sign(movement.z)), 1.0);
            const hitZ = scene.pickWithRay(rayZ, isSolidWall);
            if (!hitZ || !hitZ.hit) {
                camera.position.z = newPosition.z;
            }
        } else {
            camera.position.z = newPosition.z;
        }

        // Swim state in river (lets player cross while adding water movement feel).
        const playerInRiver = isInRiver(camera.position.x, camera.position.z, 0.8);
        player.isSwimming = playerInRiver;
        player.groundLevel = playerInRiver ? 1.28 : 2;

        if (player.swimArms && player.swimArms.root) {
            player.swimArms.root.setEnabled(playerInRiver);
            if (playerInRiver) updatePlayerSwimArms();
        }
        if (player.sword && player.sword.swordRoot) {
            player.sword.swordRoot.setEnabled(!playerInRiver);
        }

        if (!player.isJumping) {
            if (playerInRiver) {
                const swimBob = Math.sin(Date.now() * 0.012) * 0.06;
                player.currentY = player.groundLevel + swimBob;
            } else {
                player.currentY = player.groundLevel;
            }
            camera.position.y = player.currentY;
        }

        // Arrow key camera rotation
        if (keys['arrowup']) {
            cameraRotation.x -= rotationSpeed;
        }
        if (keys['arrowdown']) {
            cameraRotation.x += rotationSpeed;
        }
        if (keys['arrowleft']) {
            cameraRotation.y += rotationSpeed;
        }
        if (keys['arrowright']) {
            cameraRotation.y -= rotationSpeed;
        }

        // Clamp vertical rotation to prevent flipping
        cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
    }

    // Apply rotation
    camera.rotation.x = cameraRotation.x;
    camera.rotation.y = cameraRotation.y;

    // Update jump physics
    if (player.isJumping) {
        player.velocityY -= player.gravity;
        player.currentY += player.velocityY;
        camera.position.y = player.currentY;
        
        // Check if landed
        if (player.currentY <= player.groundLevel) {
            player.currentY = player.groundLevel;
            camera.position.y = player.groundLevel;
            player.isJumping = false;
            player.velocityY = 0;
        }
    }

    // Check zombie collisions and jump-on-head detection
    zombies.forEach((zombie, index) => {
        if (zombie.isDead) return;
        
        const playerPos = camera.position;
        const zombiePos = zombie.group.position;
        const distanceXZ = Math.sqrt(
            Math.pow(playerPos.x - zombiePos.x, 2) +
            Math.pow(playerPos.z - zombiePos.z, 2)
        );
        
        // Jump-on-head detection (damage zombie)
        if (player.isJumping && player.currentY > 2.5 && distanceXZ < 1.0) {
            zombie.health--;
            updateZombieHealthBar(zombie);
            
            if (zombie.health <= 0) {
                zombie.isDead = true;
                onZombieKilled();
                createExplosion(zombiePos, zombie.type);
                if (zombie.healthBar && zombie.healthBar.barGroup) {
                    zombie.healthBar.barGroup.dispose();
                }
                zombie.group.dispose();
                zombies.splice(index, 1);
            }
            return;
        }
        
    // Zombie collision detection (damage player)
    // Reset hitPlayer when zombie steps back, so it can damage again on re-contact
    if (distanceXZ >= 2.0) zombie.hitPlayer = false;
    if (distanceXZ < 1.2 && !zombie.hitPlayer) {
        // Don't take damage if player is jumping on zombie or recently attacked with sword
        const isJumpingOnHead = player.isJumping && player.currentY > 2.5;

        // Zombie soldier attacks can be blocked by the king (50% chance if king is within 12 units)
        let blockedByKing = false;
        if (zombie.isSoldier && !isJumpingOnHead) {
            const king = elves.find(e => e.isKing);
            if (king) {
                const kingDist = BABYLON.Vector3.Distance(king.group.position, zombie.group.position);
                if (kingDist < 12 && Math.random() < 0.5) {
                    blockedByKing = true;
                    // King parry: swing swordArm sharply then reset
                    if (king.swordArm) {
                        king.swordArm.rotation.x = -1.4;
                        king.swordArm.rotation.z = 0.4;
                        king.animationState = 'attack';
                        setTimeout(() => {
                            if (king.swordArm) {
                                king.swordArm.rotation.x = -0.2;
                                king.swordArm.rotation.z = 0;
                                king.animationState = 'idle';
                            }
                        }, 400);
                    }
                    // Show block message briefly
                    const prompt = document.getElementById('interact-prompt');
                    prompt.textContent = '🛡 King blocked the attack!';
                    prompt.style.color = '#FFD700';
                    prompt.style.borderColor = '#FFD700';
                    prompt.style.display = 'block';
                    setTimeout(() => {
                        prompt.style.display = 'none';
                        prompt.style.color = '';
                        prompt.style.borderColor = '';
                    }, 1200);
                }
            }
        }

        if (!blockedByKing && !isJumpingOnHead && !player.lastDamagedZombies.has(zombie)) {
            const dmg = zombie.isDarkElf ? 2 : 1;
            player.health -= dmg;
            updateHealthBar();
        }
        zombie.hitPlayer = true;
        
        // Trigger rescue cutscene when player dies
        if (player.health <= 0 && !cutsceneActive) {
            if (zombie.isSoldier) {
                startKingSwoopCutscene();
            } else {
                startCutscene();
            }
        }
    }
    });

    // Sword is parented to camera — no per-frame position update needed

    // Show dark energy charge feedback while F is held
    if (player.hasDarkEnergy && player._fKeyDownTime && keys['f']) {
        const held = Date.now() - player._fKeyDownTime;
        const deText = document.getElementById('darkenergy-cooldown-text');
        if (deText && held < 400) {
            const pct = Math.floor((held / 400) * 100);
            deText.textContent = `(Charging ${pct}%)`;
            deText.style.color = '#f8f';
        }
    }

    // Dark energy fires on F keyup — no render loop combo needed

    // Update water slash projectiles
    updateWaterSlashProjectiles(engine.getDeltaTime());

    // Update corrupted water bolts (dark elf ranged attack)
    updateCorruptedWaterBolts(engine.getDeltaTime());

    // Update wind slash projectiles
    updateWindSlashProjectiles(engine.getDeltaTime());

    // Update fire slash projectiles
    updateFireSlashProjectiles(engine.getDeltaTime());

    // Update dark energy effects
    updateDarkEnergyEffects(engine.getDeltaTime());

    // Update fire dragon sprites
    updateFireDragonSprites(engine.getDeltaTime());

    // Update NPC fire dragon (fire dialogue scene)
    updateNpcFireDragon();

    // Update wind dragon sprites
    updateWindDragonSprites(engine.getDeltaTime());

    // Update NPC wind dragon (wind dialogue scene)
    updateNpcWindDragon();

    // Update dark energy HUD cooldown
    if (player.hasDarkEnergy) {
        const deEl = document.getElementById('darkenergy-cooldown-text');
        if (deEl && !keys['q']) {
            const elapsed = Date.now() - player.lastDarkEnergy;
            if (elapsed < player.darkEnergyCooldown) {
                deEl.textContent = `(${((player.darkEnergyCooldown - elapsed) / 1000).toFixed(1)}s)`;
                deEl.style.color = '#888';
            } else {
                deEl.textContent = '(Ready)';
                deEl.style.color = '#d8f';
            }
        }
    }

    // Update explosion particles
    updateExplosions();

    // Draw minimap
    drawMinimap();
    
    // Render the scene
    scene.render();
});

// Handle window resize
window.addEventListener('resize', () => {
    engine.resize();
});

// Prevent context menu on canvas
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
