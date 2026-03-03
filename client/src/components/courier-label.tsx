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

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
  @page { size: A4 portrait; margin: 10mm 10mm; }
  .label-page { width: 100%; }
  .label-card {
    width: 100%;
    border: 1.5px solid #333;
    border-radius: 4px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    margin-bottom: 8mm;
  }
  .label-header {
    background: #1a1a1a;
    color: #fff;
    padding: 4px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .label-header-left { font-size: 7px; opacity: 0.85; }
  .label-header-right { font-size: 7px; opacity: 0.85; text-align: right; }
  .parcel-id-row {
    padding: 8px 10px;
    text-align: center;
    border-bottom: 1px solid #ccc;
    background: #f5f5f5;
  }
  .parcel-id-label { font-size: 7px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 2px; }
  .parcel-id-value { font-size: 28px; font-weight: 900; letter-spacing: 3px; color: #000; line-height: 1.1; }
  .body-row {
    display: flex;
    border-bottom: 1px solid #ddd;
  }
  .body-section {
    flex: 1;
    padding: 5px 10px;
  }
  .body-section + .body-section { border-left: 1px solid #ddd; }
  .section-title { font-size: 6.5px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 0.8px; margin-bottom: 2px; }
  .section-name { font-size: 10px; font-weight: 600; line-height: 1.2; }
  .section-detail { font-size: 8.5px; color: #444; line-height: 1.3; margin-top: 1px; }
  .cod-qr-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #ddd;
  }
  .cod-section {
    flex: 1;
    text-align: center;
    padding: 6px 10px;
  }
  .cod-label { font-size: 7px; text-transform: uppercase; color: #888; letter-spacing: 0.8px; margin-bottom: 1px; }
  .cod-value { font-size: 18px; font-weight: 800; color: #dc2626; }
  .qr-section {
    padding: 4px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid #ddd;
  }
  .footer-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 10px;
    font-size: 7px;
    color: #777;
    background: #fafafa;
  }
  .footer-row strong { color: #333; }
  @media print {
    body { padding: 0 !important; }
    .label-card { margin-bottom: 8mm; }
  }
`;

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

  const buildLabelHtml = () => {
    const content = labelRef.current;
    if (!content) return "";
    return content.querySelector(".label-card")?.outerHTML || "";
  };

  const handlePrint = () => {
    saveSenderInfo();
    const singleLabel = buildLabelHtml();
    if (!singleLabel) return;

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;

    const threeLabels = `${singleLabel}${singleLabel}${singleLabel}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Courier Label - ${sale.consignmentId || sale.id}</title>
        <style>${PRINT_STYLES}</style>
      </head>
      <body><div class="label-page">${threeLabels}</div></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleDownloadPDF = async () => {
    saveSenderInfo();
    const singleLabel = buildLabelHtml();
    if (!singleLabel) return;

    const threeLabels = `${singleLabel}${singleLabel}${singleLabel}`;

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:190mm;background:#fff;padding:0;";
    container.innerHTML = `<style>${PRINT_STYLES}</style><div class="label-page">${threeLabels}</div>`;
    document.body.appendChild(container);

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: 718 });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "JPEG", 10, 10, pdfWidth, pdfHeight);
    pdf.save(`Label-${sale.consignmentId || sale.id}.pdf`);
  };

  const codAmount = sale.paidAmount === 0 ? sale.totalPrice : sale.dueAmount > 0 ? sale.dueAmount : sale.totalPrice;
  const parcelId = sale.consignmentId || "N/A";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Courier Label
          </DialogTitle>
          <DialogDescription>
            Configure sender details. Prints 3 labels per A4 page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mb-3">
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
            Print (3x A4)
          </Button>
          <Button onClick={handleDownloadPDF} data-testid="button-download-label-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="border rounded-lg bg-white p-3">
          <p className="text-xs text-muted-foreground mb-2 text-center">Label Preview (prints 3 copies per A4 page)</p>
          <div ref={labelRef}>
            <style>{PRINT_STYLES}</style>
            <div className="label-card">
              <div className="label-header">
                <div className="label-header-left">
                  COURIER LABEL &middot; Sale #{sale.id}
                </div>
                <div className="label-header-right">
                  {formatLabelDate(sale.createdAt)}
                </div>
              </div>

              <div className="parcel-id-row">
                <div className="parcel-id-label">Parcel ID / Consignment</div>
                <div className="parcel-id-value" data-testid="text-label-parcel-id">{parcelId}</div>
              </div>

              <div className="body-row">
                {(companyName || companyPhone || companyAddress) && (
                  <div className="body-section">
                    <div className="section-title">From / Sender</div>
                    {companyName && <div className="section-name" data-testid="text-label-sender-name">{companyName}</div>}
                    {companyPhone && <div className="section-detail">{companyPhone}</div>}
                    {companyAddress && <div className="section-detail">{companyAddress}</div>}
                  </div>
                )}
                <div className="body-section">
                  <div className="section-title">To / Recipient</div>
                  <div className="section-name" data-testid="text-label-customer-name">{sale.customerName || "N/A"}</div>
                  <div className="section-detail" data-testid="text-label-customer-phone">{sale.customerPhone || ""}</div>
                  <div className="section-detail" data-testid="text-label-customer-address">{sale.customerAddress || ""}</div>
                </div>
              </div>

              <div className="cod-qr-row">
                <div className="cod-section">
                  <div className="cod-label">COD Amount</div>
                  <div className="cod-value" data-testid="text-label-cod-amount">{formatTaka(codAmount)}</div>
                </div>
                {sale.consignmentId && (
                  <div className="qr-section">
                    <QRCodeSVG value={sale.consignmentId} size={52} level="M" />
                  </div>
                )}
              </div>

              <div className="footer-row">
                <span>Consignment: <strong>{parcelId}</strong></span>
                <span>Items: <strong>{sale.items.length}</strong></span>
                {(sale.totalWeight ?? 0) > 0 && (
                  <span>Weight: <strong>{(sale.totalWeight ?? 0).toFixed(2)} KG</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
