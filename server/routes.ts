import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sales, expenses, products, insertProductSchema, insertExpenseSchema, insertSupplierSchema, insertPurchaseSchema, insertCustomerSchema, insertInvestorSchema, type SaleWithItems } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createSteadfastOrder, checkSteadfastStatus } from "./steadfast";
import { authMiddleware, generateToken, type AuthUser } from "./auth";
import bcrypt from "bcryptjs";

const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
});

const saleRequestSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one product is required"),
  customerId: z.coerce.number().int().positive().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  saveToCustomerList: z.boolean().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  addCodFee: z.boolean().optional(),
});

const updateProductSchema = insertProductSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ name, email, password: hashedPassword, googleId: null });

      const token = generateToken({ id: user.id, email: user.email, name: user.name });
      res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation failed" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email("Invalid email"),
        password: z.string().min(1, "Password is required"),
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken({ id: user.id, email: user.email, name: user.name });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation failed" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential, clientId } = req.body;
      if (!credential || !clientId) {
        return res.status(400).json({ message: "Missing credential or clientId" });
      }

      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        return res.status(400).json({ message: "Invalid Google token" });
      }

      let user = await storage.getUserByGoogleId(payload.sub);
      if (!user) {
        user = await storage.createUser({
          name: payload.name || payload.email,
          email: payload.email,
          password: null,
          googleId: payload.sub,
        });
      }

      const token = generateToken({ id: user.id, email: user.email, name: user.name });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      console.error("Google auth error:", error.message);
      res.status(401).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    authMiddleware(req, res, next);
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user!.id);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/code/:code", async (req, res) => {
    try {
      const product = await storage.getProductByCode(req.params.code, req.user!.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const parsed = insertProductSchema.parse(req.body);
      if (!parsed.productCode || parsed.productCode.trim() === "") {
        return res.status(400).json({ message: "Product code is required" });
      }
      const product = await storage.createProduct(req.user!.id, parsed);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateProductSchema.parse(req.body);
      const product = await storage.updateProduct(id, req.user!.id, parsed);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/products/:id/adjust-stock", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { adjustmentType, quantity, reason } = req.body;
      if (!adjustmentType || !["add", "reduce", "set"].includes(adjustmentType)) {
        return res.status(400).json({ message: "Invalid adjustment type" });
      }
      if (typeof quantity !== "number" || quantity < 0) {
        return res.status(400).json({ message: "Quantity must be a non-negative number" });
      }
      const record = await storage.adjustStock(productId, req.user!.id, adjustmentType, quantity, reason);
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/products/:id/stock-history", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId, req.user!.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const history = await storage.getStockHistory(productId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Product not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const salesList = await storage.getSales(req.user!.id);
      res.json(salesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const userId = req.user!.id;
      const { items, customerId, customerName: newCustomerName, customerPhone, customerAddress, saveToCustomerList, paidAmount, addCodFee } = saleRequestSchema.parse(req.body);

      const resolvedItems: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        totalPrice: number;
        weightPerUnit: number;
      }> = [];

      for (const item of items) {
        const product = await storage.getProduct(item.productId, userId);
        if (!product) return res.status(404).json({ message: `Product not found (ID: ${item.productId})` });
        if (product.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
        const saleUnitPrice = item.unitPrice !== undefined ? item.unitPrice : product.salePrice;
        resolvedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: saleUnitPrice,
          costPrice: product.costPrice,
          totalPrice: saleUnitPrice * item.quantity,
          weightPerUnit: product.weightPerUnit ?? 0,
        });
      }

      const subtotal = resolvedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      const totalWeight = resolvedItems.reduce((sum, i) => sum + i.quantity * i.weightPerUnit, 0);
      const codFee = addCodFee ? Math.round(subtotal * 0.01 * 100) / 100 : 0;

      let deliveryCharge = 0;
      if (totalWeight > 0) {
        if (totalWeight <= 0.5) deliveryCharge = 110;
        else if (totalWeight <= 1) deliveryCharge = 130;
        else deliveryCharge = 130 + Math.ceil(totalWeight - 1) * 20;
      }
      let packingCharge = 0;
      if (totalWeight > 0) {
        packingCharge = totalWeight > 5 ? 15 : 10;
      }

      const totalAmount = subtotal + codFee + deliveryCharge + packingCharge;
      const paid = paidAmount !== undefined ? paidAmount : totalAmount;
      const due = totalAmount - paid;

      let resolvedCustomerId: number | null = customerId || null;
      let resolvedCustomerName: string | null = null;
      let resolvedCustomerPhone: string | null = customerPhone || null;
      let resolvedCustomerAddress: string | null = customerAddress || null;

      if (customerId) {
        const customer = await storage.getCustomer(customerId, userId);
        if (!customer) return res.status(404).json({ message: "Customer not found" });
        resolvedCustomerName = customer.name;
        resolvedCustomerPhone = customer.phone || resolvedCustomerPhone;
        resolvedCustomerAddress = customer.address || resolvedCustomerAddress;
      } else if (newCustomerName && newCustomerName.trim()) {
        resolvedCustomerName = newCustomerName.trim();
        if (saveToCustomerList) {
          const newCustomer = await storage.createCustomer(userId, {
            name: resolvedCustomerName,
            phone: resolvedCustomerPhone,
            address: resolvedCustomerAddress,
            dueAmount: 0,
          });
          resolvedCustomerId = newCustomer.id;
        }
      }

      if (due > 0 && !resolvedCustomerId) {
        return res.status(400).json({ message: "Customer must be saved to Customer List when there is a due amount" });
      }

      const sale = await storage.createSale({
        userId,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerAddress: resolvedCustomerAddress,
        paidAmount: paid,
        dueAmount: due,
        totalAmount,
        totalWeight,
        codFee,
        deliveryCharge: deliveryCharge + packingCharge,
        items: resolvedItems,
      });

      res.status(201).json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sales/:id/payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paidAmount, dueAmount } = z.object({
        paidAmount: z.coerce.number().min(0),
        dueAmount: z.coerce.number().min(0),
      }).parse(req.body);
      const updated = await storage.updateSalePayment(id, req.user!.id, paidAmount, dueAmount);
      if (!updated) return res.status(404).json({ message: "Sale not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSale(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Sale not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/expenses", async (req, res) => {
    try {
      const expensesList = await storage.getExpenses(req.user!.id);
      res.json(expensesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(req.user!.id, parsed);
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExpense(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Expense not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliersList = await storage.getSuppliers(req.user!.id);
      res.json(suppliersList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const parsed = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(req.user!.id, parsed);
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSupplier(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Supplier not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/purchases", async (req, res) => {
    try {
      const purchasesList = await storage.getPurchases(req.user!.id);
      res.json(purchasesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    try {
      const userId = req.user!.id;
      const { productId, supplierId, quantity } = req.body;
      const product = await storage.getProduct(productId, userId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      let supplierName: string | null = null;
      if (supplierId) {
        const suppliersList = await storage.getSuppliers(userId);
        const supplier = suppliersList.find(s => s.id === supplierId);
        supplierName = supplier?.name ?? null;
      }

      const purchase = await storage.createPurchase(userId, {
        productId,
        productName: product.name,
        supplierId: supplierId || null,
        supplierName,
        quantity,
        unitCost: product.costPrice,
        totalCost: product.costPrice * quantity,
      });
      res.status(201).json(purchase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePurchase(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Purchase not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const customersList = await storage.getCustomers(req.user!.id);
      res.json(customersList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id, userId);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const customerSales = await storage.getSalesByCustomer(id, userId);
      const customerPayments = await storage.getPaymentsByCustomer(id, userId);

      const totalSales = customerSales.reduce((sum, s) => sum + s.totalPrice, 0);
      const totalPaid = customerSales.reduce((sum, s) => sum + s.paidAmount, 0) +
        customerPayments.reduce((sum, p) => sum + p.amount, 0);

      res.json({
        customer,
        sales: customerSales,
        payments: customerPayments,
        totalSales,
        totalPaid,
        currentDue: customer.dueAmount,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const parsed = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(req.user!.id, parsed);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCustomer(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Customer not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments", async (req, res) => {
    try {
      const paymentsList = await storage.getPayments(req.user!.id);
      res.json(paymentsList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const { customerId, amount } = z.object({
        customerId: z.coerce.number().int().positive(),
        amount: z.coerce.number().positive(),
      }).parse(req.body);

      const payment = await storage.createPayment(req.user!.id, customerId, amount);
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePayment(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Payment not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/investors", async (req, res) => {
    try {
      const investorsList = await storage.getInvestors(req.user!.id);
      res.json(investorsList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/investors", async (req, res) => {
    try {
      const parsed = insertInvestorSchema.parse(req.body);
      const investor = await storage.createInvestor(req.user!.id, parsed);
      res.status(201).json(investor);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/investors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteInvestor(id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Investor not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/steadfast-config", async (req, res) => {
    try {
      const config = await storage.getSteadfastConfig(req.user!.id);
      if (config) {
        res.json({ apiKey: config.apiKey, secretKey: config.secretKey, baseUrl: config.baseUrl });
      } else {
        res.json({ apiKey: "", secretKey: "", baseUrl: "https://portal.packzy.com/api/v1" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/steadfast-config", async (req, res) => {
    try {
      const { apiKey, secretKey, baseUrl } = req.body;
      if (!apiKey || !secretKey || !baseUrl) {
        return res.status(400).json({ message: "API Key, Secret Key, and Base URL are required" });
      }
      const config = await storage.saveSteadfastConfig(req.user!.id, apiKey, secretKey, baseUrl);
      res.json({ apiKey: config.apiKey, secretKey: config.secretKey, baseUrl: config.baseUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/courier-sales", async (req, res) => {
    try {
      const courierSales = await storage.getCourierSales(req.user!.id);
      res.json(courierSales);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/steadfast/send/:id", async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getSteadfastConfig(userId);
      if (!config) return res.status(400).json({ message: "Steadfast API not configured. Please add your API credentials in Settings." });

      const id = parseInt(req.params.id);
      const allSales = await storage.getSales(userId);
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (sale.isSentToCourier) return res.status(400).json({ message: "Already sent to courier" });
      if (!sale.customerName || !sale.customerPhone || !sale.customerAddress) {
        return res.status(400).json({ message: "Customer name, phone and address are required for courier" });
      }

      const codAmount = req.body?.amount !== undefined ? Number(req.body.amount) : sale.dueAmount;
      const saleWithAmount = { ...sale, totalPrice: codAmount };
      const result = await createSteadfastOrder(config, saleWithAmount);
      const updated = await storage.updateSaleCourier(id, userId, result.consignment_id, "pending");

      const allExpenses = await storage.getExpenses(userId);
      const courierExpenseExists = allExpenses.some(
        (e) => e.category === "Delivery" && e.description.includes(`Order #${id}`)
      );
      if (!courierExpenseExists) {
        await storage.createExpense(userId, {
          description: `Courier charge - Order #${id} (${sale.customerName || "Unknown"})`,
          amount: 110,
          category: "Delivery",
        });
      }

      res.json(updated);
    } catch (error: any) {
      console.log("Steadfast send error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/steadfast/order/:id", async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const allSales = await storage.getSales(userId);
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (!sale.isSentToCourier) return res.status(400).json({ message: "This sale is not a courier order" });
      if (sale.courierStatus === "delivered") {
        return res.status(400).json({ message: "Delivered orders cannot be disconnected" });
      }

      await db.update(sales).set({
        consignmentId: null,
        courierStatus: null,
        isSentToCourier: false,
      }).where(eq(sales.id, id));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function applyCourierStatusFinancials(
    saleId: number,
    userId: number,
    sale: SaleWithItems,
    oldStatus: string | null,
    newStatus: string
  ) {
    const CANCELLED_STATUSES = ["returned", "cancelled", "cancelled_delivery"];

    if (oldStatus === newStatus) return;

    const isCancelled = CANCELLED_STATUSES.includes(newStatus);
    const wasCancelled = CANCELLED_STATUSES.includes(oldStatus || "");

    const isDelivered = newStatus === "delivered";
    const wasDelivered = oldStatus === "delivered";

    if (isDelivered && !wasDelivered) {
      await storage.updateSalePayment(saleId, userId, sale.totalPrice, 0);
    }

    if (isCancelled && !wasCancelled) {
      await storage.updateSalePayment(saleId, userId, 0, 0);
      for (const item of sale.items) {
        await db.update(products).set({
          stock: sql`stock + ${item.quantity}`,
        }).where(eq(products.id, item.productId));
      }
    }

    if (wasCancelled && !isCancelled) {
      for (const item of sale.items) {
        await db.update(products).set({
          stock: sql`GREATEST(0, stock - ${item.quantity})`,
        }).where(eq(products.id, item.productId));
      }
    }

    if (wasDelivered && !isDelivered && !isCancelled) {
      await storage.updateSalePayment(saleId, userId, 0, sale.totalPrice);
    }
  }

  app.post("/api/steadfast/status/:id", async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getSteadfastConfig(userId);
      if (!config) return res.status(400).json({ message: "Steadfast API not configured." });

      const id = parseInt(req.params.id);
      const allSales = await storage.getSales(userId);
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (!sale.consignmentId) return res.status(400).json({ message: "No consignment ID found" });

      const result = await checkSteadfastStatus(config, sale.consignmentId);
      const newStatus = result.delivery_status;
      const oldStatus = sale.courierStatus;
      await storage.updateSaleCourier(id, userId, sale.consignmentId, newStatus);

      await applyCourierStatusFinancials(id, userId, sale, oldStatus, newStatus);

      const updated = await storage.getCourierSales(userId);
      const updatedSale = updated.find((s) => s.id === id);
      res.json(updatedSale);
    } catch (error: any) {
      console.log("Steadfast status error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/steadfast/manual-status/:id", async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const { status } = req.body;

      const validStatuses = ["pending", "in_review", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be: pending, in_review, delivered, or cancelled" });
      }

      const allSales = await storage.getSales(userId);
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (!sale.isSentToCourier) return res.status(400).json({ message: "This sale is not a courier order" });

      const oldStatus = sale.courierStatus;
      await storage.updateSaleCourier(id, userId, sale.consignmentId || "", status);

      await applyCourierStatusFinancials(id, userId, sale, oldStatus, status);

      const updated = await storage.getCourierSales(userId);
      const updatedSale = updated.find((s) => s.id === id);
      res.json(updatedSale);
    } catch (error: any) {
      console.log("Manual status update error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });


  return httpServer;
}
