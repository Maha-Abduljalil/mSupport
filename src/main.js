import "./index.css";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Logged in user detected on landing page');
    }
});
