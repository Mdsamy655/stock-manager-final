interface SteadfastConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

interface SteadfastSale {
  id: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalPrice: number;
}

export interface CreateOrderResult {
  consignment_id: string;
  tracking_code: string;
}

export async function createSteadfastOrder(
  config: SteadfastConfig,
  sale: SteadfastSale,
): Promise<CreateOrderResult> {
  const url = `${config.baseUrl}/create_order`;

  const body = {
    invoice: `INV-${sale.id}`,
    recipient_name: String(sale.customerName || "").trim(),
    recipient_phone: String(sale.customerPhone || "").trim(),
    recipient_address: String(sale.customerAddress || "").trim(),
    cod_amount: Number(sale.totalPrice),
    note: `Order #${sale.id}`,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": config.apiKey,
      "Secret-Key": config.secretKey,
    },
    body: JSON.stringify(body),
  });

  const data: any = await response.json();

  if (!response.ok || data.status != 200) {
    console.log("Steadfast Create Order Full Response:", data);

    const errorMessage =
      typeof data === "string" ? data : data?.message || JSON.stringify(data);

    throw new Error(errorMessage);
  }

  const consignmentId = data.consignment?.consignment_id || data.consignment_id;
  if (!consignmentId) {
    throw new Error(
      "Steadfast API returned success but no consignment ID was found in the response",
    );
  }

  const trackingCode = data.consignment?.tracking_code || data.tracking_code || "";

  return { consignment_id: String(consignmentId), tracking_code: String(trackingCode) };
}

export interface StatusResult {
  delivery_status: string;
}

export async function checkSteadfastStatus(
  config: SteadfastConfig,
  consignmentId: string,
) {
  const url = `${config.baseUrl}/status_by_cid/${consignmentId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Api-Key": config.apiKey,
      "Secret-Key": config.secretKey,
    },
  });

  const data = await response.json();
  return data;
}
