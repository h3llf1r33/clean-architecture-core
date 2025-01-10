// Assuming your interface is named HTTPHeaders, not IHttpHeaders
export type HeaderRecord = Record<Extract<keyof IHttpHeaders, string>, string>;

export interface IHttpHeaders {
    // Authentication
    'WWW-Authenticate'?: string;
    'Authorization'?: string;
    'Proxy-Authenticate'?: string;
    'Proxy-Authorization'?: string;

    // Caching
    'Age'?: number;
    'Cache-Control'?: 'public' | 'private' | 'no-cache' | 'no-store' | 'must-revalidate' | 'proxy-revalidate' | 'max-age=' | 'max-stale=' | 's-maxage=' | string;
    'Clear-Site-Data'?: '"cache"' | '"cookies"' | '"storage"' | '"executionContexts"' | '"*"' | string;
    'Expires'?: string;
    'Pragma'?: 'no-cache' | string;
    'Warning'?: string;

    // Client Hints
    'Accept-CH'?: string;
    'Accept-CH-Lifetime'?: number;
    'Critical-CH'?: string;

    // Conditionals
    'Last-Modified'?: string;
    'ETag'?: string;
    'If-Match'?: string;
    'If-None-Match'?: string;
    'If-Modified-Since'?: string;
    'If-Unmodified-Since'?: string;
    'Vary'?: string;

    // Connection Management
    'Connection'?: 'keep-alive' | 'close';
    'Keep-Alive'?: string;

    // Content Negotiation
    'Accept'?: string;
    'Accept-Encoding'?: 'gzip' | 'compress' | 'deflate' | 'br' | 'identity' | '*' | string;
    'Accept-Language'?: string;
    'Accept-Charset'?: string;

    // Controls
    'Expect'?: '100-continue' | string;
    'Max-Forwards'?: number;

    // Cookies
    'Cookie'?: string;
    'Set-Cookie'?: string;

    // CORS
    'Access-Control-Allow-Origin'?: string;
    'Access-Control-Allow-Credentials'?: 'true' | 'false';
    'Access-Control-Allow-Headers'?: string;
    'Access-Control-Allow-Methods'?: string;
    'Access-Control-Expose-Headers'?: string;
    'Access-Control-Max-Age'?: number;
    'Access-Control-Request-Headers'?: string;
    'Access-Control-Request-Method'?: string;
    'Origin'?: string;
    'Timing-Allow-Origin'?: string;

    // Downloads
    'Content-Disposition'?: string;

    // Message Body Information
    'Content-Length'?: number;
    'Content-Type'?: string;
    'Content-Encoding'?: 'gzip' | 'compress' | 'deflate' | 'br' | 'identity' | string;
    'Content-Language'?: string;
    'Content-Location'?: string;
    'Content-Range'?: string;

    // Proxies
    'Forwarded'?: string;
    'Via'?: string;

    // Redirects
    'Location'?: string;
    'Refresh'?: string;

    // Request Context
    'From'?: string;
    'Host'?: string;
    'Referer'?: string;
    'Referrer-Policy'?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
    'User-Agent'?: string;

    // Response Context
    'Allow'?: string;
    'Server'?: string;

    // Security
    'Cross-Origin-Embedder-Policy'?: 'require-corp' | 'unsafe-none';
    'Cross-Origin-Opener-Policy'?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
    'Cross-Origin-Resource-Policy'?: 'same-site' | 'same-origin' | 'cross-origin';
    'Content-Security-Policy'?: string;
    'Content-Security-Policy-Report-Only'?: string;
    'Expect-CT'?: string;
    'Feature-Policy'?: string;
    'Strict-Transport-Security'?: string;
    'Upgrade-Insecure-Requests'?: '1';
    'X-Content-Type-Options'?: 'nosniff';
    'X-Download-Options'?: 'noopen';
    'X-Frame-Options'?: 'DENY' | 'SAMEORIGIN';
    'X-Permitted-Cross-Domain-Policies'?: 'none' | 'master-only' | 'by-content-type' | 'by-ftp-filename' | 'all';
    'X-Powered-By'?: string;
    'X-XSS-Protection'?: '0' | '1' | '1; mode=block' | '1; report=<reporting-uri>';

    // Transfer Coding
    'Transfer-Encoding'?: 'chunked' | 'compress' | 'deflate' | 'gzip' | 'identity';
    'TE'?: 'trailers' | 'compress' | 'deflate' | 'gzip' | 'trailers';

    // WebSockets
    'Sec-WebSocket-Accept'?: string;
    'Sec-WebSocket-Extensions'?: string;
    'Sec-WebSocket-Key'?: string;
    'Sec-WebSocket-Protocol'?: string;
    'Sec-WebSocket-Version'?: string;

    // Custom headers
    [key: string]: string | number | undefined;
}