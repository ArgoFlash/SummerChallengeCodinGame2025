// ==========================
// === CONSTANTES
// ==========================
const MAX_WIDTH = 20;
const MAX_HEIGHT = 20;
const MAX_AGENTS = 10;
const MAX_PLAYERS = 2;
const MAX_MOVES_PER_AGENT = 5;
const MAX_SHOOTS_PER_AGENT = 5;
const MAX_BOMB_PER_AGENT = 5;
const MAX_COMMANDS_PER_AGENT = 50;
const MAX_COMMANDS_PLAYER_ME = 300;     
const MAX_COMMANDS_PLAYER_ENEMIE = 64;  
const MAX_SIMULATIONS = 1024; 

// ==========================
// === ENUMS ET STRUCTURES
// ==========================
const ActionType = {
    CMD_SHOOT: 0,
    CMD_THROW: 1,
    CMD_HUNKER: 2
};

/**
 * Représente une action d'un agent (mouvement, tir, bombe)
 */
class AgentAction {
    constructor(targetXOrId = 0, targetY = 0, score = 0) {
        this.targetXOrId = targetXOrId;
        this.targetY = targetY;
        this.score = score;
    }
}

/**
 * Représente une commande complète pour un agent (déplacement + action)
 */
class AgentCommand {
    constructor(mvX = 0, mvY = 0, actionType = ActionType.CMD_HUNKER, targetXOrId = -1, targetY = -1, score = 0) {
        this.mvX = mvX;
        this.mvY = mvY;
        this.actionType = actionType;
        this.targetXOrId = targetXOrId;
        this.targetY = targetY;
        this.score = score;
    }
}

/**
 * Résultat d'une simulation de commandes
 */
class SimulationResult {
    constructor(score = 0, myCmdsIndex = 0, opCmdsIndex = 0) {
        this.score = score;
        this.myCmdsIndex = myCmdsIndex;
        this.opCmdsIndex = opCmdsIndex;
    }
}

/**
 * Structure de sortie contenant toutes les actions calculées
 */
class GameOutput {
    constructor() {
        // Distances BFS pré-calculées avec Int32Array pour performance
        this.bfsEnemyDistancesFlat = new Int32Array(MAX_AGENTS * MAX_HEIGHT * MAX_WIDTH);
        
        // Helper pour accéder aux distances BFS
        this.getBfsDistance = (agentId, y, x) => {
            return this.bfsEnemyDistancesFlat[agentId * MAX_HEIGHT * MAX_WIDTH + y * MAX_WIDTH + x];
        };
        
        this.setBfsDistance = (agentId, y, x, value) => {
            this.bfsEnemyDistancesFlat[agentId * MAX_HEIGHT * MAX_WIDTH + y * MAX_WIDTH + x] = value;
        };
        
        // Mouvements possibles par agent
        this.moves = Array(MAX_AGENTS).fill().map(() => Array(MAX_MOVES_PER_AGENT).fill().map(() => new AgentAction()));
        this.moveCounts = new Int32Array(MAX_AGENTS);
        
        // Tirs possibles par agent
        this.shoots = Array(MAX_AGENTS).fill().map(() => Array(MAX_SHOOTS_PER_AGENT).fill().map(() => new AgentAction()));
        this.shootCounts = new Int32Array(MAX_AGENTS);
        
        // Bombes possibles par agent
        this.bombs = Array(MAX_AGENTS).fill().map(() => Array(MAX_BOMB_PER_AGENT).fill().map(() => new AgentAction()));
        this.bombCounts = new Int32Array(MAX_AGENTS);
        
        // Commandes par agent
        this.agentCommands = Array(MAX_AGENTS).fill().map(() => 
            Array(MAX_COMMANDS_PER_AGENT).fill().map(() => new AgentCommand())
        );
        this.agentCommandCounts = new Int32Array(MAX_AGENTS);
        
        // Commandes par joueur
        this.playerCommands = Array(MAX_PLAYERS).fill().map(() => 
            Array(MAX_COMMANDS_PLAYER_ME).fill().map(() => Array(MAX_AGENTS).fill().map(() => new AgentCommand()))
        );
        this.playerCommandCount = new Int32Array(MAX_PLAYERS);
        
        // Résultats des simulations
        this.simulationResults = Array(MAX_SIMULATIONS).fill().map(() => new SimulationResult());
        this.simulationCount = 0;
    }
}

/**
 * Informations statiques d'un agent
 */
class AgentInfo {
    constructor(id = 0, playerId = 0, shootCooldown = 0, optimalRange = 0, soakingPower = 0, splashBombs = 0) {
        this.id = id;
        this.playerId = playerId;
        this.shootCooldown = shootCooldown;
        this.optimalRange = optimalRange;
        this.soakingPower = soakingPower;
        this.splashBombs = splashBombs;
    }
}

/**
 * Informations sur les agents d'un joueur
 */
class PlayerAgentInfo {
    constructor() {
        this.agentCount = 0;
        this.agentStartIndex = -1;
        this.agentStopIndex = -1;
    }
}

/**
 * Représente une case de la carte
 */
class Tile {
    constructor(x = 0, y = 0, type = 0) {
        this.x = x;
        this.y = y;
        this.type = type;
    }
}

/**
 * État actuel d'un agent
 */
class AgentState {
    constructor(id = 0, x = 0, y = 0, cooldown = 0, splashBombs = 0, wetness = 0, alive = 0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.cooldown = cooldown;
        this.splashBombs = splashBombs;
        this.wetness = wetness;
        this.alive = alive;
    }
}

/**
 * Informations de la carte
 */
