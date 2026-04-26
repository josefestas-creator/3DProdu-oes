import express, { Router } from "express";
import serverless from "serverless-http";
import axios from "axios";
import nodemailer from "nodemailer";

const app = express();
const router = Router();

app.use(express.json());

// Auxiliar: Enviar Email de Encomenda
async function sendOrderEmail(orderData: any) {
  const { cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress } = orderData;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] Configurações SMTP ausentes.");
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

  console.log(`[Email] A tentar enviar via ${process.env.SMTP_HOST}...`);

  const cartHtml = cart.map((item: any) => `
    <li><strong>${item.name}</strong> - ${item.quantity}x €${item.price.toFixed(2)}</li>
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
        <h2>Nova Encomenda Recebida!</h2>
        <p><strong>Email:</strong> ${userEmail || 'Convidado'}</p>
        <p><strong>Telemóvel MB Way:</strong> ${mbWayPhone}</p>
        <h3>Items:</h3>
        <ul>${cartHtml}</ul>
        <p><strong>Total: €${total.toFixed(2)}</strong></p>
        <h3>Envio:</h3>
        ${addressHtml}
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("[Email] Erro ao enviar email:", error);
    return false;
  }
}

// API: Checkout (MB Way)
router.post("/checkout", async (req, res) => {
  const { cart, shippingMethod, shippingAddress, mbWayPhone, total, userEmail } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";

  console.log(`[Netlify Function] Checkout para ${userEmail || 'Convidado'} - Total: €${total}`);

  let paymentStatus = "simulated";
  let errors: string[] = [];

  try {
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
          paymentStatus = "error";
          errors.push(response.data.Message || response.data.message || "Erro MB Way");
        }
      } catch (payError: any) {
        paymentStatus = "error";
        errors.push(`Erro de ligação MB Way: ${payError.message}`);
      }
    } else {
      errors.push("Chave MB Way em falta nas definições.");
    }

    if (mbWayKey && paymentStatus === "error") {
      return res.status(400).json({ 
        success: false, 
        message: "Não foi possível processar o pagamento MB Way.",
        details: errors
      });
    }

    // Notificação por Email
    await sendOrderEmail({ cart, total, userEmail, mbWayPhone, shippingMethod, shippingAddress });

    res.json({ 
      success: true, 
      message: "Encomenda processada!",
      paymentStatus,
      warnings: errors.length > 0 ? errors : null
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: "Erro interno." });
  }
});

// API: Notificação
router.post("/notify-order", async (req, res) => {
  const success = await sendOrderEmail(req.body);
  res.json({ success });
});

// API: Check Admin
router.post("/admin/check", (req, res) => {
  const { email } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";
  res.json({ isAdmin: email === adminEmail });
});

app.use("/.netlify/functions/api", router);

export const handler = serverless(app);
