import express, { Router } from "express";
import serverless from "serverless-http";
import axios from "axios";

const app = express();
const router = Router();

app.use(express.json());

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

// API: Check Admin
router.post("/admin/check", (req, res) => {
  const { email } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "jose.festas@gmail.com";
  res.json({ isAdmin: email === adminEmail });
});

app.use("/.netlify/functions/api", router);

export const handler = serverless(app);
