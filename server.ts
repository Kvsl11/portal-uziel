import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import cron from "node-cron";
import { APP_ID } from "./constants.js";

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const app = express();
const PORT = 3000;

app.use(express.json());

// API routes
app.post("/api/register-token", async (req, res) => {
  const { userId, token } = req.body;
  // Store token in Firestore
  await admin.firestore().collection("users").doc(userId).set({ fcmToken: token }, { merge: true });
  res.json({ success: true });
});

// Cron job for notifications (every hour)
cron.schedule("0 * * * *", async () => {
  console.log("Running notification check...");
  
  const db = admin.firestore();
  const now = new Date();
  
  // Example: Check for pending justifications
  const justificationsSnapshot = await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("justifications")
    .where("status", "==", "PENDING")
    .get();

  for (const doc of justificationsSnapshot.docs) {
    const data = doc.data();
    const userId = data.memberId;
    
    // Check if user has an FCM token
    const userDoc = await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("users").doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    
    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "Justificativa Pendente",
          body: "Você tem uma justificativa pendente. Por favor, verifique."
        },
        data: {
          url: "/justifications"
        }
      });
    }
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