class MapInfo {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.map = Array(MAX_HEIGHT).fill().map(() => Array(MAX_WIDTH).fill().map(() => new Tile()));
    }
}

/**
 * Constantes du jeu (ne changent pas pendant la partie)
 */
class GameConstants {
    constructor() {
        this.myPlayerId = 0;
        this.agentInfoCount = 0;
        this.agentInfo = Array(MAX_AGENTS).fill().map(() => new AgentInfo());
        this.playerInfo = Array(MAX_PLAYERS).fill().map(() => new PlayerAgentInfo());
        this.map = new MapInfo();
    }
}

/**
 * État actuel du jeu
 */
class GameState {
    constructor() {
        this.agents = Array(MAX_AGENTS).fill().map(() => new AgentState());
        this.agentCountDoNotUse = 0;
        this.myAgentCountDoNotUse = 0;
    }
}

/**
 * Conteneur principal pour toutes les données du jeu
 */
class GameInfo {
    constructor() {
        this.consts = new GameConstants();
        this.state = new GameState();
        this.output = new GameOutput();
    }
}

/**
 * Contexte de simulation réutilisable
 */
class SimulationContext {
    constructor() {
        this.simAgents = Array(MAX_AGENTS).fill().map(() => new AgentState());
        this.wetnessGain = 0;
        this.nb50WetGain = 0;
        this.nb100WetGain = 0;
        this.controlScore = 0;
    }
}

// ==========================
// === VARIABLES GLOBALES
// ==========================
let game = new GameInfo();
let cpuStart = 0;

// Pool de contextes réutilisables pour optimisation
const contextPool = Array(10).fill(null).map(() => new SimulationContext());
let contextIndex = 0;

// ==========================
// === UTILITAIRES
// ==========================

/**
 * Réinitialise le compteur de temps CPU
 */
function cpuReset() {
    cpuStart = Date.now();
}

/**
 * Retourne le temps CPU utilisé en millisecondes
 */
function cpuMsUsed() {
    return Date.now() - cpuStart;
}

/**
 * Vérifie si on a dépassé le temps CPU maximum autorisé
 */
function cpuBreak(maxMs) {
    return cpuMsUsed() > maxMs;
}

// ==========================
// === FONCTIONS PRINCIPALES
// ==========================

/**
 * Calcule le gain de score de contrôle si un agent se déplace vers une position donnée
 * @param {number} agentId - ID de l'agent
 * @param {number} nx - Nouvelle position X
 * @param {number} ny - Nouvelle position Y
 * @returns {number} Différence de score (positif = gain pour nous)
 */
function controlledScoreGainIfAgentMovesTo(agentId, nx, ny) {
    let myGain = 0;
    let enemyGain = 0;
    
    // Cache les positions des agents vivants pour optimisation
    const myAgentsPos = [];
    const enemyAgentsPos = [];
    
    // Collecter les positions de nos agents
    for (let i = game.consts.playerInfo[game.consts.myPlayerId].agentStartIndex;
         i <= game.consts.playerInfo[game.consts.myPlayerId].agentStopIndex; i++) {
        if (!game.state.agents[i].alive) continue;
        myAgentsPos.push({
            x: (i === agentId) ? nx : game.state.agents[i].x,
            y: (i === agentId) ? ny : game.state.agents[i].y,
            wetness: game.state.agents[i].wetness
        });
    }
    
    // Collecter les positions des agents ennemis
    for (let i = game.consts.playerInfo[1 - game.consts.myPlayerId].agentStartIndex;
         i <= game.consts.playerInfo[1 - game.consts.myPlayerId].agentStopIndex; i++) {
        if (!game.state.agents[i].alive) continue;
        enemyAgentsPos.push({
            x: game.state.agents[i].x,
            y: game.state.agents[i].y,
            wetness: game.state.agents[i].wetness
        });
    }
    
    // Parcourir toutes les cases pour calculer le contrôle territorial
    for (let y = 0; y < game.consts.map.height; y++) {
        for (let x = 0; x < game.consts.map.width; x++) {
            if (game.consts.map.map[y][x].type > 0) continue; // Ignorer les obstacles
            
            let dMy = Number.MAX_SAFE_INTEGER;
            let dEn = Number.MAX_SAFE_INTEGER;
            
            // Distance au plus proche de nos agents
            for (const agent of myAgentsPos) {
                let d = Math.abs(x - agent.x) + Math.abs(y - agent.y);
                if (agent.wetness >= 50) d *= 2; // Pénalité si agent très mouillé
                if (d < dMy) dMy = d;
            }
            
            // Distance au plus proche agent ennemi
            for (const agent of enemyAgentsPos) {
                let d = Math.abs(x - agent.x) + Math.abs(y - agent.y);
                if (agent.wetness >= 50) d *= 2;
                if (d < dEn) dEn = d;
            }
            
            // Qui contrôle cette case ?
            if (dMy < dEn) myGain++;
            else if (dEn < dMy) enemyGain++;
        }
    }
    
    return myGain - enemyGain;
}

/**
 * Pré-calcule les distances BFS depuis chaque agent ennemi vers toutes les cases
 * Utilise un algorithme de parcours en largeur (BFS) pour trouver les chemins les plus courts
 */
