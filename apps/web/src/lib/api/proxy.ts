import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Proxy helper for forwarding requests to the Fastify API backend
 */

const API_BACKEND_URL =
  process.env.API_BACKEND_URL || 'http://localhost:4000';

/**
 * Proxy a request to the Fastify backend
 */
export async function proxyToApi(
  request: NextRequest,
  path: string,
  options?: {
    method?: string;
    body?: string;
  }
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Forward session cookie as Authorization header for Fastify
  if (sessionToken) {
    headers['Cookie'] = `session=${sessionToken}`;
  }

  // Forward idempotency key if present
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  // Get body: use explicit body if provided, otherwise read from request for POST/PATCH/PUT
  let body: string | undefined = options?.body;
  const method = options?.method || request.method;
  if (!body && ['POST', 'PATCH', 'PUT'].includes(method)) {
    try {
      body = await request.text();
    } catch {
      // No body or already consumed
    }
  }

  try {
    const response = await fetch(`${API_BACKEND_URL}${path}`, {
      method,
      headers,
      body,
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to connect to API backend',
        },
      },
      { status: 502 }
    );
  }
}
