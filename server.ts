import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Checkout (MB Way)
  app.post("/api/checkout", async (req, res) => {
    const { cart, shippingMethod, shippingAddress, mbWayPhone, total, userEmail } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

    console.log(`[Checkout] Iniciando para ${userEmail || 'Convidado'} - Total: €${total}`);
    console.log(`[Checkout] Configurações: SMTP=${!!process.env.SMTP_HOST}, MBWAY=${!!process.env.IFTHENPAY_MBWAY_KEY}`);

    let paymentStatus = "simulated";
    let errors = [];

    try {
      // 2. Processar Pagamento MB Way (Ifthenpay)
      const mbWayKey = process.env.IFTHENPAY_MBWAY_KEY;
      if (mbWayKey) {
        try {
          const orderId = `ORD-${Date.now()}`;
          const amount = total.toString().replace(',', '.');
          const mobile = mbWayPhone.replace(/\s/g, '');
          
          console.log(`[Checkout] Chamando Ifthenpay: Key=${mbWayKey.substring(0, 4)}***, Order=${orderId}, Amount=${amount}, Mobile=${mobile}`);

          // Ifthenpay MB Way API costuma ser um GET
          const response = await axios.get("https://www.ifthenpay.com/api/mbway/payment", {
            params: {
              mbwaykey: mbWayKey,
              orderId: orderId,
              amount: amount,
              mobileNumber: mobile,
              description: `Encomenda 3D Produções ${orderId}`
            }
          });

          console.log("[Checkout] Resposta Ifthenpay:", JSON.stringify(response.data));

          if (response.data && (response.data.Status === "000" || response.data.status === "000")) {
            console.log("[Checkout] Pedido MB Way enviado com sucesso para Ifthenpay.");
            paymentStatus = "success";
          } else {
            const errorMsg = response.data.Message || response.data.message || "Erro desconhecido";
            console.error("[Checkout] Erro na resposta da Ifthenpay:", errorMsg);
            paymentStatus = "error";
            errors.push(`Erro MB Way: ${errorMsg}`);
          }
        } catch (payError: any) {
          console.error("[Checkout] Erro ao chamar API Ifthenpay:", payError.message);
          if (payError.response) {
            console.error("[Checkout] Detalhes do erro:", JSON.stringify(payError.response.data));
          }
          paymentStatus = "error";
          errors.push(`Erro de ligação MB Way: ${payError.message}`);
        }
      } else {
        console.warn("[Checkout] Chave MB Way não configurada.");
        errors.push("Chave MB Way em falta nas definições.");
      }

      // Se houver erros críticos no pagamento real, retornamos erro
      if (mbWayKey && paymentStatus === "error") {
        return res.status(400).json({ 
          success: false, 
          message: "Não foi possível processar o pagamento MB Way.",
          details: errors
        });
      }

      res.json({ 
        success: true, 
        message: "Encomenda processada!",
        paymentStatus,
        warnings: errors.length > 0 ? errors : null
      });

    } catch (error: any) {
      console.error("[Checkout] Erro fatal:", error.message);
      res.status(500).json({ success: false, message: "Erro interno ao processar a encomenda." });
    }
  });

  // API: Verificar se o utilizador é administrador
  app.post("/api/admin/check", (req, res) => {
    const { email } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";
    
    if (email === adminEmail) {
      return res.json({ isAdmin: true });
    }
    res.json({ isAdmin: false });
  });

  // API: Obter produtos (pode ser expandido para base de dados real)
  app.get("/api/products", (req, res) => {
    // Aqui poderíamos ler de um ficheiro ou base de dados
    res.json({ status: "ok" });
  });

  // Vite middleware para desenvolvimento
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
}

startServer();