function precomputeBfsDistances() {
    const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
    
    // Créer des Int32Array réutilisables pour performance
    const visited = new Int32Array(MAX_HEIGHT * MAX_WIDTH);
    const dist = new Int32Array(MAX_HEIGHT * MAX_WIDTH);
    
    // Helper pour convertir (y,x) en index linéaire
    const idx = (y, x) => y * MAX_WIDTH + x;

    // Pour chaque agent
    for (let k = 0; k < MAX_AGENTS; k++) {
        let enemy = game.state.agents[k];
        if (!enemy.alive) continue;

        let eid = enemy.id;
        
        // Réinitialiser les tableaux
        visited.fill(0);
        dist.fill(0);
        
        // BFS depuis la position de l'agent
        let queue = [{x: enemy.x, y: enemy.y}];
        let front = 0;

        visited[idx(enemy.y, enemy.x)] = 1;
        dist[idx(enemy.y, enemy.x)] = 0;

        while (front < queue.length) {
            let {x, y} = queue[front++];
            
            // Explorer les 4 directions
            for (let [dx, dy] of dirs) {
                let nx = x + dx;
                let ny = y + dy;
                
                // Vérifier les limites et obstacles
                if (nx < 0 || nx >= game.consts.map.width || 
                    ny < 0 || ny >= game.consts.map.height) continue;
                if (game.consts.map.map[ny][nx].type > 0) continue;
                if (visited[idx(ny, nx)]) continue;

                visited[idx(ny, nx)] = 1;
                dist[idx(ny, nx)] = dist[idx(y, x)] + 1;
                queue.push({x: nx, y: ny});
            }
        }

        // Stocker les distances calculées
        for (let y = 0; y < game.consts.map.height; y++) {
            for (let x = 0; x < game.consts.map.width; x++) {
                if (!visited[idx(y, x)]) {
                    game.output.setBfsDistance(eid, y, x, 9999);
                } else {
                    game.output.setBfsDistance(eid, y, x, dist[idx(y, x)]);
                }
            }
        }
    }
}

/**
 * Calcule les meilleurs mouvements possibles pour un agent donné
 * @param {number} agentId - ID de l'agent
 */
function computeBestAgentsMoves(agentId) {
    const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]; // rester, gauche, droite, haut, bas

    let agentState = game.state.agents[agentId];
    let agentInfo = game.consts.agentInfo[agentId];

    game.output.moveCounts[agentId] = 0;

    let myPlayerId = agentInfo.playerId;
    let enemyPlayerId = 1 - myPlayerId;

    let enemyStart = game.consts.playerInfo[enemyPlayerId].agentStartIndex;
    let enemyStop = game.consts.playerInfo[enemyPlayerId].agentStopIndex;
    let allyStart = game.consts.playerInfo[myPlayerId].agentStartIndex;
    let allyStop = game.consts.playerInfo[myPlayerId].agentStopIndex;

    // Étape 1 : Détecter s'il y a un danger (ennemi avec bombes proche)
    let danger = false;
    for (let k = enemyStart; k <= enemyStop; k++) {
        let enemy = game.state.agents[k];
        if (!enemy.alive) continue;
        if (enemy.splashBombs <= 0) continue;

        let dist = Math.abs(enemy.x - agentState.x) + Math.abs(enemy.y - agentState.y);
        if (dist <= 7) {
            danger = true;
            break;
        }
    }

    // Étape 2 : Générer et évaluer les mouvements possibles
    for (let d = 0; d < 5; d++) {
        let nx = agentState.x + dirs[d][0];
        let ny = agentState.y + dirs[d][1];

        // Vérifier la validité du mouvement
        if (nx < 0 || nx >= game.consts.map.width || 
            ny < 0 || ny >= game.consts.map.height) continue;
        if (game.consts.map.map[ny][nx].type > 0) continue;

        // Calculer la distance au plus proche ennemi
        let minDistToEnemy = 9999;
        for (let k = enemyStart; k <= enemyStop; k++) {
            let opState = game.state.agents[k];
            if (!opState.alive) continue;

            let dist = game.output.getBfsDistance(opState.id, ny, nx);
            if (dist < minDistToEnemy) minDistToEnemy = dist;
        }

        // Pénalité si on se rapproche d'alliés en cas de danger
        let penalty = 0.0;
        if (danger) {
            for (let a = allyStart; a <= allyStop; a++) {
                if (a === agentId) continue;
                let ally = game.state.agents[a];
                if (!ally.alive) continue;

                let distAlly = Math.abs(ally.x - nx) + Math.abs(ally.y - ny);
                if (distAlly < 3) {
                    penalty += 20.0;
                }
            }
        }

        // Calculer le score final du mouvement
        let gain = controlledScoreGainIfAgentMovesTo(agentId, nx, ny);
        let score = gain * 10 + (-minDistToEnemy - penalty);

        // Ajouter le mouvement à la liste
        if (game.output.moveCounts[agentId] < MAX_MOVES_PER_AGENT) {
            game.output.moves[agentId][game.output.moveCounts[agentId]] = 
                new AgentAction(nx, ny, score);
            game.output.moveCounts[agentId]++;
        }
    }

    // Trier les mouvements par score décroissant
    let moves = game.output.moves[agentId];
    let count = game.output.moveCounts[agentId];
    
    for (let i = 0; i < count - 1; i++) {
        for (let j = i + 1; j < count; j++) {
            if (moves[j].score > moves[i].score) {
                [moves[i], moves[j]] = [moves[j], moves[i]];
            }
        }
    }
}

/**
 * Calcule les meilleures cibles de tir pour un agent à une position donnée
 * @param {number} agentId - ID de l'agent tireur
 * @param {number} newShooterX - Position X du tireur après mouvement
 * @param {number} newShooterY - Position Y du tireur après mouvement
 */
