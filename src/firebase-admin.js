import admin from "firebase-admin";
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// In a real application, you would download your service account key from the Firebase Console
// and either point to it with GOOGLE_APPLICATION_CREDENTIALS or load it directly.
// For now, we'll assume it's provided via environment variables or a JSON file.

let serviceAccount;

// 1. Try to load from environment variable
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
} catch (error) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT env var:", error.message);
}

// 2. If not in env, try to load from the specific JSON file provided by the user
if (!serviceAccount) {
    const possiblePaths = [
        path.join(process.cwd(), "..", "ichat-6af52-firebase-adminsdk-fbsvc-1c8b99254f.json"),
        path.join(process.cwd(), "ichat-6af52-firebase-adminsdk-fbsvc-1c8b99254f.json")
    ];

    for (const credsPath of possiblePaths) {
        if (fs.existsSync(credsPath)) {
            try {
                const fileData = fs.readFileSync(credsPath, 'utf8');
                serviceAccount = JSON.parse(fileData);
                console.log(`Loaded Firebase credentials from ${credsPath}`);
                break;
            } catch (error) {
                console.error(`Error reading Firebase credentials file at ${credsPath}:`, error.message);
            }
        }
    }
}


if (serviceAccount && admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else if (admin.apps.length === 0) {
    console.warn("Firebase Admin SDK not initialized: FIREBASE_SERVICE_ACCOUNT not found.");
    // Initialize with default credentials if available (e.g., in Google Cloud environment)
    try {
        admin.initializeApp();
    } catch (e) {
        // Silently fail if no default credentials
    }
}


export default admin;

