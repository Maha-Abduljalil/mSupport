import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const els = {
    form: document.getElementById('auth-form'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    error: document.getElementById('error-message'),
    submitBtn: document.getElementById('submit-btn'),
    toggleAuthBtn: document.getElementById('toggle-auth'),
    title: document.getElementById('auth-title'),
    subtitle: document.getElementById('auth-subtitle'),
    toggleText: document.getElementById('toggle-text')
};

let isLogin = window.location.hash !== '#register';

function updateUI() {
    els.title.innerText = isLogin ? 'Welcome Back' : 'Create Account';
    els.subtitle.innerText = isLogin ? 'Sign in to continue' : 'Set up your new account';
    els.submitBtn.innerText = isLogin ? 'Sign In' : 'Create Account';
    els.toggleText.innerText = isLogin ? "Don't have an account?" : "Already have an account?";
    els.toggleAuthBtn.innerText = isLogin ? 'Sign Up' : 'Sign In';
    els.error.classList.add('hidden');
}

els.toggleAuthBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    updateUI();
});

function getFriendlyError(error) {
    const code = error?.code || '';
    const messages = {
        'auth/user-not-found': 'Incorrect email or password. Please try again.',
        'auth/wrong-password': 'Incorrect email or password. Please try again.',
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password is too short. Use at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Connection error. Please check your internet.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.'
    };
    return messages[code] || 'Something went wrong. Please try again.';
}

async function redirectUser(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const role = userDoc.exists() ? userDoc.data().role : 'user';
    window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';
}

els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.error.classList.add('hidden');
    els.submitBtn.disabled = true;
    els.submitBtn.innerText = 'Please wait...';

    const email = els.email.value.trim();
    const password = els.password.value;

    try {
        if (isLogin) {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            await redirectUser(credential.user.uid);
        } else {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', credential.user.uid), {
                uid: credential.user.uid,
                email: email,
                role: 'user',
                createdAt: new Date().toISOString()
            });
            await redirectUser(credential.user.uid);
        }
    } catch (error) {
        els.error.innerText = getFriendlyError(error);
        els.error.classList.remove('hidden');
        els.submitBtn.disabled = false;
        els.submitBtn.innerText = isLogin ? 'Sign In' : 'Create Account';
    }
});


updateUI();

onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname !== '/login.html') {

    }
});
