import { 
    collection, addDoc, query, where, onSnapshot, orderBy, getDoc, doc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase.js';

const els = {
    ticketForm: document.getElementById('ticket-form'),
    ticketTitle: document.getElementById('ticket-title'),
    ticketDesc: document.getElementById('ticket-desc'),
    submitTicketBtn: document.getElementById('submit-ticket-btn'),
    ticketModal: document.getElementById('ticket-modal'),
    ticketList: document.getElementById('ticket-list'),
    emptyState: document.getElementById('empty-state'),
    statusFilter: document.getElementById('status-filter'),
    loadingOverlay: document.getElementById('loading-overlay'),
    logoutBtn: document.getElementById('logout-btn'),
    userEmailDisp: document.getElementById('user-display-email'),
    userRoleDisp: document.getElementById('user-display-role'),
    statTotal: document.getElementById('stat-total'),
    statOpen: document.getElementById('stat-open'),
    statClosed: document.getElementById('stat-closed')
};

let state = {
    currentUser: null,
    tickets: []
};

const statusConfig = {
    'open': { label: 'open', class: 'bg-orange-100/50 text-orange-600 border border-orange-200' },
    'in-progress': { label: 'in progress', class: 'bg-blue-100/50 text-blue-600 border border-blue-200' },
    'closed': { label: 'closed', class: 'bg-emerald-100/50 text-emerald-600 border border-emerald-200' },
    'default': { label: 'unknown', class: 'bg-slate-100 text-slate-600' }
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = '/login.html';
    
    state.currentUser = user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
        const data = userDoc.data();
        els.userEmailDisp.innerText = data.email;
        els.userRoleDisp.innerText = data.role;
    }
    
    setupTicketListener();
});

els.logoutBtn.addEventListener('click', () => signOut(auth));

function setupTicketListener() {
    const q = query(
        collection(db, 'tickets'), 
        where('userId', '==', state.currentUser.uid),
        orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        state.tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTickets();
        updateStats();
        els.loadingOverlay.classList.add('opacity-0');
        setTimeout(() => els.loadingOverlay.classList.add('hidden'), 300);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tickets'));
}

function renderTickets() {
    const filter = els.statusFilter.value;
    const filtered = filter === 'all' ? state.tickets : state.tickets.filter(t => t.status === filter);

    els.ticketList.innerHTML = '';
    els.emptyState.classList.toggle('hidden', filtered.length > 0);

    els.ticketList.innerHTML = filtered.map(t => {
        const config = statusConfig[t.status] || statusConfig.default;
        
        return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
            <td class="px-6 py-4 font-mono text-[10px] text-blue-600 font-bold">#${t.id.slice(0, 8)}</td>
            <td class="px-6 py-4">
                <p class="font-bold text-slate-800 text-xs">${t.title}</p>
                <p class="text-[10px] text-slate-500 truncate w-64">${t.description}</p>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${config.class}">
                    ${config.label}
                </span>
            </td>
            <td class="px-6 py-4 text-right text-slate-400 text-[10px] font-bold">
                ${new Date(t.createdAt).toLocaleDateString()}
            </td>
        </tr>`;
    }).join('');
}

function updateStats() {
    els.statTotal.innerText = state.tickets.length;
    els.statOpen.innerText = state.tickets.filter(t => ['open', 'in-progress'].includes(t.status)).length;
    els.statClosed.innerText = state.tickets.filter(t => t.status === 'closed').length;
}

els.statusFilter.addEventListener('change', renderTickets);

els.ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = els.ticketTitle.value;
    const desc = els.ticketDesc.value;

    els.submitTicketBtn.disabled = true;
    els.submitTicketBtn.innerText = 'Submitting...';

    try {
        await addDoc(collection(db, 'tickets'), {
            title,
            description: desc,
            status: 'open',
            userId: state.currentUser.uid,
            userEmail: state.currentUser.email,
            createdAt: new Date().toISOString()
        });

        els.ticketModal.classList.add('hidden');
        els.ticketForm.reset();
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'tickets');
    } finally {
        els.submitTicketBtn.disabled = false;
        els.submitTicketBtn.innerText = 'Commit Ticket'; 
    }
});
