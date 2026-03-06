import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { eq, and, isNotNull } from "drizzle-orm";

import { checkSteadfastStatus } from "./steadfast";
import { db } from "./db";
import { sales, expenses, steadfastConfig } from "@shared/schema";
import { storage } from "./storage";
const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

(async () => {
  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch(console.error);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      setInterval(async () => {
        try {
          const configs = await db.select().from(steadfastConfig);
          if (configs.length === 0) return;

          for (const config of configs) {
            const orders = await db.select().from(sales).where(
              and(
                eq(sales.userId, config.userId),
                eq(sales.isSentToCourier, true),
                isNotNull(sales.consignmentId)
              )
            );

            const TERMINAL_STATUSES = ["delivered", "cancelled", "returned", "cancelled_delivery"];
            for (const order of orders) {
              if (!order.consignmentId) continue;
              if (TERMINAL_STATUSES.includes(order.courierStatus || "")) continue;

              try {
                const data = await checkSteadfastStatus(config, order.consignmentId);
                if (!data?.delivery_status) continue;
                const newStatus = data.delivery_status;
                const oldStatus = order.courierStatus;

                await db
                  .update(sales)
                  .set({ courierStatus: newStatus })
                  .where(eq(sales.id, order.id));

                if (newStatus === "delivered" && oldStatus !== "delivered") {
                  await storage.updateSalePayment(order.id, config.userId, order.totalPrice, 0);
                }

                const RETURNED = ["returned", "cancelled", "cancelled_delivery"];
                if (RETURNED.includes(newStatus) && !RETURNED.includes(oldStatus || "")) {
                  await storage.updateSalePayment(order.id, config.userId, 0, 0);

                  const deliveryChargeAmount = order.deliveryCharge ?? 0;
                  if (deliveryChargeAmount > 0) {
                    const returnExpense = await storage.createExpense(config.userId, {
                      description: `Return delivery charge - Order #${order.id} (${order.customerName || "Unknown"})`,
                      amount: deliveryChargeAmount,
                      category: "Delivery",
                    });

                    await storage.createTransaction(config.userId, {
                      category: "Return Charge",
                      source: `Expense #${returnExpense.id}`,
                      description: `Return delivery charge - Order #${order.id} (${order.customerName || "Unknown"})`,
                      debit: deliveryChargeAmount,
                      credit: 0,
                      profit: 0,
                    });
                  }
                }
              } catch (err) {
                console.log("Status check failed for order", order.id);
              }
            }
          }
        } catch (err) {
          console.log("Auto status sync error:", err);
        }
      }, 30 * 60 * 1000);
    },
  );
})();
