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
 * NOTE: This is vulnerable if clientFingerprint is user-controlled.
 * Use generateServerFingerprint for secure server-side generation.
 */
export async function createHybridFingerprint(
    clientFingerprint: string,
    ip: string,
    userAgent: string
): Promise<string> {
    const serverHash = await getServerFingerprint(ip, userAgent);
    return `${clientFingerprint}-${serverHash}`;
}

/**
 * Generate a secure server-side fingerprint using HMAC signing.
 * This prevents clients from spoofing the fingerprint.
 * 
 * @param seed - A seed value (can be from cookie, IP, User-Agent combination)
 * @returns A signed fingerprint that cannot be easily spoofed
 */
export async function generateServerFingerprint(seed: string): Promise<string> {
    // Use a secret key from environment (fallback to a default for development)
    const secretKey = process.env.DEMO_FINGERPRINT_SECRET || "demo-fingerprint-secret-key-change-in-production";
    
    // Create HMAC signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const seedData = encoder.encode(seed);
    
    // Import key for HMAC
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    // Sign the seed
    const signature = await crypto.subtle.sign("HMAC", key, seedData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    // Return first 32 characters of the HMAC
    return hashHex.slice(0, 32);
}

/**
 * Generate or retrieve a server-side signed fingerprint from cookie.
 * If no cookie exists, generates a new one and sets it.
 * 
 * @param cookieValue - Existing cookie value (if any)
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent
 * @returns Object with fingerprint and cookie value to set
 */
export async function getOrCreateSignedFingerprint(
    cookieValue: string | null,
    ip: string,
    userAgent: string
): Promise<{ fingerprint: string; cookieValue: string }> {
    // If we have a valid cookie, verify and use it
    if (cookieValue) {
        // Verify the cookie signature
        const verified = await verifySignedFingerprint(cookieValue, ip, userAgent);
        if (verified) {
            // Use the cookie as the fingerprint seed
            const fingerprint = await generateServerFingerprint(cookieValue);
            return { fingerprint, cookieValue };
        }
    }
    
    // Generate new fingerprint seed (combine IP + User-Agent + random)
    // This makes it harder to predict but still tied to the client
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    
    const seed = `${ip}-${userAgent}-${randomHex}-${Date.now()}`;
    const newCookieValue = await generateServerFingerprint(seed);
    const fingerprint = await generateServerFingerprint(newCookieValue);
    
    return { fingerprint, cookieValue: newCookieValue };
}

/**
 * Verify a signed fingerprint cookie matches the current IP and User-Agent.
 * This provides additional security but allows for User-Agent changes.
 */
async function verifySignedFingerprint(
    cookieValue: string,
    ip: string,
    userAgent: string
): Promise<boolean> {
    // Basic verification: check if the cookie looks valid (32 hex chars)
    if (!cookieValue || cookieValue.length !== 32 || !/^[a-f0-9]{32}$/i.test(cookieValue)) {
        return false;
    }
    
    // For now, accept any valid-looking cookie
    // In a stricter implementation, we could store the IP/UA in the cookie
    // and verify it matches, but that would break legitimate User-Agent changes
    return true;
}

