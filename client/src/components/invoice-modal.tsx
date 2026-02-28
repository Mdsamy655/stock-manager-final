import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, Download, FileText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatInvoiceDate(date: string | Date | null): string {
  if (!date) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function generateInvoiceNumber(saleId: number): string {
  return `INV-${String(saleId).padStart(4, "0")}`;
}

type PaymentMode = "paid" | "due" | "partial";

interface InvoiceModalProps {
  sale: SaleWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceModal({ sale, open, onOpenChange }: InvoiceModalProps) {
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("invoice_company_name") || "My Business");
  const [companyAddress, setCompanyAddress] = useState(() => localStorage.getItem("invoice_company_address") || "");
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const initialMode = (): PaymentMode => {
    const salePaid = sale.paidAmount ?? sale.totalPrice;
    const saleDue = sale.dueAmount ?? 0;
    if (saleDue <= 0 || salePaid >= sale.totalPrice) return "paid";
    if (salePaid <= 0) return "due";
    return "partial";
  };

  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initialMode);
  const [partialPaid, setPartialPaid] = useState<string>(() => {
    const salePaid = sale.paidAmount ?? sale.totalPrice;
    return salePaid > 0 && salePaid < sale.totalPrice ? String(salePaid) : "";
  });

  const subtotal = sale.totalPrice;
  const grandTotal = subtotal + deliveryCharge;

  const computedPaid = paymentMode === "paid" ? grandTotal : paymentMode === "due" ? 0 : Math.min(Number(partialPaid) || 0, grandTotal);
  const computedDue = grandTotal - computedPaid;

  const paymentStatusLabel = paymentMode === "paid" ? "PAID" : paymentMode === "due" ? "DUE" : "PARTIAL";
  const paymentStatusColor = paymentMode === "paid" ? "#16a34a" : paymentMode === "due" ? "#dc2626" : "#d97706";

  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      const basePaid = paymentMode === "paid" ? sale.totalPrice : paymentMode === "due" ? 0 : Math.min(Number(partialPaid) || 0, sale.totalPrice);
      const baseDue = sale.totalPrice - basePaid;
      await apiRequest("PATCH", `/api/sales/${sale.id}/payment`, {
        paidAmount: basePaid,
        dueAmount: baseDue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Payment status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleGenerateInvoice = () => {
    localStorage.setItem("invoice_company_name", companyName);
    if (companyAddress) localStorage.setItem("invoice_company_address", companyAddress);
    updatePaymentMutation.mutate();
    setShowPreview(true);
  };

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${generateInvoiceNumber(sale.id)}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1a1a1a; }
          ${getInvoiceStyles()}
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleDownloadPDF = async () => {
    const content = invoiceRef.current;
    if (!content) return;

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 10, 10, pdfWidth, pdfHeight);
    pdf.save(`${generateInvoiceNumber(sale.id)}.pdf`);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setShowPreview(false);
      setDeliveryCharge(0);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {showPreview ? "Invoice Preview" : "Generate Invoice"}
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Business Name"
                data-testid="input-company-name"
              />
            </div>
            <div>
              <Label className="text-sm">Company Address (optional)</Label>
              <Input
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Address"
                data-testid="input-company-address"
              />
            </div>
            <div>
              <Label className="text-sm">Delivery Charge (optional)</Label>
              <Input
                type="number"
                min="0"
                value={deliveryCharge || ""}
                onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)}
                placeholder="0"
                data-testid="input-delivery-charge"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Added to invoice total only. Does not affect profit or stock.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Status</Label>
              <RadioGroup
                value={paymentMode}
                onValueChange={(v) => setPaymentMode(v as PaymentMode)}
                className="flex flex-col gap-2"
                data-testid="radio-payment-status"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="paid" id="payment-paid" data-testid="radio-fully-paid" />
                  <label htmlFor="payment-paid" className="text-sm cursor-pointer">Fully Paid</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="due" id="payment-due" data-testid="radio-fully-due" />
                  <label htmlFor="payment-due" className="text-sm cursor-pointer">Fully Due</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="partial" id="payment-partial" data-testid="radio-partial" />
                  <label htmlFor="payment-partial" className="text-sm cursor-pointer">Partial Payment</label>
                </div>
              </RadioGroup>

              {paymentMode === "partial" && (
                <div className="pl-6 pt-1">
                  <Label className="text-xs text-muted-foreground">Paid Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    max={grandTotal}
                    value={partialPaid}
                    onChange={(e) => setPartialPaid(e.target.value)}
                    placeholder="Enter paid amount"
                    data-testid="input-partial-paid"
                  />
                </div>
              )}

              {paymentMode !== "paid" && !sale.customerId && (
                <p className="text-xs text-amber-600">
                  Due amounts require a saved customer for tracking
                </p>
              )}
            </div>

            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatTaka(subtotal)}</span>
              </div>
              {deliveryCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Charge:</span>
                  <span>{formatTaka(deliveryCharge)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1">
                <span className="font-medium">Grand Total:</span>
                <span className="font-bold">{formatTaka(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600">Paid:</span>
                <span className="text-emerald-600">{formatTaka(computedPaid)}</span>
              </div>
              {computedDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-red-600 font-medium">Due:</span>
                  <span className="text-red-600 font-medium">{formatTaka(computedDue)}</span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerateInvoice}
              disabled={updatePaymentMutation.isPending || (paymentMode !== "paid" && !sale.customerId)}
              data-testid="button-generate-invoice"
            >
              <FileText className="h-4 w-4 mr-2" />
              {updatePaymentMutation.isPending ? "Saving..." : "Generate Invoice"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPreview(false)} data-testid="button-back-edit">
                Back to Edit
              </Button>
              <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button onClick={handleDownloadPDF} data-testid="button-download-pdf">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>

            <div className="border rounded-lg p-1 bg-white">
              <div ref={invoiceRef} className="invoice-content" style={{ padding: "30px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a", background: "#fff" }}>
                <div style={{ textAlign: "center", marginBottom: "24px", borderBottom: "2px solid #e5e7eb", paddingBottom: "16px" }}>
                  <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px 0", color: "#111" }} data-testid="text-invoice-company">{companyName}</h1>
                  {companyAddress && (
                    <p style={{ fontSize: "13px", color: "#666", margin: "0" }}>{companyAddress}</p>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "13px" }}>
                  <div>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Invoice #:</strong> <span data-testid="text-invoice-number">{generateInvoiceNumber(sale.id)}</span>
                    </p>
                    <p style={{ margin: "0" }}>
                      <strong>Date:</strong> {formatInvoiceDate(sale.createdAt)}
                    </p>
                  </div>
                  {sale.customerName && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: "0 0 4px 0", color: "#666" }}>Billed To:</p>
                      <p style={{ margin: "0", fontWeight: "600" }} data-testid="text-invoice-customer">{sale.customerName}</p>
                      {sale.customerPhone && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#666" }} data-testid="text-invoice-phone">{sale.customerPhone}</p>
                      )}
                      {sale.customerAddress && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#666" }} data-testid="text-invoice-address">{sale.customerAddress}</p>
                      )}
                    </div>
                  )}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "8px 4px", fontWeight: "600", color: "#444" }}>Product</th>
                      <th style={{ textAlign: "center", padding: "8px 4px", fontWeight: "600", color: "#444" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: "600", color: "#444" }}>Price</th>
                      <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: "600", color: "#444" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-invoice-item-${i}`}>
                        <td style={{ padding: "8px 4px" }}>{item.productName}</td>
                        <td style={{ padding: "8px 4px", textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ padding: "8px 4px", textAlign: "right" }}>{formatTaka(item.unitPrice)}</td>
                        <td style={{ padding: "8px 4px", textAlign: "right" }}>{formatTaka(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "12px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ width: "240px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span style={{ color: "#666" }}>Subtotal:</span>
                        <span data-testid="text-invoice-subtotal">{formatTaka(subtotal)}</span>
                      </div>
                      {deliveryCharge > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span style={{ color: "#666" }}>Delivery Charge:</span>
                          <span data-testid="text-invoice-delivery">{formatTaka(deliveryCharge)}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderTop: "1px solid #e5e7eb", fontWeight: "bold", fontSize: "15px" }}>
                        <span>Grand Total:</span>
                        <span data-testid="text-invoice-grand-total">{formatTaka(grandTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span style={{ color: "#16a34a" }}>Paid:</span>
                        <span style={{ color: "#16a34a" }} data-testid="text-invoice-paid">{formatTaka(computedPaid)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span style={{ color: computedDue > 0 ? "#dc2626" : "#666", fontWeight: computedDue > 0 ? "600" : "normal" }}>Due:</span>
                        <span style={{ color: computedDue > 0 ? "#dc2626" : "#666", fontWeight: computedDue > 0 ? "600" : "normal" }} data-testid="text-invoice-due">{formatTaka(computedDue)}</span>
                      </div>

                      <div style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: "10px",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        backgroundColor: paymentMode === "paid" ? "#dcfce7" : paymentMode === "due" ? "#fee2e2" : "#fef3c7",
                        border: `1px solid ${paymentStatusColor}`,
                      }}>
                        <span
                          style={{ fontWeight: "bold", fontSize: "14px", color: paymentStatusColor, letterSpacing: "1px" }}
                          data-testid="text-invoice-payment-status"
                        >
                          {paymentStatusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "30px", textAlign: "center", fontSize: "12px", color: "#999", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
                  Thank you for your business!
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getInvoiceStyles(): string {
  return `
    .invoice-content { max-width: 700px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      .invoice-content { padding: 20px !important; }
    }
  `;
}
