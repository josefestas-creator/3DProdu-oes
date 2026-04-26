import "dotenv/config";
import dotenv from "dotenv";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";
import cors from "cors";

// Forçar carregamento do .env local se existir
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auxiliar: Enviar Email de Encomenda
async function sendOrderEmail(orderData: any) {
  const { cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress } = orderData;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

  console.log("[Email] Iniciando envio. Configurações detetadas:");
  console.log(`[Email] HOST: ${process.env.SMTP_HOST}, PORT: ${process.env.SMTP_PORT}, USER: ${process.env.SMTP_USER}`);

  // Verificar se há configurações SMTP
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] Configurações SMTP ausentes. Ignorando envio de email.");
    return { success: false, error: "Configurações SMTP ausentes no servidor (.env não carregado ou variáveis em falta)" };
  }

  const smtpPass = (process.env.SMTP_PASS || "").replace(/\s/g, "");
  
  // Opções para o transporter
  const transportConfig: any = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  // Atalho para Gmail melhora fiabilidade
  if (process.env.SMTP_HOST?.includes('gmail.com')) {
    delete transportConfig.host;
    delete transportConfig.port;
    delete transportConfig.secure;
    transportConfig.service = 'gmail';
  }

  const transporter = nodemailer.createTransport(transportConfig);

  console.log(`[Email] A preparar envio para ${adminEmail} via ${transportConfig.service || process.env.SMTP_HOST}...`);
  console.log(`[Email] Pass-Check: Len=${smtpPass.length}, Last4=${smtpPass.slice(-4)}`);

  const cartHtml = cart.map((item: any) => `
    <li>
      <strong>${item.name}</strong> - ${item.quantity}x €${item.price.toFixed(2)}
    </li>
  `).join('');

  const addressHtml = shippingMethod === 'mail' && shippingAddress ? `
    <p><strong>Morada de Envio:</strong><br>
    ${shippingAddress.street || shippingAddress.address}<br>
    ${shippingAddress.postalCode} ${shippingAddress.city}</p>
  ` : '<p><strong>Levantamento:</strong> Em mãos</p>';

  const mailOptions = {
    from: process.env.SMTP_USER, // Usar apenas o email para evitar filtros
    to: adminEmail,
    subject: `Encomenda: €${total.toFixed(2)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #333;">Nova Encomenda!</h2>
        <p>Recebeu um novo pedido na 3D Produções (Site).</p>
        
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
        
        <p style="font-size: 0.8em; color: #777;">Mensagem automática do sistema.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[Email] Sucesso TOTAL:", info.messageId, info.response);
    return { success: true, info: info.response };
  } catch (error: any) {
    console.error("[Email] ERRO NO ENVIO:", error.message);
    return { success: false, error: error.message };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors()); // Permitir CORS para mobile
  app.use(express.json());

  // API: Checkout (MB Way)
  app.post("/api/checkout", async (req, res) => {
    const { cart, shippingMethod, shippingAddress, mbWayPhone, total, userEmail } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

    console.log(`[Checkout] Iniciando para ${userEmail || 'Convidado'} de ${req.ip} - Total: €${total}`);
    
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
          
          const response = await axios.get("https://www.ifthenpay.com/api/mbway/payment", {
            params: {
              mbwaykey: mbWayKey,
              orderId: orderId,
              amount: amount,
              mobileNumber: mobile,
              description: `Encomenda 3D Produções ${orderId}`
            }
          });

          if (response.data && (response.data.Status === "000" || response.data.status === "000")) {
            paymentStatus = "success";
          } else {
            const errorMsg = response.data.Message || response.data.message || "Erro desconhecido";
            paymentStatus = "error";
            errors.push(`Erro MB Way: ${errorMsg}`);
          }
        } catch (payError: any) {
          paymentStatus = "error";
          errors.push(`Erro de ligação MB Way: ${payError.message}`);
        }
      }

      // 3. Enviar Notificação por Email
      const emailResult = await sendOrderEmail({ cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress });

      res.json({ 
        success: true, 
        paymentStatus,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
        warnings: errors.length > 0 ? errors : null
      });

    } catch (error: any) {
      console.error("[Checkout] Erro fatal:", error.message);
      res.status(500).json({ success: false, message: "Erro interno: " + error.message });
    }
  });

  // API: Notificação de Encomenda
  app.post("/api/notify-order", async (req, res) => {
    console.log("[Server] Recebido pedido em /api/notify-order de:", req.ip);
    try {
      const emailResult = await sendOrderEmail(req.body);
      console.log("[Server] Resultado do envio:", emailResult.success ? "SUCESSO" : "FALHA", emailResult.error || "");
      res.json(emailResult);
    } catch (error: any) {
      console.error("[Server] Erro na rota notify-order:", error.message);
      res.status(500).json({ success: false, error: "Erro interno: " + error.message });
    }
  });

  // API: Verificar se o utilizador é administrador
  app.post("/api/admin/check", (req, res) => {
    const { email } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";
    res.json({ isAdmin: email === adminEmail });
  });

  // Vite ou Produção
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
    console.log(`[Server] Online em http://0.0.0.0:${PORT}`);
    console.log(`[Server] Admin: ${process.env.ADMIN_EMAIL}`);
  });
}

startServer();
