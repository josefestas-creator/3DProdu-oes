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

let customSmtpPass: string | null = null;

function getSmtpPass() {
  if (customSmtpPass) return customSmtpPass;
  if (process.env.SMTP_PASS) return process.env.SMTP_PASS.replace(/\s/g, "");
  return DEFAULT_PASS;
}

// Auxiliar: Enviar Email de Encomenda
async function sendOrderEmail(orderData: any) {
  const { cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress } = orderData;
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN;

  console.log("=================================================");
  console.log(`[Email] NOTIFICAÇÃO DE ENCOMENDA RECEBIDA PARA: ${adminEmail}`);
  console.log(`[Email] Cliente: ${userEmail || 'Convidado'} | MB Way: ${mbWayPhone}`);
  console.log(`[Email] Total: €${Number(total || 0).toFixed(2)} | Envio: ${shippingMethod}`);
  console.log("=================================================");

  const smtpPass = getSmtpPass();
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpUser = process.env.SMTP_USER || DEFAULT_ADMIN;
  const smtpFrom = process.env.SMTP_FROM || DEFAULT_ADMIN;

  // Lista de destinatários: Administrador + Cliente (se fornecido)
  const recipients = [adminEmail];
  if (userEmail && typeof userEmail === 'string' && userEmail.includes('@') && userEmail.toLowerCase() !== 'convidado' && userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    recipients.push(userEmail.trim());
  }

  console.log(`[Email] Destinatários: ${recipients.join(', ')} | Servidor: ${smtpHost}:${smtpPort} (User: ${smtpUser})`);

  let transporter;
  if (smtpHost.includes('gmail.com')) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      }
    });
  } else {
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

  const itemsList = Array.isArray(cart) ? cart : [];
  const cartHtml = itemsList.map((item: any) => `
    <li>
      <strong>${item.name || 'Item'}</strong> - ${item.quantity || 1}x €${Number(item.price || 0).toFixed(2)}
    </li>
  `).join('');

  const addressHtml = shippingMethod === 'mail' && shippingAddress ? `
    <p><strong>Morada de Envio:</strong><br>
    ${shippingAddress.street || shippingAddress.address || ''}<br>
    ${shippingAddress.postalCode || ''} ${shippingAddress.city || ''}</p>
  ` : '<p><strong>Levantamento:</strong> Em mãos</p>';

  const mailOptions = {
    from: `"3D Produções" <${smtpFrom}>`,
    to: recipients.join(', '),
    replyTo: (userEmail && userEmail.includes('@') && userEmail !== 'Convidado') ? userEmail : adminEmail,
    subject: `[Nova Encomenda 3D] Total: €${Number(total || 0).toFixed(2)} (${userEmail || mbWayPhone})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 24px; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #0047C9; margin-top: 0;">Nova Encomenda Registada!</h2>
        <p style="color: #555;">Resumo do pedido realizado na loja online <strong>3D Produções</strong>.</p>
        
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        
        <h3 style="color: #333;">Dados da Encomenda:</h3>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail || 'Convidado'}</p>
        <p style="margin: 4px 0;"><strong>Telemóvel MB Way:</strong> ${mbWayPhone}</p>
        
        <h3 style="color: #333; margin-top: 20px;">Itens encomendados:</h3>
        <ul style="padding-left: 20px; line-height: 1.6;">${cartHtml}</ul>
        
        <div style="background-color: #f5f8ff; padding: 12px 16px; border-radius: 8px; font-size: 1.2em; color: #0047C9; margin: 16px 0;">
          <strong>Total: €${Number(total || 0).toFixed(2)}</strong>
        </div>
        
        <h3 style="color: #333;">Método de Envio:</h3>
        ${addressHtml}
        
        <div style="background-color: #fff9e6; border: 1px solid #ffe58f; padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 0.9em; color: #8a6d3b;">
          <strong>Pagamento via MB Way:</strong> Por favor, envie o valor de <strong>€${Number(total || 0).toFixed(2)}</strong> para o número de telemóvel associado à loja.
        </div>

        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        
        <p style="font-size: 0.8em; color: #888; text-align: center;">Notificação automática gerada pela aplicação 3D Produções.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[Email] SUCESSO NO ENVIO DO EMAIL:", info.messageId, info.response);
    return { success: true, info: info.response, recipients };
  } catch (error: any) {
    console.error("[Email] AVISO / ERRO NO ENVIO SMTP:", error.message);
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

  const handleTestEmail = async (req: express.Request, res: express.Response) => {
    const { pass } = req.body;
    if (pass && typeof pass === 'string' && pass.trim()) {
      customSmtpPass = pass.trim().replace(/\s/g, "");
      console.log("[Server] Atualizada palavra-passe de aplicação para envio em memória.");
    }
    try {
      const emailResult = await sendOrderEmail({
        cart: [{ name: "Impressão 3D - Teste de Notificação", quantity: 1, price: 15.00 }],
        total: 15.00,
        userEmail: DEFAULT_ADMIN,
        mbWayPhone: "910000000",
        shippingMethod: "mail",
        shippingAddress: { street: "Rua do Teste, 123", postalCode: "4000-000", city: "Porto" }
      });
      res.json(emailResult);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // Mapear ALL rotas possíveis para evitar 404 (com ou sem slash, com ou sem netlify prefix)
  app.post(["/api/checkout", "/api/checkout/", "/.netlify/functions/api/checkout", "/.netlify/functions/api/checkout/"], handleCheckout);
  app.post(["/api/notify-order", "/api/notify-order/", "/.netlify/functions/api/notify-order", "/.netlify/functions/api/notify-order/"], handleNotifyOrder);
  app.post(["/api/admin/check", "/api/admin/check/", "/.netlify/functions/api/admin/check", "/.netlify/functions/api/admin/check/"], handleAdminCheck);
  app.post(["/api/test-email", "/api/test-email/"], handleTestEmail);

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