function computeBestAgentsShoot(agentId, newShooterX, newShooterY) {
    let shooterState = game.state.agents[agentId];
    let shooterInfo = game.consts.agentInfo[agentId];

    game.output.shootCounts[agentId] = 0;
    
    // Pas de tir si en cooldown
    if (shooterState.cooldown > 0) return;

    let myPlayerId = shooterInfo.playerId;
    let enemyPlayerId = 1 - myPlayerId;
    let enemyStart = game.consts.playerInfo[enemyPlayerId].agentStartIndex;
    let enemyStop = game.consts.playerInfo[enemyPlayerId].agentStopIndex;

    let shootsCount = 0;

    // Évaluer chaque ennemi comme cible potentielle
    for (let k = enemyStart; k <= enemyStop; k++) {
        let enemy = game.state.agents[k];
        if (!enemy.alive) continue;

        let dx = Math.abs(enemy.x - newShooterX);
        let dy = Math.abs(enemy.y - newShooterY);
        let dist = dx + dy;

        let maxRange = 2 * shooterInfo.optimalRange;

        if (dist > maxRange) continue; // Hors de portée

        // Bonus si dans la portée optimale
        let optimalBonus = (dist <= shooterInfo.optimalRange) ? 1.5 : 1.0;

        // Score basé sur le wetness de la cible et la distance
        let score = enemy.wetness * optimalBonus - dist * 2;

        if (shootsCount < MAX_SHOOTS_PER_AGENT) {
            game.output.shoots[agentId][shootsCount] = new AgentAction(k, 0, score);
            shootsCount++;
        }
    }

    // Trier les tirs par score décroissant
    let shoots = game.output.shoots[agentId];
    for (let i = 0; i < shootsCount - 1; i++) {
        for (let j = i + 1; j < shootsCount; j++) {
            if (shoots[j].score > shoots[i].score) {
                [shoots[i], shoots[j]] = [shoots[j], shoots[i]];
            }
        }
    }
    game.output.shootCounts[agentId] = shootsCount;
}

/**
 * Vérifie si une position est bloquée (obstacle ou hors limites)
 * @param {number} x - Position X
 * @param {number} y - Position Y
 * @param {number} throwerX - Position X du lanceur
 * @param {number} throwerY - Position Y du lanceur
 * @returns {boolean} true si bloqué
 */
function isBlocked(x, y, throwerX, throwerY) {
    if (x < 0 || x >= game.consts.map.width || y < 0 || y >= game.consts.map.height) return true;
    if (game.consts.map.map[y][x].type > 0) return true;
    if (x === throwerX && y === throwerY) return true;
    return false;
}

/**
 * Compte le nombre d'obstacles autour d'une position (pour évaluer l'efficacité d'une bombe)
 * @param {number} cx - Position X centrale
 * @param {number} cy - Position Y centrale
 * @param {number} throwerX - Position X du lanceur
 * @param {number} throwerY - Position Y du lanceur
 * @returns {number} Nombre d'obstacles
 */
function countPenalties(cx, cy, throwerX, throwerY) {
    let penalty = 0;
    for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
            let nx = cx + ox;
            let ny = cy + oy;
            if (nx < 0 || nx >= game.consts.map.width || 
                ny < 0 || ny >= game.consts.map.height) {
                penalty++;
            } else if ((game.consts.map.map[ny][nx].type > 0) || 
                      (nx === throwerX && ny === throwerY)) {
                penalty++;
            }
        }
    }
    return penalty;
}

/**
 * Vérifie si une zone de bombe touche un allié
 * @param {number} cx - Position X centrale de la bombe
 * @param {number} cy - Position Y centrale de la bombe
 * @param {number} playerId - ID du joueur allié
 * @param {Array} agents - État des agents
 * @returns {boolean} true si un allié est touché
 */
function zoneToucheAllie(cx, cy, playerId, agents) {
    for (let a = game.consts.playerInfo[playerId].agentStartIndex;
         a <= game.consts.playerInfo[playerId].agentStopIndex; a++) {
        let ally = agents[a];
        if (!ally.alive) continue;
        if (Math.abs(ally.x - cx) <= 1 && Math.abs(ally.y - cy) <= 1) {
            return true;
        }
    }
    return false;
}

/**
 * Calcule les meilleures positions de lancer de bombe pour un agent
 * @param {number} agentId - ID de l'agent lanceur
 * @param {number} newThrowerX - Position X du lanceur après mouvement
 * @param {number} newThrowerY - Position Y du lanceur après mouvement
 */
function computeBestAgentsBomb(agentId, newThrowerX, newThrowerY) {
    game.output.bombCounts[agentId] = 0;

    let throwerState = game.state.agents[agentId];
    let throwerInfo = game.consts.agentInfo[agentId];
    
    // Vérifier si l'agent peut lancer une bombe
    if (!throwerState.alive || throwerState.splashBombs <= 0) return;

    let myPlayerId = throwerInfo.playerId;
    let enemyPlayerId = 1 - myPlayerId;

    let agents = game.state.agents;

    // Pour chaque ennemi, évaluer les positions de bombe possibles
    for (let k = game.consts.playerInfo[enemyPlayerId].agentStartIndex;
         k <= game.consts.playerInfo[enemyPlayerId].agentStopIndex; k++) {

        let enemy = agents[k];
        if (!enemy.alive) continue;

        let ex = enemy.x;
        let ey = enemy.y;

        // 5 directions : centre (0,0), puis les 4 latérales
        let dxs = [0, -1, 1, 0, 0];
        let dys = [0, 0, 0, -1, 1];

        for (let d = 0; d < 5; d++) {
            let tx = ex + dxs[d];
            let ty = ey + dys[d];

            // Pour les directions latérales, vérifier que l'opposé est bloqué
            if (d > 0) {
                let ox = ex - dxs[d];
                let oy = ey - dys[d];
                if (!isBlocked(ox, oy, newThrowerX, newThrowerY)) continue;
            }

            // Vérifier la portée (max 4 cases)
            let dist = Math.abs(tx - newThrowerX) + Math.abs(ty - newThrowerY);
            if (dist > 4) continue;

            // Éviter le friendly fire
            if (zoneToucheAllie(tx, ty, myPlayerId, agents)) continue;

            // Calculer le score (préférer les ennemis peu mouillés et les zones ouvertes)
            let score = 100 - enemy.wetness - countPenalties(tx, ty, newThrowerX, newThrowerY);

            if (game.output.bombCounts[agentId] < MAX_BOMB_PER_AGENT) {
                game.output.bombs[agentId][game.output.bombCounts[agentId]] = 
                    new AgentAction(tx, ty, score);
                game.output.bombCounts[agentId]++;
            }
        }
    }

    // Trier par score décroissant
    let bombs = game.output.bombs[agentId];
    let count = game.output.bombCounts[agentId];
    for (let i = 0; i < count - 1; i++) {
        for (let j = i + 1; j < count; j++) {
            if (bombs[j].score > bombs[i].score) {
                [bombs[i], bombs[j]] = [bombs[j], bombs[i]];
            }
        }
    }
}

