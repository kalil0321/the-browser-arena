/**
 * Instruction validation utility for basic input validation
 * 
 * This module provides basic validation functions for user instructions
 * before they are passed to LLM-powered browser automation agents.
 * Security is primarily handled through improved agent prompting.
 */

// Maximum instruction length (configurable via environment variable)
export const MAX_INSTRUCTION_LENGTH = parseInt(
    process.env.MAX_INSTRUCTION_LENGTH || "5000",
    10
);

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates an instruction for basic input validation
 * 
 * @param instruction - The user instruction to validate
 * @returns Validation result with isValid flag and optional error message
 */
export function validateInstruction(instruction: string): ValidationResult {
    // Check if instruction is provided
    if (!instruction || typeof instruction !== "string") {
        return {
            isValid: false,
            error: "Instruction is required and must be a string",
        };
    }

    // Check length
    if (instruction.length > MAX_INSTRUCTION_LENGTH) {
        return {
            isValid: false,
            error: `Instruction is too long. Maximum length is ${MAX_INSTRUCTION_LENGTH} characters.`,
        };
    }

    // Check for empty or whitespace-only instructions
    if (!instruction.trim()) {
        return {
            isValid: false,
            error: "Instruction cannot be empty",
        };
    }

    return {
        isValid: true,
    };
}

/**
 * Sanitizes an instruction by truncating if necessary
 * 
 * @param instruction - The instruction to sanitize
 * @returns Sanitized instruction
 */
export function sanitizeInstruction(instruction: string): string {
    if (!instruction || typeof instruction !== "string") {
        return "";
    }

    let sanitized = instruction;

    // Truncate if necessary
    if (sanitized.length > MAX_INSTRUCTION_LENGTH) {
        sanitized = sanitized.substring(0, MAX_INSTRUCTION_LENGTH);
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Logs a validation failure for monitoring
 * 
 * @param instruction - The invalid instruction
 * @param result - The validation result
 * @param userId - Optional user ID
 * @param context - Additional context (e.g., route name)
 */
export function logValidationFailure(
    instruction: string,
    result: ValidationResult,
    userId?: string,
    context?: string
): void {
    const logData = {
        timestamp: new Date().toISOString(),
        validationFailed: true,
        error: result.error,
        instructionLength: instruction.length,
        instructionPreview: instruction.substring(0, 100),
        userId: userId || "unknown",
        context: context || "unknown",
    };

    // Log to console (in production, this should go to a monitoring system)
    console.warn("[VALIDATION] Instruction validation failed:", JSON.stringify(logData));
}

