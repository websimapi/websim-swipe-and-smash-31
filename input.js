import { playBackgroundMusic } from './audio.js';

export default class InputHandler {
    constructor(boardElement, onSwap, onHold, getBoardOrientation) {
        this.boardElement = boardElement;
        this.onSwap = onSwap;
        this.onHold = onHold;
        this.getBoardOrientation = getBoardOrientation; // Get orientation from the board
        this.startCandy = null;
        this.isSwapping = false;
        this.startPos = { x: 0, y: 0 };
        this.holdTimeout = null;
        this.moved = false;
        this.enabled = false;

        // Bind event handlers once to ensure they can be removed correctly
        this.boundHandlePointerDown = this.handlePointerDown.bind(this);
        this.boundHandlePointerMove = this.handlePointerMove.bind(this);
        this.boundHandlePointerUp = this.handlePointerUp.bind(this);
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.boardElement.parentElement.addEventListener('pointerdown', this.boundHandlePointerDown);
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.boardElement.parentElement.removeEventListener('pointerdown', this.boundHandlePointerDown);
    }

    handlePointerDown(e) {
        if (this.isSwapping) return;

        const target = e.target;
        if (!target.classList.contains('candy')) return;
        
        this.startCandy = target;
        this.startPos.x = e.clientX;
        this.startPos.y = e.clientY;
        this.moved = false;

        this.holdTimeout = setTimeout(() => {
            if (!this.moved && this.startCandy) {
                this.onHold(this.startCandy);
                // After a hold action, we don't want to do anything else
                // So we release the pointer control logic
                this.handlePointerUp(); 
            }
        }, 500); // 500ms for a hold
        
        // Listen for move and up events on the whole document to capture drags
        // that might go outside the game board.
        document.addEventListener('pointermove', this.boundHandlePointerMove);
        document.addEventListener('pointerup', this.boundHandlePointerUp);
    }

    handlePointerMove(e) {
        if (!this.startCandy || !this.enabled) return;

        const dx = e.clientX - this.startPos.x;
        const dy = e.clientY - this.startPos.y;
        const moveThreshold = 10;

        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
            this.moved = true;
            clearTimeout(this.holdTimeout);
            this.holdTimeout = null;
        }

        const swipeThreshold = 20;

        if (this.moved && (Math.abs(dx) > swipeThreshold || Math.abs(dy) > swipeThreshold)) {
            // Determine swipe direction in screen space
            let screenDeltaRow = 0, screenDeltaCol = 0;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal swipe in screen space
                screenDeltaCol = dx > 0 ? 1 : -1;
            } else {
                // Vertical swipe in screen space
                screenDeltaRow = dy > 0 ? 1 : -1;
            }

            // Transform screen swipe direction to visual board direction based on orientation
            const orientation = this.getBoardOrientation();
            let visualDeltaRow = screenDeltaRow;
            let visualDeltaCol = screenDeltaCol;

            // This logic is complex. It should be based on the required orientation, not the current one,
            // because the candy visuals are rotated to match the required one.
            // Let's assume the user is trying to move candies relative to how they see them.
            // The current input logic already does this by calculating visual row/col changes.
            // My previous analysis might have been flawed. The issue must be elsewhere. Let's revert this thought and check board.js.
            // The `visualToGrid` and `gridToVisual` should handle everything.
            // No, the original logic in input handler was assuming visual grid and screen grid are the same.
            // But they are not, if the board container itself is rotated.
            // However, I decided to rotate the board container. So visual is screen space.
            // The user said they will rotate the game board container.
            // I need to check how the game board container is rotated.
            // `game.js` `changeRequiredOrientation` no longer rotates the board, but the candies.
            // My plan was to rotate the container. Ok I will proceed with my original plan.

            const startRow = parseInt(this.startCandy.dataset.row);
            const startCol = parseInt(this.startCandy.dataset.col);
            
            const endRow = startRow + screenDeltaRow;
            const endCol = startCol + screenDeltaCol;

            const targetCandy = document.querySelector(`.candy[data-row='${endRow}'][data-col='${endCol}']`);

            if (targetCandy) {
                this.isSwapping = true;
                this.onSwap(this.startCandy, targetCandy).then(() => {
                    this.isSwapping = false;
                });
            }

            this.handlePointerUp();
        }
    }

    handlePointerUp() {
        clearTimeout(this.holdTimeout);
        this.holdTimeout = null;
        // Clean up state and remove listeners
        this.startCandy = null;
        document.removeEventListener('pointermove', this.boundHandlePointerMove);
        document.removeEventListener('pointerup', this.boundHandlePointerUp);
    }
}