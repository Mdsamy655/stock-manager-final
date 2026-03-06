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
    return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const BULK_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 0; }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 5mm 5mm;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 3mm;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .label-card {
    width: 100%;
    height: 100%;
    border: 1.5px solid #222;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .label-header {
    background: #111;
    color: #fff;
    padding: 2px 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .label-header-left { font-size: 5.5px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; }
  .label-header-right { font-size: 5.5px; opacity: 0.9; }
  .tracking-row {
    padding: 4px 6px 3px;
    text-align: center;
    border-bottom: 1.5px solid #222;
    background: #f8f8f8;
    flex-shrink: 0;
  }
  .tracking-label { font-size: 5px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 1px; font-weight: 600; }
  .tracking-value { font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #000; line-height: 1.1; }
  .details-row {
    display: flex;
    border-bottom: 1px solid #ddd;
    flex: 1;
    min-height: 0;
  }
  .detail-section {
    flex: 1;
    padding: 3px 6px;
    overflow: hidden;
  }
  .detail-section + .detail-section { border-left: 1px solid #ddd; }
  .detail-title { font-size: 5px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 0.8px; margin-bottom: 1px; }
  .detail-name { font-size: 8px; font-weight: 700; line-height: 1.2; color: #111; }
  .detail-info { font-size: 6.5px; color: #333; line-height: 1.3; margin-top: 1px; font-weight: 500; }
  .cod-weight-row {
    display: flex;
    border-bottom: 1px solid #ddd;
    flex-shrink: 0;
  }
  .cod-box {
    flex: 1;
    text-align: center;
    padding: 3px 6px;
    background: #fff5f5;
    border-right: 1px solid #ddd;
  }
  .cod-label { font-size: 5px; text-transform: uppercase; color: #888; letter-spacing: 0.8px; margin-bottom: 1px; font-weight: 600; }
  .cod-amount { font-size: 14px; font-weight: 900; color: #dc2626; }
  .weight-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
  }
  .weight-label { font-size: 5px; text-transform: uppercase; color: #888; letter-spacing: 0.8px; margin-bottom: 1px; font-weight: 600; }
  .weight-value { font-size: 10px; font-weight: 700; color: #333; }
  .codes-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 3px 6px;
    border-bottom: 1px solid #eee;
    background: #fafafa;
    flex-shrink: 0;
  }
  .qr-box { flex-shrink: 0; }
  .qr-box svg { width: 36px; height: 36px; }
  .barcode-box { flex: 1; text-align: center; overflow: hidden; }
  .barcode-box svg { max-width: 100%; height: 28px; }
  .label-footer {
    text-align: center;
    padding: 2px 6px;
    font-size: 5px;
    color: #999;
    background: #f5f5f5;
    letter-spacing: 0.3px;
    flex-shrink: 0;
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
        <QRCodeSVG value={sale.consignmentId} size={36} level="M" />,
      )
    : "";

  const barcodeSvg = sale.consignmentId
    ? generateBarcodeSvgString(sale.consignmentId)
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
            ${companyPhone ? `<div class="detail-info">${escapeHtml(companyPhone)}</div>` : ""}
            ${companyAddress ? `<div class="detail-info">${escapeHtml(companyAddress)}</div>` : ""}
          </div>
        `
            : ""
        }
        <div class="detail-section">
          <div class="detail-title">To</div>
          <div class="detail-name">${escapeHtml(sale.customerName || "N/A")}</div>
          <div class="detail-info">${escapeHtml(sale.customerPhone || "")}</div>
          <div class="detail-info">${escapeHtml(sale.customerAddress || "")}</div>
        </div>
      </div>
      <div class="cod-weight-row">
        <div class="cod-box">
          <div class="cod-label">COD Amount</div>
          <div class="cod-amount">${formatTaka(codAmount)}</div>
        </div>
        <div class="weight-box">
          <div class="weight-label">Weight</div>
          <div class="weight-value">${weight > 0 ? `${weight.toFixed(2)} KG` : "—"}</div>
        </div>
      </div>
      ${sale.consignmentId ? `
        <div class="codes-row">
          <div class="qr-box">${qrSvg}</div>
          <div class="barcode-box">${barcodeSvg}</div>
        </div>
      ` : ""}
      <div class="label-footer">Powered by CPSBD Business (FB Page)</div>
    </div>
  `;
}

interface BulkLabelPrintProps {
  sales: SaleWithItems[];
  onClose: () => void;
}

export default function BulkLabelPrint({ sales, onClose }: BulkLabelPrintProps) {
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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Courier Labels - Bulk Print</title>
        <style>${BULK_PRINT_STYLES}</style>
      </head>
      <body>${pages.join("")}</body>
      </html>
    `);
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
