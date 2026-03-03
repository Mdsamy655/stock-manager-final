import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatLabelDate(date: string | Date | null): string {
  if (!date) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface CourierLabelProps {
  sale: SaleWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CourierLabel({ sale, open, onOpenChange }: CourierLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("label_company_name") || "");
  const [companyPhone, setCompanyPhone] = useState(() => localStorage.getItem("label_company_phone") || "");
  const [companyAddress, setCompanyAddress] = useState(() => localStorage.getItem("label_company_address") || "");

  const saveSenderInfo = () => {
    if (companyName) localStorage.setItem("label_company_name", companyName);
    if (companyPhone) localStorage.setItem("label_company_phone", companyPhone);
    if (companyAddress) localStorage.setItem("label_company_address", companyAddress);
  };

  const handlePrint = () => {
    saveSenderInfo();
    const content = labelRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Courier Label - ${sale.consignmentId || sale.id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; color: #1a1a1a; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleDownloadPDF = async () => {
    saveSenderInfo();
    const content = labelRef.current;
    if (!content) return;

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "JPEG", 10, 10, pdfWidth, pdfHeight);
    pdf.save(`Label-${sale.consignmentId || sale.id}.pdf`);
  };

  const codAmount = sale.paidAmount === 0 ? sale.totalPrice : sale.dueAmount > 0 ? sale.dueAmount : sale.totalPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Courier Label
          </DialogTitle>
          <DialogDescription>
            Configure sender details and print or download the shipping label.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Sender Name</label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                data-testid="input-label-company-name"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sender Phone</label>
              <Input
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="Phone number"
                data-testid="input-label-company-phone"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sender Address</label>
              <Input
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Address"
                data-testid="input-label-company-address"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mb-3">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-label">
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
          <Button onClick={handleDownloadPDF} data-testid="button-download-label-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="border rounded-lg bg-white">
          <div ref={labelRef} style={{ padding: "24px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a", background: "#fff" }}>
            <div style={{ border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ background: "#1a1a1a", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "1px" }}>COURIER LABEL</div>
                  <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>Parcel ID: {sale.consignmentId || "N/A"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", opacity: 0.8 }}>Sale #{sale.id}</div>
                  <div style={{ fontSize: "11px", opacity: 0.8 }}>{formatLabelDate(sale.createdAt)}</div>
                </div>
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
                {(companyName || companyPhone || companyAddress) && (
                  <div style={{ flex: 1, padding: "12px 16px", borderRight: "1px solid #ddd" }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#888", marginBottom: "6px", letterSpacing: "1px" }}>From / Sender</div>
                    {companyName && <div style={{ fontSize: "14px", fontWeight: "600" }} data-testid="text-label-sender-name">{companyName}</div>}
                    {companyPhone && <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{companyPhone}</div>}
                    {companyAddress && <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{companyAddress}</div>}
                  </div>
                )}
                <div style={{ flex: 1, padding: "12px 16px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#888", marginBottom: "6px", letterSpacing: "1px" }}>To / Recipient</div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }} data-testid="text-label-customer-name">{sale.customerName || "N/A"}</div>
                  <div style={{ fontSize: "13px", color: "#333", marginTop: "2px" }} data-testid="text-label-customer-phone">{sale.customerPhone || ""}</div>
                  <div style={{ fontSize: "12px", color: "#555", marginTop: "2px", lineHeight: "1.4" }} data-testid="text-label-customer-address">{sale.customerAddress || ""}</div>
                </div>
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#888", marginBottom: "6px", letterSpacing: "1px" }}>COD Amount</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "#dc2626", letterSpacing: "1px" }} data-testid="text-label-cod-amount">
                      {formatTaka(codAmount)}
                    </div>
                  </div>
                </div>
                {sale.consignmentId && (
                  <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #ddd" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
                        <QRCodeSVG value={sale.consignmentId} size={100} level="M" />
                      </div>
                      <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>Scan to verify</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: "10px 16px", background: "#f9f9f9", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#666" }}>
                <span>Consignment: <strong style={{ color: "#333" }}>{sale.consignmentId || "N/A"}</strong></span>
                <span>Items: <strong style={{ color: "#333" }}>{sale.items.length}</strong></span>
                {(sale.totalWeight ?? 0) > 0 && (
                  <span>Weight: <strong style={{ color: "#333" }}>{(sale.totalWeight ?? 0).toFixed(2)} KG</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
