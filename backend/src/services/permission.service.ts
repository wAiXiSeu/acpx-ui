import { randomUUID } from 'node:crypto';
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

export interface PendingPermissionRequest {
  requestId: string;
  params: RequestPermissionRequest;
  resolve: (response: RequestPermissionResponse) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
  createdAt: Date;
}

export interface PermissionRequestEvent {
  type: 'permission_request';
  requestId: string;
  params: RequestPermissionRequest;
}

export interface PermissionResponseEvent {
  type: 'permission_response';
  requestId: string;
  response: RequestPermissionResponse;
}

export type PermissionEvent = PermissionRequestEvent | PermissionResponseEvent;

const PERMISSION_TIMEOUT_MS = 120_000;

export class PermissionManager {
  private static instance: PermissionManager | null = null;
  private pendingRequests: Map<string, PendingPermissionRequest> = new Map();
  private eventHandler?: (event: PermissionEvent) => void;

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  setEventHandler(handler: (event: PermissionEvent) => void): void {
    this.eventHandler = handler;
  }

  clearEventHandler(): void {
    this.eventHandler = undefined;
  }

  createPermissionCallback(): (params: RequestPermissionRequest) => Promise<RequestPermissionResponse> {
    return async (params: RequestPermissionRequest): Promise<RequestPermissionResponse> => {
      return await this.requestPermission(params);
    };
  }

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const requestId = randomUUID();
    const abortController = new AbortController();

    const pending: PendingPermissionRequest = {
      requestId,
      params,
      resolve: undefined as unknown as (response: RequestPermissionResponse) => void,
      reject: undefined as unknown as (error: Error) => void,
      abortController,
      createdAt: new Date(),
    };

    const promise = new Promise<RequestPermissionResponse>((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });

    this.pendingRequests.set(requestId, pending);

    this.eventHandler?.({
      type: 'permission_request',
      requestId,
      params,
    });

    const timeoutId = setTimeout(() => {
      this.handleTimeout(requestId);
    }, PERMISSION_TIMEOUT_MS);

    abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });

    try {
      const response = await promise;
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  respondToPermission(requestId: string, response: RequestPermissionResponse): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return false;
    }

    pending.abortController.abort();
    this.pendingRequests.delete(requestId);
    pending.resolve(response);

    this.eventHandler?.({
      type: 'permission_response',
      requestId,
      response,
    });

    return true;
  }

  private handleTimeout(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(requestId);

    const denyResponse: RequestPermissionResponse = {
      outcome: {
        outcome: 'cancelled',
      },
    };

    pending.resolve(denyResponse);

    this.eventHandler?.({
      type: 'permission_response',
      requestId,
      response: denyResponse,
    });
  }

  cancelAllPending(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      pending.abortController.abort();
      this.pendingRequests.delete(requestId);

      const cancelResponse: RequestPermissionResponse = {
        outcome: {
          outcome: 'cancelled',
        },
      };

      pending.resolve(cancelResponse);
    }
  }

  getPendingRequests(): PendingPermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  hasPendingRequest(requestId: string): boolean {
    return this.pendingRequests.has(requestId);
  }
}

export const permissionManager = PermissionManager.getInstance();