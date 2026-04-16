import express, { Router } from "express";
import serverless from "serverless-http";
import axios from "axios";

const app = express();
const router = Router();

app.use(express.json());

// API: Checkout (Manual / Placeholder)
router.post("/checkout", async (req, res) => {
  // Conforme solicitado: o processamento é feito diretamente no frontend (Firestore)
  // Esta rota existe apenas para evitar erros se houver chamadas residuais.
  res.json({ 
    success: true, 
    message: "A aguardar pagamento manual via contacto administrativo." 
  });
});

// API: Check Admin
router.post("/admin/check", (req, res) => {
  const { email } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";
  res.json({ isAdmin: email === adminEmail });
});

app.use("/.netlify/functions/api", router);

export const handler = serverless(app);
