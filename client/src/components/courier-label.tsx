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
import { renderToStaticMarkup } from "react-dom/server";
import JsBarcode from "jsbarcode";
import type { SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatLabelDate(date: string | Date | null): string {
  if (!date) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const SINGLE_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 0; }
  .label-page {
    width: 210mm;
    height: 297mm;
    padding: 10mm 15mm;
    display: flex;
    flex-direction: column;
  }
  .label-card {
    width: 100%;
    flex: 1;
    border: 2.5px solid #111;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  .label-header {
    background: #111;
    color: #fff;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .label-header-left { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .label-header-right { font-size: 12px; opacity: 0.9; font-weight: 500; }
  .tracking-row {
    padding: 14px 20px 12px;
    text-align: center;
    border-bottom: 2.5px solid #111;
    background: #f5f5f5;
    flex-shrink: 0;
  }
  .tracking-label { font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: 2px; margin-bottom: 4px; font-weight: 700; }
  .tracking-value { font-size: 38px; font-weight: 900; letter-spacing: 4px; color: #000; line-height: 1.1; }
  .details-row {
    display: flex;
    border-bottom: 2px solid #ddd;
    flex-shrink: 0;
  }
  .detail-section {
    flex: 1;
    padding: 12px 20px;
    overflow: hidden;
  }
  .detail-section + .detail-section { border-left: 2px solid #ddd; }
  .detail-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #888; letter-spacing: 1.5px; margin-bottom: 5px; }
  .detail-name { font-size: 18px; font-weight: 800; line-height: 1.3; color: #000; }
  .detail-phone { font-size: 16px; color: #111; line-height: 1.3; margin-top: 4px; font-weight: 700; }
  .detail-address { font-size: 14px; color: #222; line-height: 1.4; margin-top: 3px; font-weight: 700; }
  .cod-weight-line {
    text-align: center;
    padding: 10px 20px;
    border-bottom: 2px solid #ddd;
    background: #fff5f5;
    flex-shrink: 0;
    font-size: 22px;
    font-weight: 900;
    color: #111;
  }
  .cod-weight-line .cod-val { color: #dc2626; }
  .cod-weight-line .sep { margin: 0 12px; color: #ccc; }
  .codes-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 15px 20px;
    background: #fafafa;
    flex: 1;
    min-height: 0;
    gap: 10px;
  }
  .qr-box { flex-shrink: 0; }
  .qr-box svg { width: 140px; height: 140px; }
  .barcode-box { width: 80%; text-align: center; overflow: hidden; }
  .barcode-box svg { max-width: 100%; height: 70px; }
  .label-footer {
    text-align: center;
    padding: 8px 20px;
    font-size: 12px;
    font-weight: 800;
    color: #444;
    background: #e8e8e8;
    letter-spacing: 0.5px;
    flex-shrink: 0;
    border-top: 2px solid #ddd;
  }
  @media print {
    body { padding: 0 !important; }
  }
`;

interface CourierLabelProps {
  sale: SaleWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BarcodeComponent({ value, height = 70 }: { value: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 2.5,
          height,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // fallback
      }
    }
  }, [value, height]);
  return <svg ref={svgRef} />;
}

export function generateBarcodeSvgString(value: string, height = 70, width = 2.5): string {
  if (!value || value === "N/A") return "";
  try {
    const doc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
    const svgEl = doc.documentElement;
    JsBarcode(svgEl, value, {
      format: "CODE128",
      width,
      height,
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

function generateQrSvgString(value: string, size: number): string {
  if (!value || value === "N/A") return "";
  try {
    return renderToStaticMarkup(<QRCodeSVG value={value} size={size} level="M" />);
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

  const codAmount = sale.paidAmount === 0 ? sale.totalPrice : sale.dueAmount > 0 ? sale.dueAmount : sale.totalPrice;
  const trackingNumber = sale.consignmentId || "N/A";
  const weight = sale.totalWeight ?? 0;

  const buildPrintHtml = () => {
    const hasSender = companyName || companyPhone || companyAddress;
    const qrSvg = sale.consignmentId ? generateQrSvgString(sale.consignmentId, 140) : "";
    const barcodeSvg = sale.consignmentId ? generateBarcodeSvgString(sale.consignmentId, 70, 2.5) : "";

    return `
      <div class="label-card">
        <div class="label-header">
          <div class="label-header-left">Shipping Label &middot; Sale #${sale.id}</div>
          <div class="label-header-right">${formatLabelDate(sale.createdAt)}</div>
        </div>
        <div class="tracking-row">
          <div class="tracking-label">Tracking Number</div>
          <div class="tracking-value">${escapeHtml(trackingNumber)}</div>
        </div>
        <div class="details-row">
          ${hasSender ? `
            <div class="detail-section">
              <div class="detail-title">From</div>
              ${companyName ? `<div class="detail-name">${escapeHtml(companyName)}</div>` : ""}
              ${companyPhone ? `<div class="detail-phone">${escapeHtml(companyPhone)}</div>` : ""}
              ${companyAddress ? `<div class="detail-address">${escapeHtml(companyAddress)}</div>` : ""}
            </div>
          ` : ""}
          <div class="detail-section">
            <div class="detail-title">To</div>
            <div class="detail-name">${escapeHtml(sale.customerName || "N/A")}</div>
            <div class="detail-phone">${escapeHtml(sale.customerPhone || "")}</div>
            <div class="detail-address">${escapeHtml(sale.customerAddress || "")}</div>
          </div>
        </div>
        <div class="cod-weight-line">
          COD: <span class="cod-val">${formatTaka(codAmount)}</span>
          <span class="sep">|</span>
          Weight: ${weight > 0 ? `${weight.toFixed(2)} KG` : "—"}
        </div>
        ${sale.consignmentId ? `
          <div class="codes-section">
            <div class="qr-box">${qrSvg}</div>
            <div class="barcode-box">${barcodeSvg}</div>
          </div>
        ` : ""}
        <div class="label-footer">Powered by CPSBD Business (FB Page)</div>
      </div>
    `;
  };

  const handlePrint = () => {
    saveSenderInfo();
    const labelHtml = buildPrintHtml();

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Courier Label - ${sale.consignmentId || sale.id}</title>
      <style>${SINGLE_PRINT_STYLES}</style>
    </head><body><div class="label-page">${labelHtml}</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleDownloadPDF = async () => {
    saveSenderInfo();
    const labelHtml = buildPrintHtml();

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;background:#fff;padding:0;";
    container.innerHTML = `<style>${SINGLE_PRINT_STYLES}</style><div class="label-page" style="height:auto;min-height:297mm;">${labelHtml}</div>`;
    document.body.appendChild(container);

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Label-${sale.consignmentId || sale.id}.pdf`);
  };

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
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Name" data-testid="input-label-company-name" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sender Phone</label>
              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="Phone number" data-testid="input-label-company-phone" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sender Address</label>
              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Address" data-testid="input-label-company-address" />
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
          <p className="text-xs text-muted-foreground mb-2 text-center">Label Preview (1 label per A4 page)</p>
          <div ref={labelRef}>
            <div className="label-card" style={{ border: "2px solid #111", borderRadius: "6px", overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff" }}>
              <div style={{ background: "#111", color: "#fff", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const }}>Shipping Label &middot; Sale #{sale.id}</span>
                <span style={{ fontSize: "8px", opacity: 0.9 }}>{formatLabelDate(sale.createdAt)}</span>
              </div>

              <div style={{ padding: "8px 12px 6px", textAlign: "center" as const, borderBottom: "2px solid #111", background: "#f5f5f5" }}>
                <div style={{ fontSize: "7px", textTransform: "uppercase" as const, color: "#555", letterSpacing: "2px", marginBottom: "2px", fontWeight: 700 }}>Tracking Number</div>
                <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "3px", color: "#000", lineHeight: 1.1 }} data-testid="text-label-parcel-id">{trackingNumber}</div>
              </div>

              <div style={{ display: "flex", borderBottom: "1.5px solid #ddd" }}>
                {(companyName || companyPhone || companyAddress) && (
                  <div style={{ flex: 1, padding: "6px 12px", borderRight: "1.5px solid #ddd" }}>
                    <div style={{ fontSize: "7px", fontWeight: 800, textTransform: "uppercase" as const, color: "#888", letterSpacing: "1px", marginBottom: "3px" }}>From</div>
                    {companyName && <div style={{ fontSize: "12px", fontWeight: 800, color: "#000" }} data-testid="text-label-sender-name">{companyName}</div>}
                    {companyPhone && <div style={{ fontSize: "11px", color: "#111", fontWeight: 700, marginTop: "2px" }}>{companyPhone}</div>}
                    {companyAddress && <div style={{ fontSize: "10px", color: "#222", marginTop: "2px", fontWeight: 700 }}>{companyAddress}</div>}
                  </div>
                )}
                <div style={{ flex: 1, padding: "6px 12px" }}>
                  <div style={{ fontSize: "7px", fontWeight: 800, textTransform: "uppercase" as const, color: "#888", letterSpacing: "1px", marginBottom: "3px" }}>To</div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#000" }} data-testid="text-label-customer-name">{sale.customerName || "N/A"}</div>
                  <div style={{ fontSize: "11px", color: "#111", fontWeight: 700, marginTop: "2px" }} data-testid="text-label-customer-phone">{sale.customerPhone || ""}</div>
                  <div style={{ fontSize: "10px", color: "#222", marginTop: "2px", fontWeight: 700 }} data-testid="text-label-customer-address">{sale.customerAddress || ""}</div>
                </div>
              </div>

              <div style={{ textAlign: "center" as const, padding: "5px 12px", borderBottom: "1.5px solid #ddd", background: "#fff5f5", fontSize: "14px", fontWeight: 900, color: "#111" }}>
                <span>COD: </span><span style={{ color: "#dc2626" }} data-testid="text-label-cod-amount">{formatTaka(codAmount)}</span>
                <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
                <span>Weight: {weight > 0 ? `${weight.toFixed(2)} KG` : "—"}</span>
              </div>

              {sale.consignmentId && (
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "8px 12px", background: "#fafafa", gap: "6px" }}>
                  <div className="qr-box">
                    <QRCodeSVG value={sale.consignmentId} size={80} level="M" />
                  </div>
                  <div style={{ width: "70%", textAlign: "center" as const, overflow: "hidden" }}>
                    <BarcodeComponent value={sale.consignmentId} height={40} />
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center" as const, padding: "4px 12px", fontSize: "8px", fontWeight: 800, color: "#444", background: "#e8e8e8", borderTop: "1px solid #ddd" }}>
                Powered by CPSBD Business (FB Page)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
