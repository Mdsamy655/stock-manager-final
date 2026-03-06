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

const SINGLE_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 0; }
  .label-page {
    width: 210mm;
    height: 297mm;
    padding: 5mm 8mm;
    display: flex;
    flex-direction: column;
    gap: 4mm;
  }
  .label-card {
    width: 100%;
    flex: 1;
    border: 2px solid #222;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fff;
    page-break-inside: avoid;
  }
  .label-header {
    background: #111;
    color: #fff;
    padding: 4px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .label-header-left { font-size: 8px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .label-header-right { font-size: 8px; opacity: 0.9; }
  .tracking-row {
    padding: 6px 10px 5px;
    text-align: center;
    border-bottom: 2px solid #222;
    background: #f8f8f8;
    flex-shrink: 0;
  }
  .tracking-label { font-size: 7px; text-transform: uppercase; color: #666; letter-spacing: 1.5px; margin-bottom: 2px; font-weight: 600; }
  .tracking-value { font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #000; line-height: 1.1; }
  .details-row {
    display: flex;
    border-bottom: 1.5px solid #ddd;
    flex: 1;
    min-height: 0;
  }
  .detail-section {
    flex: 1;
    padding: 5px 10px;
    overflow: hidden;
  }
  .detail-section + .detail-section { border-left: 1.5px solid #ddd; }
  .detail-title { font-size: 6.5px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 2px; }
  .detail-name { font-size: 11px; font-weight: 700; line-height: 1.3; color: #111; }
  .detail-phone { font-size: 10px; color: #222; line-height: 1.3; margin-top: 2px; font-weight: 600; }
  .detail-address { font-size: 9px; color: #444; line-height: 1.3; margin-top: 1px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cod-weight-line {
    text-align: center;
    padding: 5px 10px;
    border-bottom: 1.5px solid #ddd;
    background: #fff5f5;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 800;
    color: #111;
  }
  .cod-weight-line .cod-val { color: #dc2626; }
  .codes-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 6px 10px;
    background: #fafafa;
    flex-shrink: 0;
  }
  .qr-box { flex-shrink: 0; }
  .qr-box svg { width: 72px; height: 72px; }
  .barcode-box { flex: 1; text-align: center; overflow: hidden; }
  .barcode-box svg { max-width: 100%; height: 50px; }
  .label-footer {
    text-align: center;
    padding: 4px 10px;
    font-size: 8px;
    font-weight: 700;
    color: #666;
    background: #f0f0f0;
    letter-spacing: 0.5px;
    flex-shrink: 0;
    border-top: 1px solid #ddd;
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

function BarcodeComponent({ value, height = 50 }: { value: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 2,
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

export function generateBarcodeSvgString(value: string, height = 50, width = 2): string {
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
      const barcodeSvg = generateBarcodeSvgString(sale.consignmentId, 50, 2);
      if (barcodeSvg) reactBarcode.innerHTML = barcodeSvg;
    }
    const reactQr = clone.querySelector(".qr-box");
    if (reactQr && sale.consignmentId) {
      const existingQr = content.querySelector(".qr-box svg");
      if (existingQr) reactQr.innerHTML = existingQr.cloneNode(true) as unknown as string;
    }
    return clone.outerHTML;
  };

  const handlePrint = () => {
    saveSenderInfo();
    const singleLabel = buildLabelHtml();
    if (!singleLabel) return;

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;

    const tripled = singleLabel + singleLabel + singleLabel;

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Courier Label - ${sale.consignmentId || sale.id}</title>
      <style>${SINGLE_PRINT_STYLES}</style>
    </head><body><div class="label-page">${tripled}</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleDownloadPDF = async () => {
    saveSenderInfo();
    const singleLabel = buildLabelHtml();
    if (!singleLabel) return;

    const tripled = singleLabel + singleLabel + singleLabel;

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;background:#fff;padding:0;";
    container.innerHTML = `<style>${SINGLE_PRINT_STYLES}</style><div class="label-page">${tripled}</div>`;
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
          <p className="text-xs text-muted-foreground mb-2 text-center">Label Preview (prints 3 per A4 page)</p>
          <div ref={labelRef}>
            <div className="label-card" style={{ border: "2px solid #222", borderRadius: "5px", overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff" }}>
              <div style={{ background: "#111", color: "#fff", padding: "4px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" as const }}>Shipping Label &middot; Sale #{sale.id}</span>
                <span style={{ fontSize: "8px", opacity: 0.9 }}>{formatLabelDate(sale.createdAt)}</span>
              </div>

              <div style={{ padding: "6px 10px 5px", textAlign: "center" as const, borderBottom: "2px solid #222", background: "#f8f8f8" }}>
                <div style={{ fontSize: "7px", textTransform: "uppercase" as const, color: "#666", letterSpacing: "1.5px", marginBottom: "2px", fontWeight: 600 }}>Tracking Number</div>
                <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "3px", color: "#000", lineHeight: 1.1 }} data-testid="text-label-parcel-id">{trackingNumber}</div>
              </div>

              <div style={{ display: "flex", borderBottom: "1.5px solid #ddd" }}>
                {(companyName || companyPhone || companyAddress) && (
                  <div style={{ flex: 1, padding: "5px 10px", borderRight: "1.5px solid #ddd" }}>
                    <div style={{ fontSize: "6.5px", fontWeight: 700, textTransform: "uppercase" as const, color: "#999", letterSpacing: "1px", marginBottom: "2px" }}>From</div>
                    {companyName && <div style={{ fontSize: "11px", fontWeight: 700, color: "#111" }} data-testid="text-label-sender-name">{companyName}</div>}
                    {companyPhone && <div style={{ fontSize: "10px", color: "#222", fontWeight: 600, marginTop: "1px" }}>{companyPhone}</div>}
                    {companyAddress && <div style={{ fontSize: "9px", color: "#444", marginTop: "1px", fontWeight: 500, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{companyAddress}</div>}
                  </div>
                )}
                <div style={{ flex: 1, padding: "5px 10px" }}>
                  <div style={{ fontSize: "6.5px", fontWeight: 700, textTransform: "uppercase" as const, color: "#999", letterSpacing: "1px", marginBottom: "2px" }}>To</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#111" }} data-testid="text-label-customer-name">{sale.customerName || "N/A"}</div>
                  <div style={{ fontSize: "10px", color: "#222", fontWeight: 600, marginTop: "1px" }} data-testid="text-label-customer-phone">{sale.customerPhone || ""}</div>
                  <div style={{ fontSize: "9px", color: "#444", marginTop: "1px", fontWeight: 500, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }} data-testid="text-label-customer-address">{sale.customerAddress || ""}</div>
                </div>
              </div>

              <div style={{ textAlign: "center" as const, padding: "4px 10px", borderBottom: "1.5px solid #ddd", background: "#fff5f5", fontSize: "13px", fontWeight: 800, color: "#111" }}>
                <span>COD: </span><span style={{ color: "#dc2626" }} data-testid="text-label-cod-amount">{formatTaka(codAmount)}</span>
                <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
                <span>Weight: {weight > 0 ? `${weight.toFixed(2)} KG` : "—"}</span>
              </div>

              {sale.consignmentId && (
                <div className="codes-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", padding: "6px 10px", background: "#fafafa" }}>
                  <div className="qr-box">
                    <QRCodeSVG value={sale.consignmentId} size={72} level="M" />
                  </div>
                  <div className="barcode-box" style={{ flex: 1, textAlign: "center" as const, overflow: "hidden" }}>
                    <BarcodeComponent value={sale.consignmentId} height={50} />
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center" as const, padding: "4px 10px", fontSize: "8px", fontWeight: 700, color: "#666", background: "#f0f0f0", borderTop: "1px solid #ddd" }}>
                Powered by CPSBD Business (FB Page)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
