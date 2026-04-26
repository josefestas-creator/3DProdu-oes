import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auxiliar: Enviar Email de Encomenda
async function sendOrderEmail(orderData: any) {
  const { cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress } = orderData;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

  // Verificar se há configurações SMTP
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] Configurações SMTP ausentes. Ignorando envio de email.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  console.log(`[Email] A tentar enviar para ${adminEmail} via ${process.env.SMTP_HOST}...`);

  const cartHtml = cart.map((item: any) => `
    <li>
      <strong>${item.name}</strong> - ${item.quantity}x €${item.price.toFixed(2)}
    </li>
  `).join('');

  const addressHtml = shippingMethod === 'mail' ? `
    <p><strong>Morada de Envio:</strong><br>
    ${shippingAddress.street}<br>
    ${shippingAddress.postalCode} ${shippingAddress.city}</p>
  ` : '<p><strong>Levantamento:</strong> Em mãos</p>';

  const mailOptions = {
    from: process.env.SMTP_FROM || `"3D Produções" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `Nova Encomenda - €${total.toFixed(2)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #333;">Nova Encomenda Recebida!</h2>
        <p>Recebeu um novo pedido na 3D Produções.</p>
        
        <hr style="border: 0; border-top: 1px solid #eee;">
        
        <h3>Detalhes do Cliente:</h3>
        <p><strong>Email:</strong> ${userEmail || 'Convidado'}</p>
        <p><strong>Telemóvel MB Way:</strong> ${mbWayPhone}</p>
        
        <h3>Items:</h3>
        <ul>${cartHtml}</ul>
        
        <p style="font-size: 1.2em;"><strong>Total: €${total.toFixed(2)}</strong></p>
        
        <h3>Envio:</h3>
        ${addressHtml}
        
        <hr style="border: 0; border-top: 1px solid #eee;">
        
        <p style="font-size: 0.8em; color: #777;">Esta é uma mensagem automática do seu sistema de encomendas.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("[Email] Email de notificação enviado para", adminEmail);
    return true;
  } catch (error) {
    console.error("[Email] Erro ao enviar email:", error);
    return false;
  }
}

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

      // 3. Enviar Notificação por Email
      await sendOrderEmail({ cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress });

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

  // API: Notificação de Encomenda (para quando se usa Firestore direto no frontend)
  app.post("/api/notify-order", async (req, res) => {
    try {
      const success = await sendOrderEmail(req.body);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ success: false });
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
