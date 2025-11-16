// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDyQuhTIS6qsm28uBx6jCYwR0dbslz38hM",
  authDomain: "ai-health-assistant-51ecd.firebaseapp.com",
  projectId: "ai-health-assistant-51ecd",
  storageBucket: "ai-health-assistant-51ecd.firebasestorage.app",
  messagingSenderId: "1054123644886",
  appId: "1:1054123644886:web:1ca54dc9c0f71d354f3677"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = firebase.auth();

// Export for use in other files (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { auth };
}

console.log('Firebase initialized successfully');