/**
 * Génère toutes les commandes possibles pour chaque agent
 * Combine mouvements, tirs et bombes selon des limites dynamiques
 */
function computeBestAgentsCommands() {
    // Configuration des limites dynamiques selon le nombre d'agents vivants
    const maxShootsPerAgent = [0, 1, 2, 3, 4, 5];
    const maxBombsPerAgent = [0, 1, 2, 3, 4, 5];

    // Compter nos agents vivants
    let myAliveAgents = 0;
    for (let i = 0; i < MAX_AGENTS; i++) {
        if (game.state.agents[i].alive && 
            game.consts.agentInfo[i].playerId === game.consts.myPlayerId) {
            myAliveAgents++;
        }
    }
    if (myAliveAgents > 5) myAliveAgents = 5;

    // Déterminer les limites pour ce tour
    let shootLimitPerAgent = maxShootsPerAgent[myAliveAgents];
    let bombLimitPerAgent = maxBombsPerAgent[myAliveAgents];

    // Générer les commandes pour chaque agent
    for (let i = 0; i < MAX_AGENTS; i++) {
        game.output.agentCommandCounts[i] = 0;
        if (!game.state.agents[i].alive) continue;
        
        let cmdIndex = 0;
        
        // D'abord calculer tous les mouvements possibles
        computeBestAgentsMoves(i);
        let moveCount = game.output.moveCounts[i];

        // Pour chaque mouvement, générer les actions possibles
        for (let m = 0; m < moveCount && cmdIndex < MAX_COMMANDS_PER_AGENT; m++) {
            let mv = game.output.moves[i][m];
            let mvX = mv.targetXOrId;
            let mvY = mv.targetY;

            // Générer les bombes possibles (limitées par bombLimitPerAgent)
            computeBestAgentsBomb(i, mvX, mvY);
            let bombCount = Math.min(game.output.bombCounts[i], bombLimitPerAgent);
            
            for (let b = 0; b < bombCount && cmdIndex < MAX_COMMANDS_PER_AGENT; b++) {
                let bomb = game.output.bombs[i][b];
                game.output.agentCommands[i][cmdIndex] = new AgentCommand(
                    mvX, mvY, ActionType.CMD_THROW,
                    bomb.targetXOrId, bomb.targetY, mv.score
                );
                cmdIndex++;
            }

            // Générer les tirs possibles (limités par shootLimitPerAgent)
            computeBestAgentsShoot(i, mvX, mvY);
            let shootCount = Math.min(game.output.shootCounts[i], shootLimitPerAgent);
            
            for (let s = 0; s < shootCount && cmdIndex < MAX_COMMANDS_PER_AGENT; s++) {
                let shoot = game.output.shoots[i][s];
                game.output.agentCommands[i][cmdIndex] = new AgentCommand(
                    mvX, mvY, ActionType.CMD_SHOOT,
                    shoot.targetXOrId, shoot.targetY, mv.score
                );
                cmdIndex++;
            }

            // Ajouter l'option de se mettre à couvert (hunker)
            if (cmdIndex < MAX_COMMANDS_PER_AGENT) {
                game.output.agentCommands[i][cmdIndex] = new AgentCommand(
                    mvX, mvY, ActionType.CMD_HUNKER, -1, -1, mv.score
                );
                cmdIndex++;
            }
        }

        game.output.agentCommandCounts[i] = cmdIndex;
    }
}

/**
 * Vérifie s'il y a collision entre les mouvements de deux agents
 * @param {number} myPlayerId - ID du joueur
 * @param {number} cmdsIndex - Index de la combinaison de commandes
 * @param {number} agentStartId - Premier agent à vérifier
 * @param {number} agentStopId - Dernier agent à vérifier
 * @returns {boolean} true s'il y a collision
 */
