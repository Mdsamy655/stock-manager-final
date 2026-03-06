import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";
import type { Product } from "@shared/schema";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateBarcodeSvgString(value: string, height: number = 30, width: number = 1.5): string {
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

interface PrintOptions {
  showBarcode: boolean;
  showProductCode: boolean;
  showProductName: boolean;
  showSalePrice: boolean;
  showShopName: boolean;
  shopName: string;
}

const LABEL_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: auto;
    margin: 5mm;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .labels-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
  }
  .label {
    width: 60mm;
    height: 40mm;
    border: 0.5px solid #ccc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2mm 3mm;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .shop-name {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #333;
    margin-bottom: 1.5mm;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .barcode-container {
    width: 90%;
    text-align: center;
    margin-bottom: 1.5mm;
  }
  .barcode-container svg {
    max-width: 100%;
    height: 18mm;
  }
  .product-code {
    font-size: 9px;
    font-weight: 700;
    color: #111;
    text-align: center;
    margin-bottom: 0.5mm;
    letter-spacing: 0.5px;
  }
  .product-name {
    font-size: 8px;
    font-weight: 600;
    color: #333;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.5mm;
  }
  .sale-price {
    font-size: 10px;
    font-weight: 800;
    color: #000;
    text-align: center;
  }
  @media print {
    body { margin: 0; }
    .label { border: 0.3px solid #eee; }
  }
`;

function buildLabelHtml(product: Product, options: PrintOptions): string {
  const parts: string[] = [];

  if (options.showShopName && options.shopName.trim()) {
    parts.push(`<div class="shop-name">${escapeHtml(options.shopName.trim())}</div>`);
  }

  if (options.showBarcode && product.productCode) {
    const barcodeSvg = generateBarcodeSvgString(product.productCode, 50, 1.5);
    if (barcodeSvg) {
      parts.push(`<div class="barcode-container">${barcodeSvg}</div>`);
    }
  }

  if (options.showProductCode && product.productCode) {
    parts.push(`<div class="product-code">${escapeHtml(product.productCode)}</div>`);
  }

  if (options.showProductName) {
    parts.push(`<div class="product-name">${escapeHtml(product.name)}</div>`);
  }

  if (options.showSalePrice) {
    parts.push(`<div class="sale-price">Price: ৳${product.salePrice.toLocaleString("en-BD")}</div>`);
  }

  return `<div class="label">${parts.join("")}</div>`;
}

function printLabels(products: Product[], options: PrintOptions) {
  const labelsHtml = products.map((p) => buildLabelHtml(p, options)).join("");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Product Barcode Labels</title>
<style>${LABEL_STYLES}</style></head>
<body><div class="labels-grid">${labelsHtml}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

interface ProductBarcodePrintDialogProps {
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductBarcodePrintDialog({ products, open, onOpenChange }: ProductBarcodePrintDialogProps) {
  const [options, setOptions] = useState<PrintOptions>({
    showBarcode: true,
    showProductCode: true,
    showProductName: true,
    showSalePrice: true,
    showShopName: false,
    shopName: "",
  });

  const handlePrint = () => {
    printLabels(products, options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Print Barcode Labels ({products.length} {products.length === 1 ? "product" : "products"})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showBarcode"
                checked={options.showBarcode}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, showBarcode: !!checked }))}
                data-testid="checkbox-show-barcode"
              />
              <Label htmlFor="showBarcode">Show Barcode</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showProductCode"
                checked={options.showProductCode}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, showProductCode: !!checked }))}
                data-testid="checkbox-show-product-code"
              />
              <Label htmlFor="showProductCode">Show Product Code</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showProductName"
                checked={options.showProductName}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, showProductName: !!checked }))}
                data-testid="checkbox-show-product-name"
              />
              <Label htmlFor="showProductName">Show Product Name</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showSalePrice"
                checked={options.showSalePrice}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, showSalePrice: !!checked }))}
                data-testid="checkbox-show-sale-price"
              />
              <Label htmlFor="showSalePrice">Show Sale Price</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showShopName"
                checked={options.showShopName}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, showShopName: !!checked }))}
                data-testid="checkbox-show-shop-name"
              />
              <Label htmlFor="showShopName">Show Shop Name / Brand Name</Label>
            </div>
            {options.showShopName && (
              <div className="pl-6">
                <Input
                  placeholder="Enter shop or brand name"
                  value={options.shopName}
                  onChange={(e) => setOptions((o) => ({ ...o, shopName: e.target.value }))}
                  data-testid="input-shop-name"
                />
              </div>
            )}
          </div>
          <Button onClick={handlePrint} className="w-full" data-testid="button-confirm-print-barcode">
            <Printer className="h-4 w-4 mr-2" />
            Print Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductBarcodePrintDialog;
