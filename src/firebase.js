import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

/**
 * @typedef {Object} FirestoreErrorInfo
 * @property {string} error
 * @property {string} operationType
 * @property {string|null} path
 * @property {Object} authInfo
 */


function getFriendlyMessage(error, operationType) {
  const msg = error?.message || '';
  const code = error?.code || '';

  if (code === 'permission-denied' || msg.includes('permission')) {
    return "You don't have permission to perform this action.";
  }
  if (code === 'not-found') {
    return "The item you're looking for could not be found.";
  }
  if (code === 'unavailable' || msg.includes('network')) {
    return 'Connection error. Please check your internet and try again.';
  }
  if (code === 'already-exists') {
    return 'This item already exists.';
  }

  switch (operationType) {
    case OperationType.CREATE:
      return 'Could not save your request. Please try again.';
    case OperationType.UPDATE:
      return 'Could not update. Please try again.';
    case OperationType.DELETE:
      return 'Could not delete. Please try again.';
    case OperationType.LIST:
    case OperationType.GET:
      return 'Could not load data. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  const friendlyMessage = getFriendlyMessage(error, operationType);
  alert(friendlyMessage);
  throw new Error(friendlyMessage);
}
