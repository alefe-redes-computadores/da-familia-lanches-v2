/** DFL Tracking homologation: explicit opt-in, fail closed, never fall back to commerce Firebase. */
export type DflWebFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const production: DflWebFirebaseConfig = {
  apiKey: 'AIzaSyATQBcbYuzKpKlSwNlbpRiAM1XyHqhGeak',
  authDomain: 'da-familia-lanches.firebaseapp.com',
  projectId: 'da-familia-lanches',
  storageBucket: 'da-familia-lanches.appspot.com',
  messagingSenderId: '106857147317',
  appId: '1:106857147317:web:769c98aed26bb8fc9e87fc',
};

export function firebaseConfigForCurrentBuild(): DflWebFirebaseConfig {
  if (process.env.NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION !== '1') return production;

  const isolated: DflWebFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };
  const correctProject =
    isolated.projectId === 'dfl-finance' &&
    isolated.authDomain === 'dfl-finance.firebaseapp.com' &&
    isolated.storageBucket === 'dfl-finance.firebasestorage.app' &&
    isolated.messagingSenderId === '726269935852' &&
    isolated.appId === '1:726269935852:web:628cd23152f0f3d1f6a5c9';
  const validKey = /^AIza[A-Za-z0-9_-]{30,50}$/.test(isolated.apiKey);
  if (!correctProject || !validKey) {
    throw new Error('DFL_TRACKING_HML_FIREBASE_ISOLATION_REQUIRED');
  }
  return isolated;
}
