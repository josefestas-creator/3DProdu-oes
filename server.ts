import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
