/**
 * @file LCS Algorithm Visualizer Logic
 * @author Gemini
 * @description Manages the state and interactivity of the LCS visualizer tool.
 */

class LCSVisualizer {
    constructor() {
        this.dom = {
            s1Input: document.getElementById('s1'),
            s2Input: document.getElementById('s2'),
            presets: document.getElementById('presets'),
            startBtn: document.getElementById('start-btn'),
            resetBtn: document.getElementById('reset-btn'),
            playbackControls: document.getElementById('playback-controls'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            speedSlider: document.getElementById('speed-slider'),
            stepCounter: document.getElementById('step-counter'),
            jumpToStep: document.getElementById('jump-to-step'),
            algorithmSelect: document.getElementById('algorithm'),
            caseSensitiveCheckbox: document.getElementById('case-sensitive'),
            substringModeCheckbox: document.getElementById('lcs-substring-mode'),
            darkModeToggle: document.getElementById('dark-mode-toggle'), // Still exists in CSS, but no HTML control
            grid: document.getElementById('matrix-grid'),
            finalLcsDisplay: document.getElementById('final-lcs-display'),
        };

        this.state = this.getInitialState();
        this.bindEventListeners();
    }

    getInitialState() {
        return {
            s1: '', s2: '', isCaseSensitive: false, isSubstringMode: false,
            matrix: [], arrowTable: [], steps: [], currentStep: -1,
            isPlaying: false, playInterval: null,
            stats: { comparisons: 0, matrixWrites: 0 }, // Keeping stats in case you re-add later
        };
    }

    bindEventListeners() {
        this.dom.startBtn.addEventListener('click', () => this.start());
        this.dom.resetBtn.addEventListener('click', () => this.reset());
        this.dom.nextBtn.addEventListener('click', () => this.nextStep());
        this.dom.prevBtn.addEventListener('click', () => this.prevStep());
        this.dom.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.dom.speedSlider.addEventListener('input', () => this.updateSpeed());
        this.dom.presets.addEventListener('change', (e) => this.applyPreset(e.target.value));
        this.dom.jumpToStep.addEventListener('change', (e) => this.jumpToStep(parseInt(e.target.value)));
        
        // Dark mode toggle is removed from HTML, but keeping the listener for completeness if you re-add.
        // Or you can remove this line if it's truly not needed.
        if (this.dom.darkModeToggle) {
             this.dom.darkModeToggle.addEventListener('change', () => document.body.classList.toggle('dark-mode'));
        }

        window.addEventListener('keydown', (e) => {
            if (this.state.steps.length === 0 || document.activeElement.tagName === 'INPUT') return;
            switch(e.code) {
                case 'Space': e.preventDefault(); this.togglePlayPause(); break;
                case 'KeyN': case 'ArrowRight': this.nextStep(); break;
                case 'KeyP': case 'ArrowLeft': this.prevStep(); break;
                case 'KeyR': this.reset(); break;
            }
        });
    }

    reset() {
        Object.assign(this.state, this.getInitialState());
        this.dom.grid.innerHTML = '';
        ['s1Input', 's2Input', 'presets', 'algorithmSelect', 'caseSensitiveCheckbox', 'substringModeCheckbox', 'startBtn'].forEach(id => this.dom[id].disabled = false);
        this.dom.resetBtn.disabled = true;
        this.dom.playbackControls.style.display = 'none';
        this.dom.jumpToStep.style.display = 'none';
        this.dom.stepCounter.textContent = 'Step: 0 / 0';
        this.dom.finalLcsDisplay.innerHTML = '';
        this.stopPlayback();
    }

    start() {
        this.state.s1 = this.dom.s1Input.value;
        this.state.s2 = this.dom.s2Input.value;
        this.state.isCaseSensitive = this.dom.caseSensitiveCheckbox.checked;
        this.state.isSubstringMode = this.dom.substringModeCheckbox.checked;

        if (this.state.s1.length > 100 || this.state.s2.length > 100) {
            if (!confirm("Warning: Large inputs may impact performance. Continue?")) return;
        }
        
        ['s1Input', 's2Input', 'presets', 'algorithmSelect', 'caseSensitiveCheckbox', 'substringModeCheckbox', 'startBtn'].forEach(id => this.dom[id].disabled = true);
        this.dom.resetBtn.disabled = false;
        this.dom.playbackControls.style.display = 'flex';
        this.dom.jumpToStep.style.display = 'inline-block';
        
        this.generateSteps();
        this.setupGrid();
        this.populateJumpToDropdown();
        this.state.currentStep = -1;
        this.nextStep();
    }
    
    // --- Step Generation & Algorithm Logic ---
    generateSteps() {
        const { s1, s2, isCaseSensitive, isSubstringMode } = this.state;
        const m = s1.length, n = s2.length;
        
        this.state.steps = [];
        this.state.matrix = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        this.state.arrowTable = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));
        this.state.stats = { comparisons: 0, matrixWrites: 0 };
        
        let maxLen = 0, maxI = 0;

