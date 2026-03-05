import { useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SaleWithItems } from "@shared/schema";

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
  padding: 6mm;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6mm;
  page-break-after: always;
}
  .page:last-child { page-break-after: auto; break-after: auto; }
  .label-card {
  width: 70mm;
  height: 95mm;
  border: 1.5px solid #333;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
  .label-header {
    background: #1a1a1a;
    color: #fff;
    padding: 3px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .label-header-left { font-size: 7px; opacity: 0.85; }
  .label-header-right { font-size: 7px; opacity: 0.85; text-align: right; }
  .parcel-id-row {
    padding: 5px 10px;
    text-align: center;
    border-bottom: 1px solid #ccc;
    background: #f5f5f5;
    flex-shrink: 0;
  }
  .parcel-id-label { font-size: 6.5px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 1px; }
  .parcel-id-value { font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #000; line-height: 1.1; }
  .body-row {
    display: flex;
    border-bottom: 1px solid #ddd;
    flex: 1;
    min-height: 0;
  }
  .body-section {
    flex: 1;
    padding: 4px 10px;
    overflow: hidden;
  }
  .body-section + .body-section { border-left: 1px solid #ddd; }
  .section-title { font-size: 6px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 0.8px; margin-bottom: 1px; }
  .section-name { font-size: 9.5px; font-weight: 600; line-height: 1.2; }
  .section-detail { font-size: 8px; color: #444; line-height: 1.3; margin-top: 1px; }
  .cod-qr-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #ddd;
    flex-shrink: 0;
  }
  .cod-section {
    flex: 1;
    text-align: center;
    padding: 4px 10px;
  }
  .cod-label { font-size: 6.5px; text-transform: uppercase; color: #888; letter-spacing: 0.8px; margin-bottom: 1px; }
  .cod-value { font-size: 16px; font-weight: 800; color: #dc2626; }
  .qr-section {
    padding: 3px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid #ddd;
  }
  .footer-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 10px;
    font-size: 6.5px;
    color: #777;
    background: #fafafa;
    flex-shrink: 0;
  }
  .footer-row strong { color: #333; }
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
  const parcelId = sale.consignmentId || "N/A";
  const hasSender = companyName || companyPhone || companyAddress;

  const qrSvg = sale.consignmentId
    ? renderToStaticMarkup(
        <QRCodeSVG value={sale.consignmentId} size={44} level="M" />,
      )
    : "";

  return `
    <div class="label-card">
      <div class="label-header">
        <div class="label-header-left">COURIER LABEL &middot; Sale #${sale.id}</div>
        <div class="label-header-right">${formatLabelDate(sale.createdAt)}</div>
      </div>
      <div class="parcel-id-row">
        <div class="parcel-id-label">Parcel ID / Consignment</div>
        <div class="parcel-id-value">${parcelId}</div>
      </div>
      <div class="body-row">
        ${
          hasSender
            ? `
          <div class="body-section">
            <div class="section-title">From / Sender</div>
            ${companyName ? `<div class="section-name">${companyName}</div>` : ""}
            ${companyPhone ? `<div class="section-detail">${companyPhone}</div>` : ""}
            ${companyAddress ? `<div class="section-detail">${companyAddress}</div>` : ""}
          </div>
        `
            : ""
        }
        <div class="body-section">
          <div class="section-title">To / Recipient</div>
          <div class="section-name">${sale.customerName || "N/A"}</div>
          <div class="section-detail">${sale.customerPhone || ""}</div>
          <div class="section-detail">${sale.customerAddress || ""}</div>
        </div>
      </div>
      <div class="cod-qr-row">
        <div class="cod-section">
          <div class="cod-label">COD Amount</div>
          <div class="cod-value">${formatTaka(codAmount)}</div>
        </div>
        ${qrSvg ? `<div class="qr-section">${qrSvg}</div>` : ""}
      </div>
      <div class="footer-row">
        <span>Consignment: <strong>${parcelId}</strong></span>
        <span>Items: <strong>${sale.items.length}</strong></span>
        ${(sale.totalWeight ?? 0) > 0 ? `<span>Weight: <strong>${(sale.totalWeight ?? 0).toFixed(2)} KG</strong></span>` : ""}
      </div>
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
