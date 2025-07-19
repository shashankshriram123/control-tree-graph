// --- Canvas and Context Setup ---
const canvas = document.getElementById('treeCanvas');
const ctx = canvas.getContext('2d');

// --- DOM Elements ---
const createSubBranchBtn = document.getElementById('createSubBranchBtn');
const expandBranchBtn = document.getElementById('expandBranchBtn');
const infoPanel = document.getElementById('infoPanel');
const logContainer = document.getElementById('log-container');
const deleteExtensionBtn = document.getElementById('deleteExtensionBtn');
const deleteChildrenBtn = document.getElementById('deleteChildrenBtn');
const deleteNodeBtn = document.getElementById('deleteNodeBtn');
const foldBtn = document.getElementById('foldBtn');
const unfoldBtn = document.getElementById('unfoldBtn');
const collapseBtn = document.getElementById('collapseBtn');

// --- Configuration ---
const NODE_RADIUS = 8;
const NODE_SELECTED_RADIUS = 10;
const BRANCH_WIDTH = 4;
const BRANCH_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'];
const GRID_SPACING = 60;

// --- Data & State ---
let branches = [];
let selectedNode = null;
let nextColorIndex = 0;
let nextNodeId = 1;
let nextBranchId = 1;
let actionLog = [];
let camera = { x: -canvas.width / 3, y: -canvas.height / 2 + 50 };

// Interaction State
let isPanning = false;
let panStart = { x: 0, y: 0 };
let mouseDownPos = null;
let didDrag = false;

// Represents a single node in the graph
class Node {
    constructor(x, y, branch) {
        this.id = nextNodeId++;
        this.x = x;
        this.y = y;
        this.branch = branch;
        this.isHead = false;
        this.isHidden = false;
    }
    draw() {
        if (this.isHidden) return;
        
        const hasHiddenChildren = branches.some(b => b.parentNode === this && b.isHidden);
        const hasHiddenExtension = this.branch.nodes.some(n => n.y < this.y && n.isHidden);

        if (hasHiddenChildren || hasHiddenExtension) {
            ctx.shadowColor = '#06b6d4'; // Neon cyan
            ctx.shadowBlur = 15;
        }
        
        ctx.beginPath();
        const radius = (this === selectedNode) ? NODE_SELECTED_RADIUS : NODE_RADIUS;
        const color = (this === selectedNode) ? '#ffffff' : this.branch.color;
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Reset shadow for other elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        if (this !== selectedNode) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, NODE_RADIUS * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
        }
    }
    isClicked(pointX, pointY) {
        if (this.isHidden) return false;
        const distance = Math.sqrt(Math.pow(this.x - pointX, 2) + Math.pow(this.y - pointY, 2));
        return distance < NODE_RADIUS * 1.5;
    }
}

// Represents a branch, which is a collection of nodes
class Branch {
    constructor(color, parentNode = null) {
        this.id = nextBranchId++;
        this.nodes = [];
        this.color = color;
        this.parentNode = parentNode;
        this.isHidden = false;
    }
    addNode(node) {
        this.nodes.push(node);
        this.nodes.sort((a, b) => b.y - a.y);
    }
    draw() {
        if (this.isHidden) return;

        const visibleNodes = this.nodes.filter(n => !n.isHidden);
        if (visibleNodes.length < 1) return;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = BRANCH_WIDTH;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        if (this.parentNode) {
            ctx.beginPath();
            ctx.moveTo(this.parentNode.x + NODE_RADIUS, this.parentNode.y);
            ctx.lineTo(visibleNodes[0].x, visibleNodes[0].y);
            ctx.stroke();
        }
        
        for (let i = 0; i < visibleNodes.length - 1; i++) {
            const n1 = visibleNodes[i];
            const n2 = visibleNodes[i+1];
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y - NODE_RADIUS);
            ctx.lineTo(n2.x, n2.y + NODE_RADIUS);
            ctx.stroke();
        }
    }
}

