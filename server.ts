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

// Configurações Mestre (Hardcoded Fallbacks)
const DEFAULT_ADMIN = "jose.festas@gmail.com";
const DEFAULT_PASS = "vbpuyyisbypaienv"; // Senha de aplicação sem espaços

// Auxiliar: Enviar Email de Encomenda
async function sendOrderEmail(orderData: any) {
  const { cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress } = orderData;
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN;

  console.log("[Email] Iniciando envio. Configurações detetadas:");
  
  const smtpPass = (process.env.SMTP_PASS || DEFAULT_PASS).replace(/\s/g, "");
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpUser = process.env.SMTP_USER || DEFAULT_ADMIN;
  const smtpFrom = process.env.SMTP_FROM || DEFAULT_ADMIN;

  console.log(`[Email] Tentativa de envio: ${smtpHost}:${smtpPort} (User: ${smtpUser})`);

  let transporter;
  if (smtpHost.includes('gmail.com')) {
    console.log("[Email] Configurando transporter específico para Gmail...");
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      }
    });
  } else {
    console.log(`[Email] Configurando transporter SMTP genérico (${smtpHost}:${smtpPort})...`);
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  console.log(`[Email] A preparar envio para ${adminEmail} via ${smtpHost}...`);
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
    from: smtpFrom, // Usar o email configurado
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
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Middleware de Log para diagnosticar rotas e pedidos
  app.use((req, res, next) => {
    console.log(`[Server ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Handlers Modulares
  const handleCheckout = async (req: express.Request, res: express.Response) => {
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
  };

  const handleNotifyOrder = async (req: express.Request, res: express.Response) => {
    console.log("[Server] Recebido pedido na rota notify-order de:", req.ip);
    try {
      const emailResult = await sendOrderEmail(req.body);
      console.log("[Server] Resultado do envio de email:", emailResult.success ? "SUCESSO" : "FALHA", emailResult.error || "");
      res.json(emailResult);
    } catch (error: any) {
      console.error("[Server] Erro na rota notify-order:", error.message);
      res.status(500).json({ success: false, error: "Erro interno: " + error.message });
    }
  };

  const handleAdminCheck = (req: express.Request, res: express.Response) => {
    const { email } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN;
    res.json({ isAdmin: (email || '').toLowerCase() === adminEmail.toLowerCase() });
  };

  // Mapear ALL rotas possíveis para evitar 404 (com ou sem slash, com ou sem netlify prefix)
  app.post(["/api/checkout", "/api/checkout/", "/.netlify/functions/api/checkout", "/.netlify/functions/api/checkout/"], handleCheckout);
  app.post(["/api/notify-order", "/api/notify-order/", "/.netlify/functions/api/notify-order", "/.netlify/functions/api/notify-order/"], handleNotifyOrder);
  app.post(["/api/admin/check", "/api/admin/check/", "/.netlify/functions/api/admin/check", "/.netlify/functions/api/admin/check/"], handleAdminCheck);

  // Fallbacks adicionais de GET para teste rápido no browser se necessário
  app.get(["/api/health", "/api/health/"], (req, res) => res.json({ status: "online", time: new Date().toISOString() }));

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
