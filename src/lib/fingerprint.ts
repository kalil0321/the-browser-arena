import { load } from "@fingerprintjs/fingerprintjs";

/**
 * Client-side fingerprinting utility
 */

// Singleton instance of FingerprintJS
let fpPromise: Promise<any> | null = null;

/**
 * Get or initialize FingerprintJS instance
 */
function getFpInstance() {
    if (!fpPromise) {
        fpPromise = load();
    }
    return fpPromise;
}

/**
 * Generate a client-side device fingerprint
 * This should be called from the browser
 */
export async function getClientFingerprint(): Promise<string> {
    const fp = await getFpInstance();
    const result = await fp.get();
    return result.visitorId;
}

/**
 * Server-side fingerprint generation
 * Combines IP address and User-Agent for additional verification
 */
export async function getServerFingerprint(ip: string, userAgent: string): Promise<string> {
    // Use the Web Crypto API to create a SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}-${userAgent}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex.slice(0, 16); // Take first 16 characters
}

/**
 * Create a hybrid fingerprint combining client and server fingerprints
 * Format: `${clientFingerprint}-${serverHash}`
 */
export async function createHybridFingerprint(
    clientFingerprint: string,
    ip: string,
    userAgent: string
): Promise<string> {
    const serverHash = await getServerFingerprint(ip, userAgent);
    return `${clientFingerprint}-${serverHash}`;
}

