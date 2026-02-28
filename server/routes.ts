import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sales, insertProductSchema, insertExpenseSchema, insertSupplierSchema, insertPurchaseSchema, insertCustomerSchema, insertInvestorSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSteadfastOrder, checkSteadfastStatus } from "./steadfast";

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
});

const updateProductSchema = insertProductSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/code/:code", async (req, res) => {
    try {
      const product = await storage.getProductByCode(req.params.code);
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
      const product = await storage.createProduct(parsed);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateProductSchema.parse(req.body);
      const product = await storage.updateProduct(id, parsed);
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
      const record = await storage.adjustStock(productId, adjustmentType, quantity, reason);
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/products/:id/stock-history", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const history = await storage.getStockHistory(productId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(id);
      if (!deleted) return res.status(404).json({ message: "Product not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales", async (_req, res) => {
    try {
      const salesList = await storage.getSales();
      res.json(salesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { items, customerId, customerName: newCustomerName, customerPhone, customerAddress, saveToCustomerList, paidAmount } = saleRequestSchema.parse(req.body);

      const resolvedItems: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        totalPrice: number;
      }> = [];

      for (const item of items) {
        const product = await storage.getProduct(item.productId);
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
        });
      }

      const totalAmount = resolvedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      const paid = paidAmount !== undefined ? paidAmount : totalAmount;
      const due = totalAmount - paid;

      let resolvedCustomerId: number | null = customerId || null;
      let resolvedCustomerName: string | null = null;
      let resolvedCustomerPhone: string | null = customerPhone || null;
      let resolvedCustomerAddress: string | null = customerAddress || null;

      if (customerId) {
        const customer = await storage.getCustomer(customerId);
        if (!customer) return res.status(404).json({ message: "Customer not found" });
        resolvedCustomerName = customer.name;
        resolvedCustomerPhone = customer.phone || resolvedCustomerPhone;
        resolvedCustomerAddress = customer.address || resolvedCustomerAddress;
      } else if (newCustomerName && newCustomerName.trim()) {
        resolvedCustomerName = newCustomerName.trim();
        if (saveToCustomerList) {
          const newCustomer = await storage.createCustomer({
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
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerAddress: resolvedCustomerAddress,
        paidAmount: paid,
        dueAmount: due,
        totalAmount,
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
      const updated = await storage.updateSalePayment(id, paidAmount, dueAmount);
      if (!updated) return res.status(404).json({ message: "Sale not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSale(id);
      if (!deleted) return res.status(404).json({ message: "Sale not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/expenses", async (_req, res) => {
    try {
      const expensesList = await storage.getExpenses();
      res.json(expensesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(parsed);
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExpense(id);
      if (!deleted) return res.status(404).json({ message: "Expense not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/suppliers", async (_req, res) => {
    try {
      const suppliersList = await storage.getSuppliers();
      res.json(suppliersList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const parsed = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(parsed);
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSupplier(id);
      if (!deleted) return res.status(404).json({ message: "Supplier not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/purchases", async (_req, res) => {
    try {
      const purchasesList = await storage.getPurchases();
      res.json(purchasesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    try {
      const { productId, supplierId, quantity } = req.body;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      let supplierName: string | null = null;
      if (supplierId) {
        const suppliersList = await storage.getSuppliers();
        const supplier = suppliersList.find(s => s.id === supplierId);
        supplierName = supplier?.name ?? null;
      }

      const purchase = await storage.createPurchase({
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
      const deleted = await storage.deletePurchase(id);
      if (!deleted) return res.status(404).json({ message: "Purchase not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/customers", async (_req, res) => {
    try {
      const customersList = await storage.getCustomers();
      res.json(customersList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const customerSales = await storage.getSalesByCustomer(id);
      const customerPayments = await storage.getPaymentsByCustomer(id);

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
      const customer = await storage.createCustomer(parsed);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCustomer(id);
      if (!deleted) return res.status(404).json({ message: "Customer not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments", async (_req, res) => {
    try {
      const paymentsList = await storage.getPayments();
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

      const payment = await storage.createPayment(customerId, amount);
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePayment(id);
      if (!deleted) return res.status(404).json({ message: "Payment not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/investors", async (_req, res) => {
    try {
      const investorsList = await storage.getInvestors();
      res.json(investorsList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/investors", async (req, res) => {
    try {
      const parsed = insertInvestorSchema.parse(req.body);
      const investor = await storage.createInvestor(parsed);
      res.status(201).json(investor);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/investors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteInvestor(id);
      if (!deleted) return res.status(404).json({ message: "Investor not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/steadfast-config", async (_req, res) => {
    try {
      const config = await storage.getSteadfastConfig();
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
      const config = await storage.saveSteadfastConfig(apiKey, secretKey, baseUrl);
      res.json({ apiKey: config.apiKey, secretKey: config.secretKey, baseUrl: config.baseUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/courier-sales", async (_req, res) => {
    try {
      const courierSales = await storage.getCourierSales();
      res.json(courierSales);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/steadfast/send/:id", async (req, res) => {
    try {
      const config = await storage.getSteadfastConfig();
      if (!config) return res.status(400).json({ message: "Steadfast API not configured. Please add your API credentials in Settings." });

      const id = parseInt(req.params.id);
      const allSales = await storage.getSales();
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (sale.isSentToCourier) return res.status(400).json({ message: "Already sent to courier" });
      if (!sale.customerName || !sale.customerPhone || !sale.customerAddress) {
        return res.status(400).json({ message: "Customer name, phone and address are required for courier" });
      }

      const codAmount = req.body?.amount !== undefined ? Number(req.body.amount) : sale.totalPrice;
      const saleWithAmount = { ...sale, totalPrice: codAmount };
      const result = await createSteadfastOrder(config, saleWithAmount);
      const updated = await storage.updateSaleCourier(id, result.consignment_id, "pending");
      res.json(updated);
    } catch (error: any) {
      console.log("Steadfast send error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/steadfast/order/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allSales = await storage.getSales();
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

  app.post("/api/steadfast/status/:id", async (req, res) => {
    try {
      const config = await storage.getSteadfastConfig();
      if (!config) return res.status(400).json({ message: "Steadfast API not configured." });

      const id = parseInt(req.params.id);
      const allSales = await storage.getSales();
      const sale = allSales.find((s) => s.id === id);
      if (!sale) return res.status(404).json({ message: "Sale not found" });
      if (!sale.consignmentId) return res.status(400).json({ message: "No consignment ID found" });

      const result = await checkSteadfastStatus(config, sale.consignmentId);
      await storage.updateSaleCourier(id, sale.consignmentId, result.delivery_status);
      if (result.delivery_status === "delivered" && sale.courierStatus !== "delivered") {
        await storage.updateSalePayment(id, sale.totalPrice, 0);
      }
      const updated = await storage.getCourierSales();
      const updatedSale = updated.find((s) => s.id === id);
      res.json(updatedSale);
    } catch (error: any) {
      console.log("Steadfast status error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
