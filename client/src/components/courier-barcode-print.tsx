import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateBarcodeSvgString(value: string, height: number = 40, width: number = 1.8): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      displayValue: false,
      height,
      width,
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}

const LABEL_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: 50mm 30mm;
    margin: 0;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    margin: 0;
  }
  .label {
    width: 50mm;
    height: 30mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 1.5mm 2mm;
    overflow: hidden;
    page-break-after: always;
  }
  .top-text {
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #333;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .consignment-id {
    font-size: 20px;
    font-weight: bold;
    color: #111;
    text-align: center;
    letter-spacing: 2px;
  }
  .barcode-section {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }
  .barcode-section svg {
    max-width: 100%;
    height: 14mm;
  }
`;

function buildLabelHtml(consignmentId: string, topText: string): string {
  const parts: string[] = [];

  if (topText.trim()) {
    parts.push(`<div class="top-text">${escapeHtml(topText.trim())}</div>`);
  }

  parts.push(`<div class="consignment-id">${escapeHtml(consignmentId)}</div>`);

  const barcodeSvg = generateBarcodeSvgString(consignmentId, 40, 1.8);
  if (barcodeSvg) {
    parts.push(`<div class="barcode-section">${barcodeSvg}</div>`);
  }

  return `<div class="label">${parts.join("")}</div>`;
}

function printCourierBarcodeLabels(
  consignmentIds: string[],
  topText: string,
  quantity: number
) {
  const labelsHtml: string[] = [];
  for (const cid of consignmentIds) {
    const labelHtml = buildLabelHtml(cid, topText);
    for (let i = 0; i < quantity; i++) {
      labelsHtml.push(labelHtml);
    }
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Courier Barcode Labels</title>
<style>${LABEL_STYLES}</style></head>
<body>${labelsHtml.join("")}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

interface CourierBarcodePrintDialogProps {
  consignmentIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourierBarcodePrintDialog({
  consignmentIds,
  open,
  onOpenChange,
}: CourierBarcodePrintDialogProps) {
  const [topText, setTopText] = useState("");
  const [printQuantity, setPrintQuantity] = useState(1);

  const handlePrint = () => {
    printCourierBarcodeLabels(consignmentIds, topText, Math.max(1, printQuantity));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Courier Barcode Label Printing ({consignmentIds.length}{" "}
            {consignmentIds.length === 1 ? "order" : "orders"})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="top-text" className="text-sm">
              Top Text (Optional)
            </Label>
            <Input
              id="top-text"
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="Company Name / Merchant ID / Customer Name"
              data-testid="input-courier-barcode-top-text"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="courier-print-quantity" className="text-sm">
              Print Quantity (per order)
            </Label>
            <Input
              id="courier-print-quantity"
              type="number"
              min="1"
              value={printQuantity}
              onChange={(e) =>
                setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-32"
              data-testid="input-courier-barcode-quantity"
            />
            <p className="text-xs text-muted-foreground">
              Each label prints on a separate 50×30mm page
            </p>
          </div>

          {consignmentIds.length > 0 && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                Consignment IDs:
              </p>
              {consignmentIds.map((cid) => (
                <p key={cid} className="font-mono text-xs" data-testid={`text-courier-cid-${cid}`}>
                  {cid}
                </p>
              ))}
            </div>
          )}

          <Button
            onClick={handlePrint}
            className="w-full"
            disabled={consignmentIds.length === 0}
            data-testid="button-confirm-courier-barcode-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CourierBarcodePrintDialog;
