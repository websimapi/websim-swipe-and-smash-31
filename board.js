import * as recorder from './recorder.js';
import { playSound } from './audio.js';

export default class Board {
    constructor(size, candyTypes, onMatch, getNewCandyType, getIsPaused = () => false) {
        this.size = size;
        this.candyTypes = candyTypes;
        this.grid = [];
        this.boardElement = document.getElementById('game-board');
        this.onMatch = onMatch;
        this.getNewCandyType = getNewCandyType;
        this.getIsPaused = getIsPaused;
        this.orientation = 'portrait-primary'; // Track current orientation
    }

    setOrientation(orientation) {
        this.orientation = orientation;
    }

    // Transform visual row/col to grid row/col based on orientation
    visualToGrid(visualRow, visualCol) {
        const size = this.size;
        switch (this.orientation) {
            case 'portrait-primary': // 0°
                return { row: visualRow, col: visualCol };
            case 'landscape-primary': // 90° CW
                return { row: visualCol, col: size - 1 - visualRow };
            case 'portrait-secondary': // 180°
                return { row: size - 1 - visualRow, col: size - 1 - visualCol };
            case 'landscape-secondary': // 270° CW (or 90° CCW)
                return { row: size - 1 - visualCol, col: visualRow };
            default:
                return { row: visualRow, col: visualCol };
        }
    }

    // Transform grid row/col to visual row/col based on orientation
    gridToVisual(gridRow, gridCol) {
        const size = this.size;
        switch (this.orientation) {
            case 'portrait-primary': // 0°
                return { row: gridRow, col: gridCol };
            case 'landscape-primary': // 90° CW
                return { row: size - 1 - gridCol, col: gridRow };
            case 'portrait-secondary': // 180°
                return { row: size - 1 - gridRow, col: size - 1 - gridCol };
            case 'landscape-secondary': // 270° CW
                return { row: gridCol, col: size - 1 - gridRow };
            default:
                return { row: gridRow, col: gridCol };
        }
    }

    pausableTimeout(duration) {
        return new Promise(resolve => {
            let start = performance.now();
            let remaining = duration;

            const tick = (now) => {
                if (!this.getIsPaused()) {
                    const elapsed = now - start;
                    start = now;
                    remaining -= elapsed;
                }

                if (remaining <= 0) {
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            };
            requestAnimationFrame(tick);
        });
    }

    initialize(initialState) {
        this.setupBoard();
        for (let r = 0; r < this.size; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.size; c++) {
                const candyType = initialState[r][c];
                // Transform grid position to visual position for display
                const visual = this.gridToVisual(r, c);
                const candy = this.createCandy(visual.row, visual.col, candyType, true);
                this.grid[r][c] = candy;
            }
        }
    }

    setupBoard() {
        this.boardElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
        this.boardElement.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;
    }

