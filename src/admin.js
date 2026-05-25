import { 
    collection, query, onSnapshot, orderBy, updateDoc, doc, getDoc, getDocs, where, addDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase.js';

const els = {
    ticketList: document.getElementById('admin-ticket-list'),
    emptyState: document.getElementById('admin-empty-state'),
    statusFilter: document.getElementById('admin-status-filter'),
    search: document.getElementById('admin-search'),
    loadingOverlay: document.getElementById('loading-overlay'),
    logoutBtn: document.getElementById('logout-btn'),
    adminEmailDisp: document.getElementById('admin-display-email'),
    globalOpenCount: document.getElementById('global-open-count'),
    globalClosedCount: document.getElementById('global-closed-count'),
    modal: document.getElementById('admin-modal'),
    modalId: document.getElementById('modal-ticket-id'),
    modalTitle: document.getElementById('modal-ticket-title'),
    modalEmail: document.getElementById('modal-user-email'),
    modalDesc: document.getElementById('modal-ticket-desc'),
    modalStatus: document.getElementById('modal-status-select'),
    updateBtn: document.getElementById('admin-update-btn'),
    newAdminEmailInput: document.getElementById('new-admin-email'),
    promoteAdminBtn: document.getElementById('promote-admin-btn'),
    promoteMessage: document.getElementById('promote-message'),
    chatMessages: document.getElementById('admin-chat-messages'),
    chatForm: document.getElementById('admin-chat-form'),
    chatInput: document.getElementById('admin-chat-input')
};

let state = {
    tickets: [],
    selectedTicketId: null,
    unsubscribeChat: null
};

const statusConfig = {
    'open': { label: 'Open', class: 'bg-orange-100/50 text-orange-600 border border-orange-200' },
    'in-progress': { label: 'In Progress', class: 'bg-matcha-100/50 text-matcha-600 border border-matcha-200' },
    'closed': { label: 'Closed', class: 'bg-emerald-100/50 text-emerald-600 border border-emerald-200' },
    'default': { label: 'Unknown', class: 'bg-slate-100 text-slate-600' }
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = '/login.html';

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        alert("You don't have access to this page.");
        return window.location.href = '/dashboard.html';
    }

    els.adminEmailDisp.innerText = user.email;
    setupGlobalTicketListener();
});

els.logoutBtn.addEventListener('click', () => signOut(auth));

function setupGlobalTicketListener() {
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        state.tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminTickets();
        updateGlobalStats();
        els.loadingOverlay.classList.add('opacity-0');
        setTimeout(() => els.loadingOverlay.classList.add('hidden'), 300);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tickets'));
}

function renderAdminTickets() {
    const statusVal = els.statusFilter.value;
    const searchVal = els.search.value.toLowerCase();

    const filtered = state.tickets.filter(t => {
        const matchesStatus = statusVal === 'all' || t.status === statusVal;
        const matchesSearch = t.title.toLowerCase().includes(searchVal) || 
                             (t.userEmail && t.userEmail.toLowerCase().includes(searchVal));
        return matchesStatus && matchesSearch;
    });

    els.ticketList.innerHTML = '';
    els.emptyState.classList.toggle('hidden', filtered.length > 0);

    els.ticketList.innerHTML = filtered.map(t => {
        const config = statusConfig[t.status] || statusConfig.default;
        const dateStr = new Date(t.createdAt).toLocaleDateString();
        const timeStr = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
        <tr class="group hover:bg-matcha-50 transition-colors cursor-pointer border-b border-matcha-100" onclick="window.openDetail('${t.id}')">
            <td class="px-6 py-4">
                <p class="text-[10px] font-black text-matcha-600 uppercase tracking-widest mb-1">#${t.id.slice(0, 8)}</p>
                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">${dateStr} ${timeStr}</p>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <p class="text-sm font-bold text-slate-900 leading-tight">${t.title}</p>
                    <p class="text-[10px] text-slate-500 font-medium truncate w-64 mt-1">${t.description}</p>
                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-2">${t.userEmail || 'Unknown User'}</p>
                </div>
            </td>
            <td class="px-6 py-4">
               <span class="px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest ${config.class}">
                    ${config.label}
                </span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="inline-flex flex-col items-end">
                    <button class="text-matcha-600 font-black text-[9px] uppercase tracking-[0.2em] hover:underline mt-1">View</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function updateGlobalStats() {
    els.globalOpenCount.innerText = state.tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;
    els.globalClosedCount.innerText = state.tickets.filter(t => t.status === 'closed').length;
}

window.openDetail = (id) => {
    const ticket = state.tickets.find(t => t.id === id);
    if (!ticket) return;

    state.selectedTicketId = id;
    els.modalId.innerText = `Request #${id}`;
    els.modalTitle.innerText = ticket.title;
    els.modalEmail.innerText = ticket.userEmail || 'Unknown';
    els.modalDesc.innerText = ticket.description;
    els.modalStatus.value = ticket.status;
    
    els.modal.classList.remove('hidden');
    setupChatListener(id);
};

function setupChatListener(ticketId) {
    if (state.unsubscribeChat) state.unsubscribeChat();

    els.chatMessages.innerHTML = '<div class="text-center py-10"><p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Loading messages...</p></div>';

    const q = query(
        collection(db, 'tickets', ticketId, 'messages'),
        orderBy('createdAt', 'asc')
    );

    state.unsubscribeChat = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => doc.data());
        renderMessages(messages);
    });
}

