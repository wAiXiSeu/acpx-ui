const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const currentPort = window.location.port;
    const backendPort = currentPort === '3000' ? '3001' : '3001';
    return `${protocol}//${host}:${backendPort}`;
  }
  return "http://localhost:3001";
};

const API_URL = getApiUrl();

export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function handleResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: string | undefined;

    try {
      const data = await response.json();
      if (data.message) {
        errorMessage = data.message;
      }
      if (data.code) {
        errorCode = data.code;
      }
    } catch {
      // If response is not JSON, use default error message
    }

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    return (await handleResponse(response)) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, data?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  del: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: "DELETE" }),
};