export interface BoardRequestOptions {
  protocol: 'https' | 'http';
  ip: string;
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  contentType?: string;
  timeoutMs?: number;
}

export interface BoardResponseData {
  url: string;
  method: string;
  status: number;
  statusText: string;
  data: any;
  durationMs: number;
  rawText?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Send HTTP or HTTPS request to the connected board at its IP address.
 */
export async function sendBoardRequest(
  options: BoardRequestOptions,
): Promise<BoardResponseData> {
  const {
    protocol,
    ip,
    path,
    method,
    body,
    contentType = 'application/json',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const cleanIp = ip.trim();
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;
  const url = `${protocol}://${cleanIp}${cleanPath}`;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: '*/*',
    };

    if (body && method !== 'GET') {
      headers['Content-Type'] = contentType;
    }

    const fetchOptions: RequestInit = {
      method,
      signal: controller.signal,
      headers,
      ...(body && method !== 'GET' ? { body } : {}),
    };

    const res = await fetch(url, fetchOptions);
    const durationMs = Date.now() - startTime;

    const rawText = await res.text();
    let responseData: any;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = rawText;
    }

    return {
      url,
      method,
      status: res.status,
      statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
      data: responseData,
      rawText,
      durationMs,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request to ${url} timed out after ${timeoutMs / 1000}s. Make sure you are connected to the board.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send "hi" message to the board at its IP address.
 */
export async function sendHiMessageToBoard(
  boardIp: string,
  protocol: 'https' | 'http' = 'http',
  endpoint: string = '/',
  mode: 'json' | 'text' | 'get' = 'text',
): Promise<BoardResponseData> {
  if (mode === 'get') {
    const separator = endpoint.includes('?') ? '&' : '?';
    return await sendBoardRequest({
      protocol,
      ip: boardIp,
      path: `${endpoint}${separator}msg=hi`,
      method: 'GET',
    });
  }

  if (mode === 'json') {
    return await sendBoardRequest({
      protocol,
      ip: boardIp,
      path: endpoint,
      method: 'POST',
      body: JSON.stringify({ message: 'hi' }),
      contentType: 'application/json',
    });
  }

  // Plain text "hi"
  return await sendBoardRequest({
    protocol,
    ip: boardIp,
    path: endpoint,
    method: 'POST',
    body: 'hi',
    contentType: 'text/plain',
  });
}