// --- Core Logic Functions ---
function init() {
    branches = [];
    actionLog = [];
    nextNodeId = 1;
    nextBranchId = 1;
    nextColorIndex = 0;
    const mainBranch = new Branch(getNextColor());
    const startX = Math.round(canvas.width / 2);
    const rootNode = new Node(startX, Math.round(canvas.height / 2 + GRID_SPACING), mainBranch);
    const middleNode = new Node(startX, Math.round(canvas.height / 2), mainBranch);
    const headNode = new Node(startX, Math.round(canvas.height / 2 - GRID_SPACING), mainBranch);
    headNode.isHead = true;
    mainBranch.addNode(rootNode);
    mainBranch.addNode(middleNode);
    mainBranch.addNode(headNode);
    branches.push(mainBranch);
    logAction(`INIT: Created Main Branch #${mainBranch.id}`);
    draw();
}

function relayout() {
    logAction(`RELAYOUT: Reorganizing entire graph.`);
    const mainBranch = branches.find(b => b.parentNode === null);
    if (!mainBranch) return;

    const childrenMap = new Map();
    branches.forEach(b => {
        if (b.parentNode) {
            const parentId = b.parentNode.branch.id;
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId).push(b);
        }
    });

    for (const children of childrenMap.values()) {
        children.sort((a, b) => a.parentNode.y - b.parentNode.y);
    }

    function layoutSubtree(branch, startX) {
        const visibleNodes = branch.nodes.filter(n => !n.isHidden);
        if (visibleNodes.length === 0 && !branch.isHidden) {
             return startX;
        }
        
        const currentX = branch.nodes[0].x;
        const shiftX = startX - currentX;
        if (shiftX !== 0) {
            logAction(`  -> SHIFT: Branch #${branch.id} moved to X=${startX}.`);
            branch.nodes.forEach(node => node.x += shiftX);
        }
        
        let rightmostX = startX;
        const children = childrenMap.get(branch.id) || [];
        
        children.forEach(child => {
            if (!child.isHidden) {
                const childStartX = rightmostX + GRID_SPACING;
                const subtreeEndX = layoutSubtree(child, childStartX);
                rightmostX = subtreeEndX;
            }
        });
        return rightmostX;
    }

    let currentX = mainBranch.nodes[0].x;
    const rootChildren = childrenMap.get(mainBranch.id) || [];
    rootChildren.forEach(child => {
        if (!child.isHidden) {
            const childStartX = currentX + GRID_SPACING;
            const subtreeEndX = layoutSubtree(child, childStartX);
            currentX = subtreeEndX;
        }
    });
}

function createSubBranch() {
    if (!selectedNode) return;
    const parentNode = selectedNode;
    if (branches.some(b => b.parentNode === parentNode)) return;
    const newBranch = new Branch(getNextColor(), parentNode);
    const newNode = new Node(parentNode.x + GRID_SPACING, parentNode.y, newBranch);
    newNode.isHead = true;
    newBranch.addNode(newNode);
    branches.push(newBranch);
    logAction(`CREATE: Branch #${newBranch.id} from Parent Node #${parentNode.id}.`);
    relayout();
    deselectNode();
    draw();
}

function expandBranch() {
    if (!selectedNode || !selectedNode.isHead) return;
    const headNode = selectedNode;
    const branch = headNode.branch;
    headNode.isHead = false;
    const newHeadNode = new Node(headNode.x, headNode.y - GRID_SPACING, branch);
    newHeadNode.isHead = true;
    branch.addNode(newHeadNode);
    logAction(`EXPAND: Branch #${branch.id} with new Head Node #${newHeadNode.id}.`);
    relayout();
    selectNode(newHeadNode);
    draw();
}

function getDescendantBranches(startNode) {
    const directChildren = branches.filter(b => b.parentNode === startNode);
    if (directChildren.length === 0) return [];

    const allDescendants = new Set(directChildren);
    let search = true;
    while (search) {
        search = false;
        branches.forEach(b => {
            if (b.parentNode && allDescendants.has(b.parentNode.branch)) {
                if (!allDescendants.has(b)) {
                    allDescendants.add(b);
                    search = true;
                }
            }
        });
    }
    return [...allDescendants];
}

function deleteSelectedChildren() {
    if (!selectedNode) return;
    logAction(`DELETE CHILDREN: Deleting all descendants of Node #${selectedNode.id}.`);
    const branchesToRemove = getDescendantBranches(selectedNode);
    branches = branches.filter(b => !branchesToRemove.includes(b));
    deselectNode();
    relayout();
    draw();
}

