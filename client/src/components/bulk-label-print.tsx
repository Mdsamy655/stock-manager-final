import { useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateBarcodeSvgString } from "./courier-label";
import type { SaleWithItems } from "@shared/schema";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatLabelDate(date: string | Date | null): string {
  if (!date)
    return new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const BULK_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 0; }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 3mm 3mm;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 2mm;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .label-card {
    width: 100%;
    height: 100%;
    border: 1.5px solid #111;
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 100%;
    background: #fff;
  }
  .label-header {
    background: #111;
    color: #fff;
    padding: 1.5px 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .label-header-left { font-size: 5px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
  .label-header-right { font-size: 5px; opacity: 0.9; }
  .tracking-row {
    padding: 2px 4px 1.5px;
    text-align: center;
    border-bottom: 1.5px solid #111;
    background: #f5f5f5;
    flex-shrink: 0;
  }
  .tracking-label { font-size: 4px; text-transform: uppercase; color: #555; letter-spacing: 0.8px; margin-bottom: 0.5px; font-weight: 700; }
  .tracking-value { font-size: 13px; font-weight: 900; letter-spacing: 1.5px; color: #000; line-height: 1.1; }
  .details-row {
  display: flex;
  border-bottom: 1px solid #ddd;
  flex-shrink: 1;
  min-height: 0;
  overflow: hidden;
  margin-top: 6px;
}
  .detail-section {
    flex: 1;
    padding: 2.5px 4px;
    overflow: hidden;
  }
  .detail-section + .detail-section { border-left: 1px solid #ddd; }
  .detail-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #555; letter-spacing: 1px; margin-bottom: 2px; }
  .detail-name { font-size: 12px; font-weight: 900; line-height: 1.3; color: #000; }
  .detail-phone { font-size: 10px; color: #000; line-height: 1.3; margin-top: 1px; font-weight: 800; }
  .detail-address {
  font-size: 10px;
  color: #111;
  line-height: 1.3;
  margin-top: 1px;
  font-weight: 800;
}
  .cod-weight-line {
    text-align: center;
    padding: 2px 4px;
    border-bottom: 1px solid #ddd;
    background: #fff5f5;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 900;
    color: #111;
  }
  .cod-weight-line .cod-val { color: #dc2626; }
  .cod-weight-line .sep { margin: 0 3px; color: #ccc; }
  .codes-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  background: #fafafa;
  flex-shrink: 0;
  margin-top: auto;
  gap: 6px;
}
  .qr-box { 
  flex-shrink: 0;
  margin-top: 30px;
}
  .qr-box svg { width: 85px; height: 85px; }
  .parcel-id { 
  text-align: center; 
  font-size: 18px; 
  font-weight: 900; 
  color: #000; 
  letter-spacing: 3px; 
  margin-top: 4px;
  margin-bottom: 4px;
}
  .barcode-box { width: 90%; text-align: center; overflow: hidden; }
  .barcode-box svg { 
  max-width: 100%;
  height: 32px;
  margin-top: 6px;
}
  .label-footer {
    text-align: center;
    padding: 1.5px 4px;
    font-size: 8px;
    font-weight: 800;
    color: #444;
    background: #e8e8e8;
    letter-spacing: 0.3px;
    flex-shrink: 0;
    border-top: 1px solid #ddd;
  }
`;

function buildSingleLabelHtml(
  sale: SaleWithItems,
  companyName: string,
  companyPhone: string,
  companyAddress: string,
): string {
  const codAmount =
    sale.paidAmount === 0
      ? sale.totalPrice
      : sale.dueAmount > 0
        ? sale.dueAmount
        : sale.totalPrice;
  const trackingNumber = sale.consignmentId || "N/A";
  const hasSender = companyName || companyPhone || companyAddress;
  const weight = sale.totalWeight ?? 0;

  const qrSvg = sale.consignmentId
    ? renderToStaticMarkup(
        <QRCodeSVG value={sale.consignmentId} size={52} level="M" />,
      )
    : "";

  const barcodeSvg = sale.consignmentId
    ? generateBarcodeSvgString(sale.consignmentId, 28, 1.5)
    : "";

  return `
    <div class="label-card">
      <div class="label-header">
        <div class="label-header-left">Shipping Label &middot; #${sale.id}</div>
        <div class="label-header-right">${formatLabelDate(sale.createdAt)}</div>
      </div>
      <div class="tracking-row">
        <div class="tracking-label">Tracking Number</div>
        <div class="tracking-value">${escapeHtml(trackingNumber)}</div>
      </div>
      <div class="details-row">
        ${
          hasSender
            ? `
          <div class="detail-section">
            <div class="detail-title">From</div>
            ${companyName ? `<div class="detail-name">${escapeHtml(companyName)}</div>` : ""}
            ${companyPhone ? `<div class="detail-phone">${escapeHtml(companyPhone)}</div>` : ""}
            ${companyAddress ? `<div class="detail-address">${escapeHtml(companyAddress)}</div>` : ""}
          </div>
        `
            : ""
        }
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
      ${
        sale.consignmentId
          ? `
        <div class="codes-section">
          <div class="qr-box">${qrSvg}</div>
          <div class="parcel-id">${escapeHtml(sale.consignmentId || "")}</div>
          <div class="barcode-box">${barcodeSvg}</div>
        </div>
      `
          : ""
      }
      <div class="label-footer">Powered by CPS&S (Official FB Page)</div>
    </div>
  `;
}

interface BulkLabelPrintProps {
  sales: SaleWithItems[];
  onClose: () => void;
}

export default function BulkLabelPrint({
  sales,
  onClose,
}: BulkLabelPrintProps) {
  const triggered = useRef(false);

  const companyName = localStorage.getItem("label_company_name") || "";
  const companyPhone = localStorage.getItem("label_company_phone") || "";
  const companyAddress = localStorage.getItem("label_company_address") || "";

  useEffect(() => {
    if (triggered.current || sales.length === 0) return;
    triggered.current = true;

    const pages: string[] = [];
    for (let i = 0; i < sales.length; i += 9) {
      const chunk = sales.slice(i, i + 9);
      const labelsHtml = chunk
        .map((s) =>
          buildSingleLabelHtml(s, companyName, companyPhone, companyAddress),
        )
        .join("");
      pages.push(`<div class="page">${labelsHtml}</div>`);
    }

    const printWindow = window.open("", "_blank", "width=800,height=1100");
    if (!printWindow) {
      onClose();
      return;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Courier Labels - Bulk Print</title>
      <style>${BULK_PRINT_STYLES}</style>
    </head><body>${pages.join("")}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      onClose();
    }, 400);
  }, [sales, companyName, companyPhone, companyAddress, onClose]);

  return null;
}