function renderMessages(messages) {
    if (messages.length === 0) {
        els.chatMessages.innerHTML = '<div class="text-center py-10"><p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No messages yet.</p></div>';
        return;
    }

    els.chatMessages.innerHTML = messages.map(msg => {
        const isMe = msg.senderRole === 'admin';
        
        return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">${isMe ? 'You (Admin)' : 'User'}</span>
                <span class="text-[8px] text-slate-300">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs font-medium shadow-sm ${isMe ? 'bg-matcha-500 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-matcha-100 rounded-tl-none'}">
                ${msg.text}
            </div>
        </div>`;
    }).join('');
    
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

els.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.chatInput.value.trim();
    if (!text || !state.selectedTicketId) return;

    els.chatInput.value = '';
    
    try {
        await addDoc(collection(db, 'tickets', state.selectedTicketId, 'messages'), {
            text,
            senderId: auth.currentUser.uid,
            senderEmail: auth.currentUser.email,
            senderRole: 'admin',
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `tickets/${state.selectedTicketId}/messages`);
    }
});

els.updateBtn.addEventListener('click', async () => {
    if (!state.selectedTicketId) return;
    
    const newStatus = els.modalStatus.value;
    els.updateBtn.disabled = true;
    els.updateBtn.innerText = 'Saving...';

    try {
        await updateDoc(doc(db, 'tickets', state.selectedTicketId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        els.modal.classList.add('hidden');
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tickets/${state.selectedTicketId}`);
    } finally {
        els.updateBtn.disabled = false;
        els.updateBtn.innerText = 'Save';
    }
});

els.promoteAdminBtn.addEventListener('click', async () => {
    const email = els.newAdminEmailInput.value.trim();
    if (!email) return;

    els.promoteAdminBtn.disabled = true;
    els.promoteAdminBtn.innerText = 'Promoting...';
    els.promoteMessage.classList.add('hidden');

    const showMessage = (msg, isError = false) => {
        els.promoteMessage.innerText = msg;
        els.promoteMessage.className = `text-[9px] font-bold mt-1 text-center ${isError ? 'text-red-500' : 'text-emerald-500'}`;
        els.promoteMessage.classList.remove('hidden');
    };

    try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showMessage('User not found.', true);
        } else {
            const userDoc = snapshot.docs[0];
            await updateDoc(doc(db, 'users', userDoc.id), { role: 'admin' });
            showMessage('Successfully promoted!');
            els.newAdminEmailInput.value = '';
        }
    } catch (error) {
        console.error(error);
        showMessage('Failed to promote user.', true);
    } finally {
        els.promoteAdminBtn.disabled = false;
        els.promoteAdminBtn.innerText = 'Promote to Admin';
    }
});

els.statusFilter.addEventListener('change', renderAdminTickets);
els.search.addEventListener('input', renderAdminTickets);