        this.state.steps.push({ type: 'init', message: 'Initialize a Matrix of size (m+1) x (n+1) with zeros.' });
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const char1 = s1[i - 1], char2 = s2[j - 1];
                const c1 = isCaseSensitive ? char1 : char1.toLowerCase();
                const c2 = isCaseSensitive ? char2 : char2.toLowerCase();
                
                this.state.stats.comparisons++;
                const step = { type: 'cell-eval', i, j, char1, char2, dependencies: [] };

                if (c1 === c2) {
                    const newVal = this.state.matrix[i - 1][j - 1] + 1;
                    this.state.matrix[i][j] = newVal;
                    this.state.arrowTable[i][j] = 'diag';
                    step.rule = 'match';
                    step.after = newVal;
                    step.dependencies.push({i: i-1, j: j-1});
                    if (isSubstringMode && newVal > maxLen) { maxLen = newVal; maxI = i; }
                } else {
                    if (isSubstringMode) {
                        this.state.matrix[i][j] = 0;
                        step.rule = 'substring-mismatch';
                        step.after = 0;
                    } else {
                        const upVal = this.state.matrix[i-1][j];
                        const leftVal = this.state.matrix[i][j-1];
                        step.dependencies.push({i: i-1, j}, {i, j: j-1});
                        if (upVal >= leftVal) {
                            this.state.matrix[i][j] = upVal;
                            this.state.arrowTable[i][j] = 'up';
                            step.rule = 'mismatch-up';
                            step.after = upVal;
                        } else {
                            this.state.matrix[i][j] = leftVal;
                            this.state.arrowTable[i][j] = 'left';
                            step.rule = 'mismatch-left';
                            step.after = leftVal;
                        }
                    }
                }
                this.state.stats.matrixWrites++;
                this.state.steps.push(step);
            }
        }
        
        const lcs = isSubstringMode ? (maxLen > 0 ? s1.substring(maxI - maxLen, maxI) : "") : this.tracebackLCS(m, n);
        this.state.steps.push({ type: 'traceback', path: this.getTracebackPath(m, n, maxLen, maxI), lcs });
    }
    
    tracebackLCS(m, n) {
        let lcs = ''; let i = m, j = n;
        while (i > 0 && j > 0) {
            const arrow = this.state.arrowTable[i][j];
            if (arrow === 'diag') { lcs = this.state.s1[i-1] + lcs; i--; j--; }
            else if (arrow === 'up') { i--; }
            else { j--; }
        }
        return lcs;
    }
    
    getTracebackPath(m, n, maxLen, maxI) {
        let path = []; let i, j;
        if (this.state.isSubstringMode) {
            if (maxLen === 0) return [];
            i = maxI;
            for (let k = 1; k <= n; k++) { if(this.state.matrix[i][k] === maxLen) { j = k; break; } }
            while (i > 0 && j > 0 && this.state.matrix[i][j] > 0) { path.unshift({i, j}); i--; j--; }
        } else {
            i = m; j = n;
            while (i > 0 && j > 0) {
                const arrow = this.state.arrowTable[i][j];
                if (!arrow) break;
                path.unshift({i, j});
                if (arrow === 'diag') { i--; j--; }
                else if (arrow === 'up') { i--; }
                else { j--; }
            }
        }
        return path;
    }

    // --- UI Rendering ---
    setupGrid() {
        const { s1, s2 } = this.state;
        this.dom.grid.innerHTML = '';
        
        const thead = document.createElement('thead');
        let tr = document.createElement('tr');
        tr.innerHTML = '<th></th><th>Ø</th>' + [...s2].map(c => `<th>${c}</th>`).join('');
        thead.appendChild(tr);
        this.dom.grid.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        tr = document.createElement('tr');
        tr.innerHTML = '<th>Ø</th>' + Array(s2.length + 1).fill().map((_, j) => `<td id="cell-0-${j}" class="matrix-cell"><span class="matrix-cell-content"></span></td>`).join('');
        tbody.appendChild(tr);

        for (let i = 1; i <= s1.length; i++) {
            tr = document.createElement('tr');
            tr.innerHTML = `<th>${s1[i-1]}</th>` + Array(s2.length + 1).fill().map((_, j) =>
                `<td id="cell-${i}-${j}" class="matrix-cell">
                    <svg class="arrow-svg"></svg>
                    <span class="matrix-cell-content"></span>
                </td>`
            ).join('');
            tbody.appendChild(tr);
        }
        this.dom.grid.appendChild(tbody);
    }
    
    updateUIForStep() {
        if (this.state.currentStep < 0 || this.state.currentStep >= this.state.steps.length) return;

        this.updateStepCounter();
        this.clearHighlights();
        
        const step = this.state.steps[this.state.currentStep];

        for (let k = 0; k <= this.state.currentStep; k++) this.renderStepState(this.state.steps[k]);
        for (let k = this.state.currentStep + 1; k < this.state.steps.length; k++) this.clearStepState(this.state.steps[k]);
        
        if (step.type === 'cell-eval') {
            this.highlightCell(step.i, step.j, 'current');
            step.dependencies.forEach(dep => this.highlightCell(dep.i, dep.j, 'dependency'));
        } else if (step.type === 'traceback') {
            this.drawTracebackPath(step.path);
            this.displayFinalLCS(step.lcs);
        }
        
        this.dom.prevBtn.disabled = this.state.currentStep <= 0;
        this.dom.nextBtn.disabled = this.state.currentStep >= this.state.steps.length - 1;
        this.dom.playPauseBtn.disabled = this.state.currentStep >= this.state.steps.length - 1;
    }
    
    renderStepState(step) {
        if (step.type === 'init') {
            for (let i = 0; i <= this.state.s1.length; i++) { document.getElementById(`cell-${i}-0`).querySelector('.matrix-cell-content').textContent = 0; }
            for (let j = 0; j <= this.state.s2.length; j++) { document.getElementById(`cell-0-${j}`).querySelector('.matrix-cell-content').textContent = 0; }
        } else if (step.type === 'cell-eval') {
            const cell = document.getElementById(`cell-${step.i}-${step.j}`);
            if (cell) {
                cell.querySelector('.matrix-cell-content').textContent = step.after;
                this.drawArrowForStep(step);
            }
        }
    }

    clearStepState(step) {
        if (step.type === 'cell-eval') {
            const cell = document.getElementById(`cell-${step.i}-${step.j}`);
            if (cell) {
                cell.querySelector('.matrix-cell-content').textContent = '';
                const svg = cell.querySelector('.arrow-svg');
                if (svg) svg.innerHTML = '';
            }
        }
    }

    highlightCell(i, j, className) {
        const cell = document.getElementById(`cell-${i}-${j}`);
        if (cell) cell.classList.add(className);
    }
    
    clearHighlights() {
        this.dom.grid.querySelectorAll('.current, .dependency, .traceback-cell, .correct, .incorrect').forEach(el => el.classList.remove('current', 'dependency', 'traceback-cell', 'correct', 'incorrect'));
        this.dom.grid.querySelectorAll('.traceback-arrow').forEach(el => el.classList.remove('traceback-arrow'));
    }

    drawArrowForStep(step) {
        const arrowType = this.state.arrowTable[step.i][step.j];
        if (!arrowType) return;
        const svg = document.querySelector(`#cell-${step.i}-${step.j} .arrow-svg`);
        if (!svg) return;
        const arrowPaths = {
            'diag': '<line x1="100%" y1="100%" x2="0%" y2="0%"></line>',
            'up':   '<line x1="50%" y1="100%" x2="50%" y2="0%"></line>',
            'left': '<line x1="100%" y1="50%" x2="0%" y2="50%"></line>'
        };
        svg.innerHTML = arrowPaths[arrowType] || '';
    }
    
    drawTracebackPath(path) {
        path.forEach(({i, j}) => {
            const cell = document.getElementById(`cell-${i}-${j}`);
            if (cell) {
                cell.classList.add('traceback-cell');
                cell.querySelector('.arrow-svg')?.classList.add('traceback-arrow');
            }
        });
    }

    displayFinalLCS(lcs) {
        this.dom.finalLcsDisplay.innerHTML = `Final Result: <span class="match">${lcs || '""'}</span> (Length: ${lcs.length})`;
    }

    // --- Controls & Playback ---
    nextStep() { if (this.state.currentStep < this.state.steps.length - 1) { this.state.currentStep++; this.updateUIForStep(); } else { this.stopPlayback(); } }
    prevStep() { if (this.state.currentStep > 0) { this.state.currentStep--; this.updateUIForStep(); } }
    jumpToStep(stepIndex) { this.state.currentStep = stepIndex; this.updateUIForStep(); }
    togglePlayPause() { if (this.state.currentStep >= this.state.steps.length - 1) return; if (this.state.isPlaying) this.stopPlayback(); else this.startPlayback(); }
    startPlayback() { this.state.isPlaying = true; this.dom.playPauseBtn.textContent = 'Pause'; this.nextStep(); this.state.playInterval = setInterval(() => this.nextStep(), this.dom.speedSlider.value); }
    stopPlayback() { this.state.isPlaying = false; this.dom.playPauseBtn.textContent = 'Play'; clearInterval(this.state.playInterval); }
    updateSpeed() { if (this.state.isPlaying) { this.stopPlayback(); this.startPlayback(); } }
    
    // --- Utility Functions ---
    populateJumpToDropdown() { this.dom.jumpToStep.innerHTML = this.state.steps.map((step, index) => `<option value="${index}">Step ${index}: ${step.type==='cell-eval' ? `Cell (${step.i},${step.j})` : step.type.charAt(0).toUpperCase() + step.type.slice(1)}</option>`).join(''); }
    updateStepCounter() { this.dom.stepCounter.textContent = `Step: ${this.state.currentStep} / ${this.state.steps.length - 1}`; if(this.dom.jumpToStep.options.length) this.dom.jumpToStep.value = this.state.currentStep; }
    applyPreset(value) { const [s1, s2] = value.split(','); this.dom.s1Input.value = s1; this.dom.s2Input.value = s2; }
}

document.addEventListener('DOMContentLoaded', () => {
    new LCSVisualizer();
});