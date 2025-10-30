/**
 * API Key Management with Client-Side Encryption
 * 
 * Stores API keys in localStorage encrypted using Web Crypto API.
 * Keys are encrypted per-user using a key derived from user ID.
 */

const STORAGE_KEY_PREFIX = "encrypted_api_key_";

// Application salt for key derivation (this should be a constant secret)
// In production, this could be derived from an environment variable on build
const APP_SALT = "arena_smooth_byok_salt_v1";

/**
 * Derive an encryption key from the user ID
 */
async function deriveEncryptionKey(userId: string): Promise<CryptoKey> {
    // Ensure userId is a string
    const userIdStr = String(userId);

    // Combine user ID with app salt
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(userIdStr + APP_SALT),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    // Derive the encryption key
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: new TextEncoder().encode(APP_SALT),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypt an API key for storage
 */
export async function encryptApiKey(key: string, userId: string): Promise<string> {
    const encryptionKey = await deriveEncryptionKey(userId);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the key
    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        encryptionKey,
        new TextEncoder().encode(key)
    );

    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an API key from storage
 */
export async function decryptApiKey(encryptedKey: string, userId: string): Promise<string> {
    try {
        const encryptionKey = await deriveEncryptionKey(userId);

        // Decode from base64
        const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));

        // Extract IV (first 12 bytes) and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            encryptionKey,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        throw new Error("Failed to decrypt API key. It may have been encrypted with a different user ID.");
    }
}

/**
 * Mask an API key for display (e.g., "sk-...xxxx")
 */
export function maskApiKey(key: string): string {
    if (!key || key.length < 8) {
        return "••••••••";
    }

    const prefix = key.substring(0, 4);
    const suffix = key.substring(key.length - 4);
    return `${prefix}...${suffix}`;
}

/**
 * Get storage key for a provider
 */
function getStorageKey(provider: string): string {
    return `${STORAGE_KEY_PREFIX}${provider}`;
}

/**
 * Check if an API key exists for a provider (without decrypting)
 */
export function hasApiKey(provider: string): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    const storageKey = getStorageKey(provider);
    return localStorage.getItem(storageKey) !== null;
}

/**
 * Get and decrypt an API key from localStorage
 */
export async function getApiKey(provider: string, userId: string): Promise<string | null> {
    if (typeof window === "undefined") {
        return null;
    }

    const storageKey = getStorageKey(provider);
    const encryptedKey = localStorage.getItem(storageKey);

    if (!encryptedKey) {
        return null;
    }

    try {
        return await decryptApiKey(encryptedKey, userId);
    } catch (error) {
        console.error(`Failed to decrypt ${provider} API key:`, error);
        return null;
    }
}

/**
 * Encrypt and store an API key in localStorage
 */
export async function setApiKey(provider: string, apiKey: string, userId: string): Promise<void> {
    if (typeof window === "undefined") {
        throw new Error("localStorage is not available");
    }

    if (!apiKey || !apiKey.trim()) {
        throw new Error("API key cannot be empty");
    }

    const encryptedKey = await encryptApiKey(apiKey.trim(), userId);
    const storageKey = getStorageKey(provider);
    localStorage.setItem(storageKey, encryptedKey);
}

/**
 * Remove an API key from localStorage
 */
export function removeApiKey(provider: string): void {
    if (typeof window === "undefined") {
        return;
    }
    const storageKey = getStorageKey(provider);
    localStorage.removeItem(storageKey);
}

