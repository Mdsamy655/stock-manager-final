import { useRef, useState, useEffect } from "react";
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
import JsBarcode from "jsbarcode";
import type { SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatLabelDate(date: string | Date | null): string {
  if (!date) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const LABEL_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
  @page { size: A4 portrait; margin: 10mm 10mm; }
  .label-page { width: 100%; }
  .label-card {
    width: 100%;
    border: 2px solid #222;
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    margin-bottom: 8mm;
    background: #fff;
  }
  .label-header {
    background: #111;
    color: #fff;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .label-header-left { font-size: 8px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .label-header-right { font-size: 8px; opacity: 0.9; text-align: right; }
  .tracking-row {
    padding: 10px 12px 8px;
    text-align: center;
    border-bottom: 2px solid #222;
    background: #f8f8f8;
  }
  .tracking-label { font-size: 7px; text-transform: uppercase; color: #666; letter-spacing: 1.5px; margin-bottom: 3px; font-weight: 600; }
  .tracking-value { font-size: 26px; font-weight: 900; letter-spacing: 3px; color: #000; line-height: 1.1; }
  .details-row {
    display: flex;
    border-bottom: 1.5px solid #ddd;
  }
  .detail-section {
    flex: 1;
    padding: 8px 12px;
  }
  .detail-section + .detail-section { border-left: 1.5px solid #ddd; }
  .detail-title { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 3px; }
  .detail-name { font-size: 11px; font-weight: 700; line-height: 1.3; color: #111; }
  .detail-info { font-size: 9px; color: #333; line-height: 1.4; margin-top: 2px; font-weight: 500; }
  .cod-weight-row {
    display: flex;
    border-bottom: 1.5px solid #ddd;
  }
  .cod-box {
    flex: 1;
    text-align: center;
    padding: 8px 12px;
    background: #fff5f5;
    border-right: 1.5px solid #ddd;
  }
  .cod-label { font-size: 7px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 2px; font-weight: 600; }
  .cod-amount { font-size: 22px; font-weight: 900; color: #dc2626; }
  .weight-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
  }
  .weight-label { font-size: 7px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 2px; font-weight: 600; }
  .weight-value { font-size: 14px; font-weight: 700; color: #333; }
  .codes-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    background: #fafafa;
  }
  .qr-box { flex-shrink: 0; }
  .barcode-box { flex: 1; text-align: center; overflow: hidden; }
  .barcode-box svg { max-width: 100%; height: auto; }
  .label-footer {
    text-align: center;
    padding: 4px 12px;
    font-size: 7px;
    color: #999;
    background: #f5f5f5;
    letter-spacing: 0.5px;
  }
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

function BarcodeComponent({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // ignore invalid barcode values
      }
    }
  }, [value]);
  return <svg ref={svgRef} />;
}

export function generateBarcodeSvgString(value: string): string {
  if (!value || value === "N/A") return "";
  try {
    const doc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
    const svgEl = doc.documentElement;
    JsBarcode(svgEl, value, {
      format: "CODE128",
      width: 1.5,
      height: 40,
      displayValue: false,
      margin: 0,
      xmlDocument: doc,
    });
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  } catch {
    return "";
  }
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
    const card = content.querySelector(".label-card");
    if (!card) return "";
    const clone = card.cloneNode(true) as HTMLElement;
    const reactBarcode = clone.querySelector(".barcode-box");
    if (reactBarcode && sale.consignmentId) {
      const barcodeSvg = generateBarcodeSvgString(sale.consignmentId);
      if (barcodeSvg) {
        reactBarcode.innerHTML = barcodeSvg;
      }
    }
    const reactQr = clone.querySelector(".qr-box");
    if (reactQr && sale.consignmentId) {
      const tempDiv = document.createElement("div");
      const existingQr = content.querySelector(".qr-box svg");
      if (existingQr) {
        tempDiv.appendChild(existingQr.cloneNode(true));
        reactQr.innerHTML = tempDiv.innerHTML;
      }
    }
    return clone.outerHTML;
  };

  const handlePrint = () => {
    saveSenderInfo();
    const singleLabel = buildLabelHtml();
    if (!singleLabel) return;

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Courier Label - ${sale.consignmentId || sale.id}</title>
        <style>${LABEL_STYLES}</style>
      </head>
      <body><div class="label-page">${singleLabel}</div></body>
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

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:190mm;background:#fff;padding:0;";
    container.innerHTML = `<style>${LABEL_STYLES}</style><div class="label-page">${singleLabel}</div>`;
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
  const trackingNumber = sale.consignmentId || "N/A";
  const weight = sale.totalWeight ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Courier Label
          </DialogTitle>
          <DialogDescription>
            Configure sender details and print or download the shipping label.
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
            Print Label
          </Button>
          <Button onClick={handleDownloadPDF} data-testid="button-download-label-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="border rounded-lg bg-white p-3">
          <p className="text-xs text-muted-foreground mb-2 text-center">Label Preview</p>
          <div ref={labelRef}>
            <style>{LABEL_STYLES}</style>
            <div className="label-card">
              <div className="label-header">
                <div className="label-header-left">
                  Shipping Label &middot; Sale #{sale.id}
                </div>
                <div className="label-header-right">
                  {formatLabelDate(sale.createdAt)}
                </div>
              </div>

              <div className="tracking-row">
                <div className="tracking-label">Tracking Number</div>
                <div className="tracking-value" data-testid="text-label-parcel-id">{trackingNumber}</div>
              </div>

              <div className="details-row">
                {(companyName || companyPhone || companyAddress) && (
                  <div className="detail-section">
                    <div className="detail-title">From</div>
                    {companyName && <div className="detail-name" data-testid="text-label-sender-name">{companyName}</div>}
                    {companyPhone && <div className="detail-info">{companyPhone}</div>}
                    {companyAddress && <div className="detail-info">{companyAddress}</div>}
                  </div>
                )}
                <div className="detail-section">
                  <div className="detail-title">To</div>
                  <div className="detail-name" data-testid="text-label-customer-name">{sale.customerName || "N/A"}</div>
                  <div className="detail-info" data-testid="text-label-customer-phone">{sale.customerPhone || ""}</div>
                  <div className="detail-info" data-testid="text-label-customer-address">{sale.customerAddress || ""}</div>
                </div>
              </div>

              <div className="cod-weight-row">
                <div className="cod-box">
                  <div className="cod-label">COD Amount</div>
                  <div className="cod-amount" data-testid="text-label-cod-amount">{formatTaka(codAmount)}</div>
                </div>
                <div className="weight-box">
                  <div className="weight-label">Weight</div>
                  <div className="weight-value">{weight > 0 ? `${weight.toFixed(2)} KG` : "—"}</div>
                </div>
              </div>

              {sale.consignmentId && (
                <div className="codes-row">
                  <div className="qr-box">
                    <QRCodeSVG value={sale.consignmentId} size={56} level="M" />
                  </div>
                  <div className="barcode-box">
                    <BarcodeComponent value={sale.consignmentId} />
                  </div>
                </div>
              )}

              <div className="label-footer">
                Powered by CPSBD Business (FB Page)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