function checkMvCollision(myPlayerId, cmdsIndex, agentStartId, agentStopId) {
    for (let a1 = agentStartId; a1 <= agentStopId; a1++) {
        if (!game.state.agents[a1].alive) continue;
        let cmd1 = game.output.playerCommands[myPlayerId][cmdsIndex][a1];
        let from1X = game.state.agents[a1].x;
        let from1Y = game.state.agents[a1].y;
        let to1X = cmd1.mvX;
        let to1Y = cmd1.mvY;

        for (let a2 = a1 + 1; a2 <= agentStopId; a2++) {
            if (!game.state.agents[a2].alive) continue;
            let cmd2 = game.output.playerCommands[myPlayerId][cmdsIndex][a2];
            let from2X = game.state.agents[a2].x;
            let from2Y = game.state.agents[a2].y;
            let to2X = cmd2.mvX;
            let to2Y = cmd2.mvY;

            // Vérifier collision sur la même destination
            if (to1X === to2X && to1Y === to2Y) {
                return true;
            }

            // Vérifier échange de positions (swap)
            if (to1X === from2X && to1Y === from2Y && 
                to2X === from1X && to2Y === from1Y) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Génère toutes les combinaisons possibles de commandes pour chaque joueur
 * Utilise un produit cartésien des commandes individuelles des agents
 */
function computeBestPlayerCommands() {
    for (let p = 0; p < MAX_PLAYERS; p++) {
        game.output.playerCommandCount[p] = 0;

        let maxTotalCmds = (p === game.consts.myPlayerId) ? 
            MAX_COMMANDS_PLAYER_ME : MAX_COMMANDS_PLAYER_ENEMIE;
        let agentStartId = game.consts.playerInfo[p].agentStartIndex;
        let agentStopId = game.consts.playerInfo[p].agentStopIndex;
        let maxCmds = Array(MAX_AGENTS).fill(0);
        let total = 1;

        // Initialiser avec 1 commande par agent vivant
        for (let agentId = agentStartId; agentId <= agentStopId; agentId++) {
            if (!game.state.agents[agentId].alive) continue;
            maxCmds[agentId] = 1;
        }

        // Répartition intelligente des commandes
        let updated = true;
        while (updated) {
            updated = false;
            for (let agentId = agentStartId; agentId <= agentStopId; agentId++) {
                if (!game.state.agents[agentId].alive) continue;

                let current = maxCmds[agentId];
                let available = game.output.agentCommandCounts[agentId];

                if (current < available) {
                    let newTotal = Math.floor(total / current) * (current + 1);
                    if (newTotal <= maxTotalCmds) {
                        maxCmds[agentId]++;
                        total = newTotal;
                        updated = true;
                    }
                }
            }
        }

        // Génération du produit cartésien
        let indices = Array(MAX_AGENTS).fill(0);

        while (true) {
            if (game.output.playerCommandCount[p] >= maxTotalCmds) {
                console.error("ERROR: too many commands " + maxTotalCmds);
                break;
            }

            // Construire la combinaison actuelle
            for (let agentId = agentStartId; agentId <= agentStopId; agentId++) {
                if (!game.state.agents[agentId].alive) continue;
                let cmdId = indices[agentId];
                game.output.playerCommands[p][game.output.playerCommandCount[p]][agentId] =
                    game.output.agentCommands[agentId][cmdId];
            }
            
            // Vérifier les collisions
            let collision = checkMvCollision(p, game.output.playerCommandCount[p], agentStartId, agentStopId);

            if (!collision) game.output.playerCommandCount[p]++;

            // Incrémenter les indices (système de comptage en base variable)
            let carry = 1;
            for (let agentId = agentStartId; agentId <= agentStopId && carry; agentId++) {
                if (!game.state.agents[agentId].alive) continue;

                indices[agentId]++;
                if (indices[agentId] >= maxCmds[agentId]) {
                    indices[agentId] = 0;
                    carry = 1;
                } else {
                    carry = 0;
                }
            }

            if (carry) break; // Toutes les combinaisons ont été générées
        }
    }
}

/**
 * Simule l'exécution d'une combinaison de commandes pour les deux joueurs
 * @param {number} myCmdIndex - Index des commandes de notre joueur
 * @param {number} enCmdIndex - Index des commandes de l'ennemi
 * @param {SimulationContext} ctx - Contexte de simulation
 */
function simulatePlayersCommands(myCmdIndex, enCmdIndex, ctx) {
    let myId = game.consts.myPlayerId;
    let enId = 1 - myId;
    let myStart = game.consts.playerInfo[myId].agentStartIndex;
    let myStop = game.consts.playerInfo[myId].agentStopIndex;
    let enStart = game.consts.playerInfo[enId].agentStartIndex;
    let enStop = game.consts.playerInfo[enId].agentStopIndex;

    // Copier l'état actuel des agents
    for (let i = 0; i < MAX_AGENTS; i++) {
        ctx.simAgents[i] = { ...game.state.agents[i] };
    }
    ctx.wetnessGain = 0;
    ctx.nb50WetGain = 0;
    ctx.nb100WetGain = 0;

    // Étape 1: Appliquer les déplacements
    for (let aid = 0; aid < MAX_AGENTS; aid++) {
        if (!ctx.simAgents[aid].alive) continue;

        let cmd = null;
        if (aid >= myStart && aid <= myStop) {
            cmd = game.output.playerCommands[myId][myCmdIndex][aid];
        } else if (aid >= enStart && aid <= enStop) {
            cmd = game.output.playerCommands[enId][enCmdIndex][aid];
        } else continue;

        ctx.simAgents[aid].x = cmd.mvX;
        ctx.simAgents[aid].y = cmd.mvY;
    }

    // Étape 2: Appliquer les actions (tirs et bombes)
    for (let aid = 0; aid < MAX_AGENTS; aid++) {
        if (!ctx.simAgents[aid].alive) continue;

        let cmd = null;
        if (aid >= myStart && aid <= myStop) {
            cmd = game.output.playerCommands[myId][myCmdIndex][aid];
        } else if (aid >= enStart && aid <= enStop) {
            cmd = game.output.playerCommands[enId][enCmdIndex][aid];
        } else continue;

        // Traiter les bombes
        if (cmd.actionType === ActionType.CMD_THROW) {
            for (let t = 0; t < MAX_AGENTS; t++) {
                if (!ctx.simAgents[t].alive) continue;
                let dx = Math.abs(ctx.simAgents[t].x - cmd.targetXOrId);
                let dy = Math.abs(ctx.simAgents[t].y - cmd.targetY);
                if (dx <= 1 && dy <= 1) {
                    ctx.simAgents[t].wetness += 30;
                }
            }
        } 
        // Traiter les tirs
        else if (cmd.actionType === ActionType.CMD_SHOOT) {
            let targetId = cmd.targetXOrId;
            if (!ctx.simAgents[targetId].alive) continue;

            let shooter = ctx.simAgents[aid];
            let target = ctx.simAgents[targetId];
            let shooterInfo = game.consts.agentInfo[aid];

            let dx = Math.abs(shooter.x - target.x);
            let dy = Math.abs(shooter.y - target.y);
            let dist = dx + dy;
            
            // Modificateur de portée
            let rangeModifier = dist <= shooterInfo.optimalRange ? 1.0 :
                               dist <= 2 * shooterInfo.optimalRange ? 0.5 : 0.0;
            if (rangeModifier === 0.0) continue;

            // Modificateur de couverture
            let coverModifier = 1.0;
            let adjX = -Math.sign(target.x - shooter.x);
            let adjY = -Math.sign(target.y - shooter.y);
            let cx = target.x + adjX;
            let cy = target.y + adjY;
            if (cx >= 0 && cx < game.consts.map.width && cy >= 0 && cy < game.consts.map.height) {
                let tile = game.consts.map.map[cy][cx].type;
                if (tile === 1) coverModifier = 0.5;      // Couverture légère
                else if (tile === 2) coverModifier = 0.25; // Couverture lourde
            }

            let damage = shooterInfo.soakingPower * rangeModifier * coverModifier;
            if (damage > 0) target.wetness += Math.floor(damage);
        }
    }

    // Étape 3: Calculer les gains/pertes et gérer les "morts"
    let myIdPlayer = game.consts.myPlayerId;
    for (let aid = 0; aid < MAX_AGENTS; aid++) {
        let curr = game.state.agents[aid].wetness;
        let now = ctx.simAgents[aid].wetness;
        if (now >= 100) {
            ctx.simAgents[aid].alive = 0;
            now = 100;
        }

        let pid = game.consts.agentInfo[aid].playerId;
        let delta = now - curr;
        if (delta === 0) continue;

        // Compter les passages de seuils importants
        if (now >= 100 && curr < 100) {
            ctx.nb100WetGain += (pid === myIdPlayer) ? -1 : +1;
        }
        if (now >= 50 && curr < 50) {
            ctx.nb50WetGain += (pid === myIdPlayer) ? -1 : +1;
        }

        ctx.wetnessGain += (pid === myIdPlayer) ? -delta : +delta;
    }

    // Étape 4: Calculer le score de contrôle territorial
    ctx.controlScore = 0;
    let scoreSum = 0.0;
    let count = 0;

    for (let aid = myStart; aid <= myStop; aid++) {
        if (!ctx.simAgents[aid].alive) continue;
        let cmd = game.output.playerCommands[myId][myCmdIndex][aid];
        scoreSum += cmd.score;
        count++;
    }

    ctx.controlScore += scoreSum / 100.0;
}

/**
 * Évalue le résultat d'une simulation
 * @param {SimulationContext} ctx - Contexte de simulation
 * @returns {number} Score de la simulation (plus élevé = meilleur pour nous)
 */
function evaluateSimulation(ctx) {
    return ctx.controlScore / 100.0 * 20.0 +      // Contrôle territorial
           ctx.wetnessGain / 100.0 * 1.0 +        // Gain de wetness
           ctx.nb50WetGain / 10.0 * 1000.0 +      // Passages à 50% wet
           ctx.nb100WetGain / 10.0 * 2000.0;      // Éliminations
}

/**
 * Évalue toutes les combinaisons de commandes et trouve la meilleure
 * Utilise une approche minimax pour considérer les meilleures réponses de l'ennemi
 */
function computeEvaluation() {
    const startTime = Date.now();
    const maxTime = 60; // ms
    
    let myId = game.consts.myPlayerId;
    let enId = 1 - myId;
    game.output.simulationCount = 0;

    let myCount = game.output.playerCommandCount[myId];
    let enCount = game.output.playerCommandCount[enId];

    // Pour chaque combinaison de nos commandes
    for (let i = 0; i < myCount; i++) {
        // Vérifier le timeout
        if (Date.now() - startTime > maxTime) {
            console.error(`Early exit: ${i}/${myCount} commands evaluated`);
            break;
        }
        
        let worstScore = 1e9;
        let worstEnemyCmd = -1;

        // Simuler toutes les réponses possibles de l'ennemi
        for (let j = 0; j < enCount; j++) {
            // Utiliser un contexte du pool pour éviter les allocations
            let ctx = contextPool[contextIndex++ % contextPool.length];
            
            simulatePlayersCommands(i, j, ctx);
            let score = evaluateSimulation(ctx);

            // Garder le pire cas (minimax)
            if (score < worstScore) {
                worstScore = score;
                worstEnemyCmd = j;
            }
        }

        game.output.simulationResults[game.output.simulationCount] = 
            new SimulationResult(worstScore, i, worstEnemyCmd);
        game.output.simulationCount++;
    }

    // Trier pour avoir la meilleure option (score le plus élevé) en premier
    for (let a = 0; a < game.output.simulationCount - 1; a++) {
        for (let b = a + 1; b < game.output.simulationCount; b++) {
            if (game.output.simulationResults[b].score > game.output.simulationResults[a].score) {
                [game.output.simulationResults[a], game.output.simulationResults[b]] = 
                [game.output.simulationResults[b], game.output.simulationResults[a]];
            }
        }
    }
}

/**
 * Applique la meilleure combinaison de commandes trouvée et génère la sortie
 */
function applyOutput() {
    let cpu = cpuMsUsed();
    console.error(`Turn CPU time: ${cpu.toFixed(2)} ms`);
    let myPlayerId = game.consts.myPlayerId;
    let agentStartId = game.consts.playerInfo[myPlayerId].agentStartIndex;
    let agentStopId = game.consts.playerInfo[myPlayerId].agentStopIndex;

    if (game.output.simulationCount === 0) {
        console.error("ERROR: no simulation result");
        return;
    }

    // Prendre la meilleure combinaison
    let bestIndex = game.output.simulationResults[0].myCmdsIndex;

    // Générer les commandes pour chaque agent
    for (let agentId = agentStartId; agentId <= agentStopId; agentId++) {
        if (!game.state.agents[agentId].alive) continue;
        let cmd = game.output.playerCommands[myPlayerId][bestIndex][agentId];

        let output = `${agentId + 1}`;

        // Ajouter le mouvement si différent de la position actuelle
        if (cmd.mvX !== game.state.agents[agentId].x || cmd.mvY !== game.state.agents[agentId].y) {
            output += `;MOVE ${cmd.mvX} ${cmd.mvY}`;
        }

        // Ajouter l'action
        if (cmd.actionType === ActionType.CMD_SHOOT) {
            output += `;SHOOT ${cmd.targetXOrId + 1}`; // +1 car l'API attend des index 1-based
        } else if (cmd.actionType === ActionType.CMD_THROW) {
            output += `;THROW ${cmd.targetXOrId} ${cmd.targetY}`;
        } else if (cmd.actionType === ActionType.CMD_HUNKER) {
            output += `;HUNKER_DOWN`;
        }

        // Message de debug avec le temps CPU utilisé
        output += `;MESSAGE ${cpu.toFixed(2)}ms`;

        console.log(output);
    }
}

// ==========================
// === LECTURE DES ENTRÉES
// ==========================

/**
 * Lit les données d'initialisation du jeu
 */
function readGameInputsInit() {
    game.consts.myPlayerId = parseInt(readline());
    game.consts.agentInfoCount = parseInt(readline());

    // Lire les informations de chaque agent
    for (let i = 0; i < game.consts.agentInfoCount; i++) {
        let inputs = readline().split(' ');
        game.consts.agentInfo[i] = new AgentInfo(
            parseInt(inputs[0]), // id
            parseInt(inputs[1]), // playerId
            parseInt(inputs[2]), // shootCooldown
            parseInt(inputs[3]), // optimalRange
            parseInt(inputs[4]), // soakingPower
            parseInt(inputs[5])  // splashBombs
        );
    }

    // Initialiser les informations par joueur
    for (let p = 0; p < MAX_PLAYERS; p++) {
        game.consts.playerInfo[p] = new PlayerAgentInfo();
    }

    // Regrouper les agents par joueur
    for (let i = 0; i < game.consts.agentInfoCount; i++) {
        let player = game.consts.agentInfo[i].playerId;
        if (game.consts.playerInfo[player].agentCount === 0) {
            game.consts.playerInfo[player].agentStartIndex = i;
        }
        game.consts.playerInfo[player].agentCount++;
        game.consts.playerInfo[player].agentStopIndex = i;
    }

    // Lire les dimensions de la carte
    let inputs = readline().split(' ');
    game.consts.map.width = parseInt(inputs[0]);
    game.consts.map.height = parseInt(inputs[1]);

    // Lire la carte
    for (let i = 0; i < game.consts.map.height; i++) {
        let inputs = readline().split(' ');
        for (let j = 0; j < game.consts.map.width; j++) {
            let x = parseInt(inputs[3 * j]);
            let y = parseInt(inputs[3 * j + 1]);
            let tileType = parseInt(inputs[3 * j + 2]);
            game.consts.map.map[y][x] = new Tile(x, y, tileType);
        }
    }
}

/**
 * Lit l'état du jeu à chaque tour
 */
function readGameInputsCycle() {
    // Réinitialiser tous les agents comme morts
    for (let i = 0; i < MAX_AGENTS; i++) {
        game.state.agents[i].alive = 0;
    }

    game.state.agentCountDoNotUse = parseInt(readline());
    
    // Lire l'état de chaque agent vivant
    for (let i = 0; i < game.state.agentCountDoNotUse; i++) {
        let inputs = readline().split(' ');
        let agentId = parseInt(inputs[0]) - 1; // Convertir en index 0-based
        game.state.agents[agentId] = new AgentState(
            agentId,
            parseInt(inputs[1]), // x
            parseInt(inputs[2]), // y
            parseInt(inputs[3]), // cooldown
            parseInt(inputs[4]), // splashBombs
            parseInt(inputs[5]), // wetness
            1 // alive
        );
    }

    game.state.myAgentCountDoNotUse = parseInt(readline());
    cpuReset();
}

// ==========================
// === PROGRAMME PRINCIPAL
// ==========================

// Initialisation
readGameInputsInit();

// Boucle de jeu principale
while (true) {
    // Lire l'état actuel
    readGameInputsCycle();

    // Phase 1: Pré-calculer les distances pour optimisation
    precomputeBfsDistances();
    
    // Phase 2: Générer les meilleures commandes individuelles par agent
    computeBestAgentsCommands();

    // Phase 3: Générer toutes les combinaisons possibles de commandes
    computeBestPlayerCommands();

    // Phase 4: Évaluer et trouver la meilleure stratégie
    computeEvaluation();

    // Phase 5: Appliquer et afficher les commandes
    applyOutput();
}