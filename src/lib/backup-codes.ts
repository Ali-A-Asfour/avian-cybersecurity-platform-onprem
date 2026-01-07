import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class BackupCodeService {
  private static readonly BACKUP_CODE_LENGTH = 8;
  private static readonly BACKUP_CODE_COUNT = 10;
  private static readonly SALT_ROUNDS = 12;

  /**
   * Generate backup codes for MFA recovery
   */
  static generateBackupCodes(): { codes: string[]; hashedCodes: string[] } {
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      const code = this.generateSingleCode();
      codes.push(code);
    }

    // Hash all codes for storage
    for (const code of codes) {
      const hashedCode = this.hashBackupCode(code);
      hashedCodes.push(hashedCode);
    }

    return { codes, hashedCodes };
  }

  /**
   * Generate a single backup code
   */
  private static generateSingleCode(): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    
    for (let i = 0; i < this.BACKUP_CODE_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Format as XXXX-XXXX for better readability
    return `${result.substring(0, 4)}-${result.substring(4, 8)}`;
  }

  /**
   * Hash a backup code for secure storage
   */
  private static hashBackupCode(code: string): string {
    // Remove formatting and convert to uppercase for consistency
    const cleanCode = code.replace('-', '').toUpperCase();
    return bcrypt.hashSync(cleanCode, this.SALT_ROUNDS);
  }

  /**
   * Verify a backup code against stored hashed codes
   */
  static async verifyBackupCode(
    inputCode: string, 
    hashedCodes: string[]
  ): Promise<{ isValid: boolean; usedCodeIndex?: number }> {
    // Clean and normalize input code
    const cleanInputCode = inputCode.replace('-', '').toUpperCase();

    for (let i = 0; i < hashedCodes.length; i++) {
      const hashedCode = hashedCodes[i];
      
      // Skip already used codes (marked as null or empty)
      if (!hashedCode) continue;

      const isMatch = await bcrypt.compare(cleanInputCode, hashedCode);
      if (isMatch) {
        return { isValid: true, usedCodeIndex: i };
      }
    }

    return { isValid: false };
  }

  /**
   * Mark a backup code as used by setting it to null
   */
  static markCodeAsUsed(hashedCodes: string[], usedIndex: number): string[] {
    const updatedCodes = [...hashedCodes];
    updatedCodes[usedIndex] = ''; // Mark as used
    return updatedCodes;
  }

  /**
   * Count remaining unused backup codes
   */
  static countRemainingCodes(hashedCodes: string[]): number {
    return hashedCodes.filter(code => code && code.length > 0).length;
  }

  /**
   * Check if user needs new backup codes (less than 3 remaining)
   */
  static needsNewBackupCodes(hashedCodes: string[]): boolean {
    return this.countRemainingCodes(hashedCodes) < 3;
  }

  /**
   * Validate backup code format
   */
  static isValidBackupCodeFormat(code: string): boolean {
    // Accept both XXXX-XXXX and XXXXXXXX formats
    const cleanCode = code.replace('-', '').toUpperCase();
    return /^[0-9A-Z]{8}$/.test(cleanCode);
  }
}