    rotateCandies(rotation) {
        this.boardElement.querySelectorAll('.candy').forEach(candy => {
            const currentTransform = candy.style.transform;
            const existingTransforms = currentTransform.replace(/rotate\([^)]+\)/g, '').trim();
            candy.style.transform = `${existingTransforms} rotate(${rotation}deg)`.trim();
        });
    }

    createCandy(row, col, type, isInitializing = false, isReplay = false) {
        const candy = document.createElement('div');
        const candyType = type || this.getNewCandyType(isInitializing);
        
        candy.classList.add('candy');
        if (isReplay) {
            candy.classList.add('replay-candy');
        }
        
        // Store visual coordinates in dataset
        candy.dataset.row = row;
        candy.dataset.col = col;
        candy.dataset.type = candyType;
        candy.style.backgroundImage = `url(${candyType})`;
        
        const candySize = this.boardElement.clientWidth / this.size;
        candy.style.width = `${candySize}px`;
        candy.style.height = `${candySize}px`;
        
        if (isInitializing) {
            candy.style.top = `${row * candySize}px`;
            candy.style.left = `${col * candySize}px`;
        } else {
            // Start above the board for drop-in animation
            candy.style.top = `${-candySize}px`;
            candy.style.left = `${col * candySize}px`;
        }

        // Apply current rotation if any
        const currentRotation = this.getCurrentRotation();
        if (currentRotation !== 0) {
            candy.style.transform = `rotate(${currentRotation}deg)`;
        }

        this.boardElement.appendChild(candy);
        return candy;
    }

    getCurrentRotation() {
        // Get rotation from any existing candy, or return 0
        const existingCandy = this.boardElement.querySelector('.candy');
        if (existingCandy) {
            const transform = existingCandy.style.transform;
            const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);
            if (rotateMatch) {
                return parseFloat(rotateMatch[1]);
            }
        }
        return 0;
    }

    async swapCandies(candy1, candy2) {
        // Get visual positions from the candy elements
        const vr1 = parseInt(candy1.dataset.row);
        const vc1 = parseInt(candy1.dataset.col);
        const vr2 = parseInt(candy2.dataset.row);
        const vc2 = parseInt(candy2.dataset.col);

        // Transform to grid coordinates
        const g1 = this.visualToGrid(vr1, vc1);
        const g2 = this.visualToGrid(vr2, vc2);

        // Swap in grid
        this.grid[g1.row][g1.col] = candy2;
        this.grid[g2.row][g2.col] = candy1;

        // Swap visual datasets (keep visual coordinates in dataset)
        candy1.dataset.row = vr2;
        candy1.dataset.col = vc2;
        candy2.dataset.row = vr1;
        candy2.dataset.col = vc1;

        // Animate swap using visual positions
        const candySize = this.boardElement.clientWidth / this.size;
        candy1.style.top = `${vr2 * candySize}px`;
        candy1.style.left = `${vc2 * candySize}px`;
        candy2.style.top = `${vr1 * candySize}px`;
        candy2.style.left = `${vc1 * candySize}px`;

        playSound('nice_swipe.mp3');
        recorder.recordSound('nice_swipe.mp3');
        return this.pausableTimeout(300);
    }

    getAffectedCandies(powerupCandy) {
        const affected = new Set();
        const vr = parseInt(powerupCandy.dataset.row);
        const vc = parseInt(powerupCandy.dataset.col);
        const gridCoords = this.visualToGrid(vr, vc);
        const gr = gridCoords.row;
        const gc = gridCoords.col;
        const powerupType = powerupCandy.dataset.powerup;

        switch (powerupType) {
            case 'row':
                for (let i = 0; i < this.size; i++) {
                    if (this.grid[gr][i]) affected.add(this.grid[gr][i]);
                }
                break;
            case 'col':
                for (let i = 0; i < this.size; i++) {
                    if (this.grid[i][gc]) affected.add(this.grid[i][gc]);
                }
                break;
            case 'bomb':
                 for (let i = gr - 1; i <= gr + 1; i++) {
                    for (let j = gc - 1; j <= gc + 1; j++) {
                        if (this.isValid(i, j) && this.grid[i][j]) {
                            affected.add(this.grid[i][j]);
                        }
                    }
                }
                break;
        }
        return Array.from(affected);
    }

    async processMatches(isInitializing = false, swappedCandies = null) {
        const matchGroups = this.findMatchGroups();

        if (matchGroups.length === 0) {
            return false; // No matches found, invalid move if it was a swap.
        }

        let totalMatchedCandies = [];
        let createdPowerups = [];

        for (const group of matchGroups) {
            totalMatchedCandies = totalMatchedCandies.concat(group.candies);

            // Power-up creation logic
            let powerup = null;
            if (swappedCandies) { // Only create powerups on player moves
                const isSwapped = (c) => swappedCandies.includes(c);
                if (group.type === 'five' && group.candies.some(isSwapped)) {
                    powerup = { type: 'rainbow' };
                } else if (group.type === 'L' || group.type === 'T') {
                     powerup = { type: 'bomb' };
                } else if (group.type === 'four') {
                     // Determine if the match is horizontal or vertical in GRID space
                     const firstCandy = group.candies[0];
                     const secondCandy = group.candies[1];
                     const gr1 = this.getCandyGridRow(firstCandy);
                     const gc1 = this.getCandyGridCol(firstCandy);
                     const gr2 = this.getCandyGridRow(secondCandy);
                     const gc2 = this.getCandyGridCol(secondCandy);
                     
                     powerup = gr1 === gr2 ? { type: 'row' } : { type: 'col' };
                }
            }
            
            if (powerup) {
                const primaryCandy = group.candies.find(c => swappedCandies && swappedCandies.includes(c)) || group.candies[Math.floor(group.candies.length/2)];
                const vr = parseInt(primaryCandy.dataset.row);
                const vc = parseInt(primaryCandy.dataset.col);
                
                powerup.row = vr;
                powerup.col = vc;
                createdPowerups.push(powerup);
            }
        }
        
        const allCandiesToClear = new Set(totalMatchedCandies);

        // Don't remove candies that are becoming powerups
        createdPowerups.forEach(p => {
            const candyToUpgrade = Array.from(allCandiesToClear).find(c => 
                parseInt(c.dataset.row) === p.row && parseInt(c.dataset.col) === p.col
            );
            if (candyToUpgrade) {
                allCandiesToClear.delete(candyToUpgrade);
                candyToUpgrade.dataset.powerup = p.type;
                candyToUpgrade.classList.add(`powerup-${p.type}`);
                 if (p.type === 'rainbow') {
                    candyToUpgrade.dataset.type = 'candy_chocolate.png';
                    candyToUpgrade.style.backgroundImage = `url(candy_chocolate.png)`;
                }
            }
        });

        // Chain reaction for powerups
        const processedPowerups = new Set();
        let powerupsInClearZone = Array.from(allCandiesToClear).filter(c => c.dataset.powerup);

        while (powerupsInClearZone.length > 0) {
            const currentPowerup = powerupsInClearZone.shift();
            if (processedPowerups.has(currentPowerup)) continue;

            processedPowerups.add(currentPowerup);
            const affectedByPowerup = this.getAffectedCandies(currentPowerup);
            
            for (const affectedCandy of affectedByPowerup) {
                if (!allCandiesToClear.has(affectedCandy)) {
                    allCandiesToClear.add(affectedCandy);
                    if (affectedCandy.dataset.powerup && !processedPowerups.has(affectedCandy)) {
                        powerupsInClearZone.push(affectedCandy);
                    }
                }
            }
        }


        if (allCandiesToClear.size > 0) {
            this.onMatch(Array.from(allCandiesToClear), swappedCandies !== null);
            
            allCandiesToClear.forEach(candy => {
                candy.classList.add('matched');
                const gridCoords = this.visualToGrid(parseInt(candy.dataset.row), parseInt(candy.dataset.col));
                this.grid[gridCoords.row][gridCoords.col] = null;
            });
        }
        
        await this.pausableTimeout(300);
        
        allCandiesToClear.forEach(candy => candy.remove());
        
        await this.dropCandies();
        await this.fillBoard();
        
        await this.processMatches(isInitializing, null);
        
        return true;
    }

    getCandyGridRow(candy) {
        const vr = parseInt(candy.dataset.row);
        const vc = parseInt(candy.dataset.col);
        return this.visualToGrid(vr, vc).row;
    }

    getCandyGridCol(candy) {
        const vr = parseInt(candy.dataset.row);
        const vc = parseInt(candy.dataset.col);
        return this.visualToGrid(vr, vc).col;
    }

    findMatchGroups() {
        const groups = [];
        const visited = new Set();

        // Work in GRID coordinates for match detection
        for (let gr = 0; gr < this.size; gr++) {
            for (let gc = 0; gc < this.size; gc++) {
                const candy = this.grid[gr][gc];
                if (!candy || visited.has(candy)) continue;

                const matchRight = this.findMatchesInDirection(gr, gc, 0, 1);
                const matchDown = this.findMatchesInDirection(gr, gc, 1, 0);
                
                let combined = [];

                if (matchRight.length >= 3) combined.push(...matchRight);
                if (matchDown.length >= 3) combined.push(...matchDown);
                
                combined = [...new Set(combined)]; // Remove duplicates
                
                if (combined.length > 0) {
                    let type = 'three';
                    if (combined.length >= 5) type = 'five';
                    else if (combined.length === 4) type = 'four';

                    // Very basic L/T check
                    if (matchRight.length >= 3 && matchDown.length >= 3) {
                         type = 'L'; // Could also be a T
                    }

                    groups.push({ candies: combined, type: type });
                    combined.forEach(c => visited.add(c));
                }
            }
        }
        return groups;
    }

    findMatchesInDirection(startR, startC, dR, dC) {
        const matches = [];
        const startCandy = this.grid[startR][startC];
        if (!startCandy) return matches;

        matches.push(startCandy);
        
        let r = startR + dR;
        let c = startC + dC;
        
        while (this.isValid(r, c) && this.grid[r][c] && this.grid[r][c].dataset.type === startCandy.dataset.type) {
            matches.push(this.grid[r][c]);
            r += dR;
            c += dC;
        }
        
        return matches;
    }

    async smashCandies(candiesToSmash) {
        if (candiesToSmash.length === 0) return;
        
        this.onMatch(candiesToSmash, false);
        
        candiesToSmash.forEach(candy => {
            candy.classList.add('matched');
            const vr = parseInt(candy.dataset.row);
            const vc = parseInt(candy.dataset.col);
            const gridCoords = this.visualToGrid(vr, vc);
            if (this.grid[gridCoords.row] && this.grid[gridCoords.row][gridCoords.col] === candy) {
                 this.grid[gridCoords.row][gridCoords.col] = null;
            }
        });

        await this.pausableTimeout(300);
        
        candiesToSmash.forEach(candy => candy.remove());
        
        await this.dropCandies();
        await this.fillBoard();
        
        await this.processMatches(false, null);
    }
    
    async activateRainbowPowerup(rainbowCandy, otherCandy) {
        const targetType = otherCandy.dataset.type;
        const candiesToRemove = new Set();
        candiesToRemove.add(rainbowCandy);

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] && this.grid[r][c].dataset.type === targetType) {
                    candiesToRemove.add(this.grid[r][c]);
                }
            }
        }

        this.onMatch(Array.from(candiesToRemove), true);
        
        candiesToRemove.forEach(candy => {
            candy.classList.add('matched');
            const vr = parseInt(candy.dataset.row);
            const vc = parseInt(candy.dataset.col);
            const gridCoords = this.visualToGrid(vr, vc);
            this.grid[gridCoords.row][gridCoords.col] = null;
        });

        await this.pausableTimeout(300);
        
        candiesToRemove.forEach(candy => candy.remove());
        
        await this.dropCandies();
        await this.fillBoard();
        
        await this.processMatches(false, null);
    }

    async dropCandies() {
        // Drop in GRID coordinates
        for (let gc = 0; gc < this.size; gc++) {
            let emptyRow = this.size - 1;
            for (let gr = this.size - 1; gr >= 0; gr--) {
                if (this.grid[gr][gc]) {
                    if (emptyRow !== gr) {
                        // Move candy down in grid
                        this.grid[emptyRow][gc] = this.grid[gr][gc];
                        this.grid[gr][gc] = null;
                        
                        // Update visual position
                        const visualPos = this.gridToVisual(emptyRow, gc);
                        this.grid[emptyRow][gc].dataset.row = visualPos.row;
                        this.grid[emptyRow][gc].dataset.col = visualPos.col;
                        
                        const candySize = this.boardElement.clientWidth / this.size;
                        this.grid[emptyRow][gc].style.top = `${visualPos.row * candySize}px`;
                        this.grid[emptyRow][gc].style.left = `${visualPos.col * candySize}px`;
                    }
                    emptyRow--;
                }
            }
        }
        return this.pausableTimeout(300);
    }
    
    async fillBoard(isReplay = false) {
        const candySize = this.boardElement.clientWidth / this.size;
        // Fill in GRID coordinates
        for (let gr = 0; gr < this.size; gr++) {
            for (let gc = 0; gc < this.size; gc++) {
                if (!this.grid[gr][gc]) {
                    const visualPos = this.gridToVisual(gr, gc);
                    const candy = this.createCandy(visualPos.row, visualPos.col, undefined, false, isReplay);
                    this.grid[gr][gc] = candy;
                    // Animate the drop
                    await new Promise(resolve => requestAnimationFrame(() => {
                        candy.style.top = `${visualPos.row * candySize}px`;
                        resolve();
                    }));
                }
            }
        }
        return this.pausableTimeout(300);
    }

    isValid(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }
}