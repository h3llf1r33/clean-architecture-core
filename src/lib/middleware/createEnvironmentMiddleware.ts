import {Observable, of} from "rxjs";
import type {EnvironmentVariable} from "../common/Aliases";
import { IHttpHeaders } from '../interfaces/IHttpHeaders';
import { HttpClientRequestOptions } from "../common/Http";

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}


export const createEnvironmentMiddleware = (
    headerMappings: { [K in keyof IHttpHeaders]: EnvironmentVariable },
    httpRequestOptions: HttpClientRequestOptions
  ): Observable<HttpClientRequestOptions> => {
  let secretCache: Record<string, string> | null = null;
  let lastFetchTime: number = 0;
  const CACHE_TTL = 1000 * 60 * 5;

  const getSecrets = (): Record<string, string> => {
    const now = Date.now();
    
    if (secretCache && (now - lastFetchTime < CACHE_TTL)) {
      return secretCache;
    }

    const secrets: Record<string, string> = {};
    
    const envVars = Array.from(new Set(Object.values(headerMappings)));
    
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (!value) {
        throw new EnvironmentError(`Environment variable ${envVar} not found`);
      }
      secrets[envVar] = value;
    }

    secretCache = secrets;
    lastFetchTime = now;
    
    return secrets;
  };

  const setHeaders = (headers?: Record<string, string>): HttpClientRequestOptions => {
    try {
      const secrets = getSecrets();
      const updatedHeaders = { ...headers };

      for (const [headerName, envVar] of Object.entries(headerMappings)) {
        if (secrets[envVar]) {
          updatedHeaders[headerName] = secrets[envVar];
        }
      }
      httpRequestOptions.headers = {... httpRequestOptions.headers, ...updatedHeaders}
      return httpRequestOptions;
    } catch (error) {
      if (error instanceof EnvironmentError) {
        throw error;
      }
      throw new EnvironmentError('Failed to process secrets for headers');
    }
  };

  return of(setHeaders());
};