/**
 * Tilopay Payment Gateway Client
 *
 * Handles authentication and payment processing with Tilopay API.
 * Documentation: https://tilopay.com/documentacion
 */

const TILOPAY_BASE_URL = 'https://app.tilopay.com/api/v1';

interface TilopayConfig {
  apiUser: string;
  apiPassword: string;
  apiKey: string;
}

interface TilopayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TilopayPaymentRequest {
  redirect: string;
  key: string;
  amount: string;
  currency: string;
  orderNumber: string;
  capture: string;
  billToFirstName: string;
  billToLastName: string;
  billToAddress: string;
  billToAddress2: string;
  billToCity: string;
  billToState: string;
  billToZipPostCode: string;
  billToCountry: string;
  billToTelephone: string;
  billToEmail: string;
  shipToFirstName: string;
  shipToLastName: string;
  shipToAddress: string;
  shipToAddress2: string;
  shipToCity: string;
  shipToState: string;
  shipToZipPostCode: string;
  shipToCountry: string;
  shipToTelephone: string;
  subscription: string;
  platform: string;
  returnData?: string;
  hashVersion?: string;
}

interface TilopayPaymentResponse {
  url?: string;
  error?: string;
  message?: string;
}

interface TilopayConsultResponse {
  code?: number;
  description?: string;
  amount?: string;
  currency?: string;
  orderNumber?: string;
  auth?: string;
  status?: string;
}

// Payment callback query params from Tilopay redirect
export interface TilopayCallbackParams {
  code: string; // "1" = approved, anything else = rejected
  description: string;
  auth: string;
  order: string;
  tpt: string;
  crd: string;
  tilopaytransaction: string;
  OrderHash: string;
  returnData: string;
  form_update: string;
}

function getConfig(): TilopayConfig {
  const apiUser = process.env.TILOPAY_API_USER;
  const apiPassword = process.env.TILOPAY_API_PASSWORD;
  const apiKey = process.env.TILOPAY_API_KEY;

  if (!apiUser || !apiPassword || !apiKey) {
    throw new Error(
      'Tilopay credentials not configured. Set TILOPAY_API_USER, TILOPAY_API_PASSWORD, and TILOPAY_API_KEY environment variables.'
    );
  }

  return { apiUser, apiPassword, apiKey };
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get authentication token from Tilopay
 */
async function getToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const config = getConfig();

  const response = await fetch(`${TILOPAY_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiuser: config.apiUser,
      password: config.apiPassword,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Tilopay login failed:', errorText);
    throw new Error(`Tilopay authentication failed: ${response.status}`);
  }

  const data = (await response.json()) as TilopayTokenResponse;

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.token;
}

/**
 * Create a payment session and get the redirect URL
 */
export async function createPayment(params: {
  orderNumber: string;
  amount: number; // In dollars (e.g., 4.99)
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  redirectUrl: string;
  returnData?: string; // Base64 encoded data to receive back
}): Promise<{ url: string; orderNumber: string }> {
  const config = getConfig();
  const token = await getToken();

  const paymentRequest: TilopayPaymentRequest = {
    redirect: params.redirectUrl,
    key: config.apiKey,
    amount: params.amount.toFixed(2),
    currency: params.currency,
    orderNumber: params.orderNumber,
    capture: '1', // Capture immediately
    billToFirstName: params.firstName,
    billToLastName: params.lastName,
    billToAddress: 'N/A',
    billToAddress2: 'N/A',
    billToCity: 'N/A',
    billToState: 'N/A',
    billToZipPostCode: '00000',
    billToCountry: 'CR', // Default to Costa Rica
    billToTelephone: '00000000',
    billToEmail: params.email,
    shipToFirstName: params.firstName,
    shipToLastName: params.lastName,
    shipToAddress: 'N/A',
    shipToAddress2: 'N/A',
    shipToCity: 'N/A',
    shipToState: 'N/A',
    shipToZipPostCode: '00000',
    shipToCountry: 'CR',
    shipToTelephone: '00000000',
    subscription: '0', // Don't save card for now
    platform: 'BudgetCopilot',
    hashVersion: 'V2',
  };

  if (params.returnData) {
    paymentRequest.returnData = params.returnData;
  }

  const response = await fetch(`${TILOPAY_BASE_URL}/processPayment`, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Tilopay processPayment failed:', errorText);
    throw new Error(`Tilopay payment creation failed: ${response.status}`);
  }

  const data = (await response.json()) as TilopayPaymentResponse;

  if (!data.url) {
    console.error('Tilopay response missing URL:', data);
    throw new Error(
      data.error || data.message || 'Failed to get payment URL from Tilopay'
    );
  }

  return {
    url: data.url,
    orderNumber: params.orderNumber,
  };
}

/**
 * Consult transaction status
 */
export async function consultTransaction(
  orderNumber: string
): Promise<TilopayConsultResponse> {
  const config = getConfig();
  const token = await getToken();

  const response = await fetch(`${TILOPAY_BASE_URL}/consult`, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: config.apiKey,
      orderNumber,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Tilopay consult failed:', errorText);
    throw new Error(`Tilopay consult failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse callback params from Tilopay redirect URL
 */
export function parseCallbackParams(
  searchParams: URLSearchParams
): TilopayCallbackParams {
  return {
    code: searchParams.get('code') || '',
    description: searchParams.get('description') || '',
    auth: searchParams.get('auth') || '',
    order: searchParams.get('order') || '',
    tpt: searchParams.get('tpt') || '',
    crd: searchParams.get('crd') || '',
    tilopaytransaction: searchParams.get('tilopaytransaction') || '',
    OrderHash: searchParams.get('OrderHash') || '',
    returnData: searchParams.get('returnData') || '',
    form_update: searchParams.get('form_update') || '',
  };
}

/**
 * Check if payment was approved
 */
export function isPaymentApproved(params: TilopayCallbackParams): boolean {
  return params.code === '1';
}