function deleteSelectedExtension() {
    if (!selectedNode || selectedNode.isHead || selectedNode.branch.parentNode === null) return;
    
    const nodeToDeleteFrom = selectedNode;
    const branch = nodeToDeleteFrom.branch;
    logAction(`DELETE EXTENSION: Deleting extension above Node #${nodeToDeleteFrom.id}.`);

    const nodesToRemove = new Set();
    branch.nodes.forEach(node => {
        if (node.y < nodeToDeleteFrom.y) {
            nodesToRemove.add(node);
        }
    });

    const branchesToRemove = new Set();
    nodesToRemove.forEach(node => {
        getDescendantBranches(node).forEach(b => branchesToRemove.add(b));
    });

    branches = branches.filter(b => !branchesToRemove.has(b));
    branch.nodes = branch.nodes.filter(n => !nodesToRemove.has(n));
    nodeToDeleteFrom.isHead = true;

    deselectNode();
    relayout();
    draw();
}

function deleteSelectedNode() {
    if (!selectedNode || selectedNode.branch.parentNode === null) return;
    logAction(`DELETE NODE: Deleting Node #${selectedNode.id} and its entire sub-tree.`);
    
    const childBranchesToRemove = getDescendantBranches(selectedNode);
    
    const branch = selectedNode.branch;
    const extensionNodesToRemove = new Set();
    branch.nodes.forEach(node => {
        if (node.y < selectedNode.y) {
            extensionNodesToRemove.add(node);
        }
    });
    
    const extensionChildrenToRemove = new Set();
    extensionNodesToRemove.forEach(node => {
         getDescendantBranches(node).forEach(b => extensionChildrenToRemove.add(b));
    });

    const allBranchesToRemove = new Set([...childBranchesToRemove, ...extensionChildrenToRemove]);

    branches = branches.filter(b => !allBranchesToRemove.has(b));
    branch.nodes = branch.nodes.filter(n => n.y > selectedNode.y);

    if (branch.nodes.length > 0) {
        branch.nodes[branch.nodes.length - 1].isHead = true;
    } else {
        branches = branches.filter(b => b.id !== branch.id);
    }

    deselectNode();
    relayout();
    draw();
}

function foldSelected() {
    if (!selectedNode) return;
    logAction(`FOLD: Hiding all descendants of Node #${selectedNode.id}.`);
    getDescendantBranches(selectedNode).forEach(b => b.isHidden = true);
    relayout();
    draw();
}

function collapseSelected() {
    if (!selectedNode || selectedNode.isHead) return;
    logAction(`COLLAPSE: Hiding extension above Node #${selectedNode.id}.`);
    
    const branch = selectedNode.branch;
    const nodesToHide = branch.nodes.filter(node => node.y < selectedNode.y);

    nodesToHide.forEach(node => {
        getDescendantBranches(node).forEach(b => b.isHidden = true);
    });

    nodesToHide.forEach(node => {
        node.isHidden = true;
    });

    selectedNode.isHead = true;
    relayout();
    draw();
}

function unfoldSelected() {
    if (!selectedNode) return;
    logAction(`UNFOLD: Unfolding all content at Node #${selectedNode.id}.`);
    
    const descendants = getDescendantBranches(selectedNode);
    descendants.forEach(b => {
        b.isHidden = false;
        b.nodes.forEach(n => n.isHidden = false);
    });

    const branch = selectedNode.branch;
    branch.nodes.forEach(n => {
        n.isHidden = false;
        n.isHead = false;
    });
    
    if (branch.nodes.length > 0) {
        branch.nodes[branch.nodes.length - 1].isHead = true;
    }

    relayout();
    draw();
}

