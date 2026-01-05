/*
  guessnote.live — Analytics (Firebase)

  Uses Firebase Analytics if available; otherwise no-ops.
  Exposes `GuessNote.analytics.logEvent(name, params)`.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};

    const firebaseConfig = {
        apiKey: "AIzaSyDGEX1zVCo3JuKBHDcI8RfCuSCB1mjBfYU",
        authDomain: "guessnote-bd60e.firebaseapp.com",
        projectId: "guessnote-bd60e",
        storageBucket: "guessnote-bd60e.firebasestorage.app",
        messagingSenderId: "844851223216",
        appId: "1:844851223216:web:55a2d4ede6a975ad567975",
        measurementId: "G-GDKGLH9BR5",
    };

    /** @type {any} */
    let analytics = null;

    function init() {
        try {
            if (!root.firebase || !root.firebase.initializeApp) return;

            // Reuse existing app if already initialized.
            const app = root.firebase.apps && root.firebase.apps.length
                ? root.firebase.apps[0]
                : root.firebase.initializeApp(firebaseConfig);

            if (root.firebase.analytics) {
                analytics = root.firebase.analytics(app);
            }
        } catch {
            analytics = null;
        }
    }

    function logEvent(name, params) {
        try {
            if (!analytics) return;
            if (typeof analytics.logEvent === "function") {
                analytics.logEvent(name, params || {});
            }
        } catch {
            // ignore
        }
    }

    init();

    root.GuessNote.analytics = {
        logEvent,
    };
})();