// --- Logging and UI Update ---
function logAction(message) {
    const timestamp = new Date().toLocaleTimeString();
    actionLog.push(`[${timestamp}] ${message}`);
    renderLog();
}
function renderLog() {
    logContainer.innerHTML = actionLog.map(msg => `<p>${msg}</p>`).join('');
    logContainer.scrollTop = logContainer.scrollHeight;
}
function getNextColor() {
    const color = BRANCH_COLORS[nextColorIndex];
    nextColorIndex = (nextColorIndex + 1) % BRANCH_COLORS.length;
    return color;
}
function selectNode(node) {
    selectedNode = node;
    updateUI();
}
function deselectNode() {
    selectedNode = null;
    updateUI();
}
function updateUI() {
    if (selectedNode) {
        const isMainBranchNode = selectedNode.branch.parentNode === null;
        const hasChildBranches = branches.some(b => b.parentNode === selectedNode);
        const hasVisibleChildren = branches.some(b => b.parentNode === selectedNode && !b.isHidden);
        const hasHiddenChildren = branches.some(b => b.parentNode === selectedNode && b.isHidden);
        const hasHiddenExtension = selectedNode.branch.nodes.some(n => n.y < selectedNode.y && n.isHidden);

        createSubBranchBtn.disabled = hasChildBranches;
        expandBranchBtn.disabled = !selectedNode.isHead;
        foldBtn.disabled = !hasVisibleChildren;
        collapseBtn.disabled = selectedNode.isHead || isMainBranchNode;
        unfoldBtn.disabled = !hasHiddenChildren && !hasHiddenExtension;
        deleteChildrenBtn.disabled = !hasChildBranches;
        deleteExtensionBtn.disabled = selectedNode.isHead || isMainBranchNode;
        deleteNodeBtn.disabled = isMainBranchNode;

        let infoText = `Node #${selectedNode.id} on Branch #${selectedNode.branch.id} selected.`;
        if (selectedNode.isHead) infoText += ' This is a head node.';
        if (hasChildBranches) infoText += ' It has child branches.';
        infoPanel.innerHTML = infoText;
    } else {
        createSubBranchBtn.disabled = true;
        expandBranchBtn.disabled = true;
        foldBtn.disabled = true;
        collapseBtn.disabled = true;
        unfoldBtn.disabled = true;
        deleteChildrenBtn.disabled = true;
        deleteExtensionBtn.disabled = true;
        deleteNodeBtn.disabled = true;
        infoPanel.textContent = 'Click a node to select it.';
    }
}

// --- Drawing & Rendering ---
function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const startX = Math.floor(-camera.x / GRID_SPACING) * GRID_SPACING;
    const startY = Math.floor(-camera.y / GRID_SPACING) * GRID_SPACING;
    for (let x = startX; x < canvas.width - camera.x; x += GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo(x, -camera.y);
        ctx.lineTo(x, canvas.height - camera.y);
        ctx.stroke();
    }
    for (let y = startY; y < canvas.height - camera.y; y += GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo(-camera.x, y);
        ctx.lineTo(canvas.width - camera.x, y);
        ctx.stroke();
    }
}
function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(camera.x, camera.y);
    drawGrid();
    branches.forEach(branch => {
        if (!branch.isHidden) {
            branch.draw();
            branch.nodes.forEach(node => node.draw());
        }
    });
    ctx.restore();
}

// --- Event Listeners ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - camera.x,
        y: e.clientY - rect.top - camera.y
    };
}

canvas.addEventListener('mousedown', (e) => {
    isPanning = false;
    didDrag = false;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    panStart.x = e.clientX - camera.x;
    panStart.y = e.clientY - camera.y;
});

canvas.addEventListener('mousemove', (e) => {
    if (mouseDownPos) {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        if (dx > 5 || dy > 5) {
            didDrag = true;
            isPanning = true;
            canvas.classList.add('panning');
        }
    }
    if (isPanning) {
        camera.x = e.clientX - panStart.x;
        camera.y = e.clientY - panStart.y;
        draw();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!didDrag) {
        const worldPos = getMousePos(e);
        let clickedNode = null;
        for (const branch of branches) {
            if (!branch.isHidden) {
                for (const node of branch.nodes) {
                    if (node.isClicked(worldPos.x, worldPos.y)) {
                        clickedNode = node;
                        break;
                    }
                }
            }
            if (clickedNode) break;
        }
        if (clickedNode) {
            selectNode(clickedNode);
        } else {
            deselectNode();
        }
        draw();
    }
    isPanning = false;
    canvas.classList.remove('panning');
    mouseDownPos = null;
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    canvas.classList.remove('panning');
    mouseDownPos = null;
});

createSubBranchBtn.addEventListener('click', createSubBranch);
expandBranchBtn.addEventListener('click', expandBranch);
foldBtn.addEventListener('click', foldSelected);
unfoldBtn.addEventListener('click', unfoldSelected);
collapseBtn.addEventListener('click', collapseSelected);
deleteExtensionBtn.addEventListener('click', deleteSelectedExtension);
deleteChildrenBtn.addEventListener('click', deleteSelectedChildren);
deleteNodeBtn.addEventListener('click', deleteSelectedNode);

window.addEventListener('resize', () => {
    draw();
});

// --- Start the application ---
init();
