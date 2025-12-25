/**
 * Help Desk File Upload Handler
 * 
 * Handles file uploads with comprehensive validation, error handling,
 * and retry mechanisms for help desk ticket attachments.
 */

import { HelpDeskValidator, HelpDeskErrors, HelpDeskRetryManager } from './error-handling';

export interface FileUploadConfig {
    maxFileSize: number; // in bytes
    maxAttachments: number;
    allowedMimeTypes: string[];
    uploadPath: string;
    retryAttempts: number;
}

export interface UploadedFile {
    id: string;
    filename: string;
    originalFilename: string;
    size: number;
    mimeType: string;
    path: string;
    uploadedAt: Date;
    uploadedBy: string;
}

export interface FileUploadResult {
    success: boolean;
    file?: UploadedFile;
    error?: string;
    validationErrors?: string[];
}

/**
 * File upload handler with validation and error recovery
 */
export class HelpDeskFileUploadHandler {
    private static readonly DEFAULT_CONFIG: FileUploadConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxAttachments: 5,
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        uploadPath: '/uploads/help-desk',
        retryAttempts: 3,
    };

    /**
     * Upload file with comprehensive validation and error handling
     */
    static async uploadFile(
        file: File,
        ticketId: string,
        uploadedBy: string,
        existingAttachments: number = 0,
        config: Partial<FileUploadConfig> = {}
    ): Promise<FileUploadResult> {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

        try {
            // Step 1: Validate file
            const validationResult = this.validateFile(file, existingAttachments, finalConfig);
            if (!validationResult.valid) {
                return {
                    success: false,
                    validationErrors: validationResult.errors,
                };
            }

            // Step 2: Generate unique filename
            const filename = this.generateUniqueFilename(file.name);
            const filePath = `${finalConfig.uploadPath}/${ticketId}/${filename}`;

            // Step 3: Upload file with retry mechanism
            const uploadResult = await HelpDeskRetryManager.executeWithRetry(
                () => this.performFileUpload(file, filePath),
                {
                    maxRetries: finalConfig.retryAttempts,
                    shouldRetry: (error) => this.shouldRetryUpload(error),
                    onRetry: (attempt, error) => {
                        console.warn(`File upload retry attempt ${attempt} for ${filename}:`, error.message);
                    },
                }
            );

            // Step 4: Create file record
            const uploadedFile: UploadedFile = {
                id: this.generateFileId(),
                filename,
                originalFilename: file.name,
                size: file.size,
                mimeType: file.type,
                path: filePath,
                uploadedAt: new Date(),
                uploadedBy,
            };

            return {
                success: true,
                file: uploadedFile,
            };

        } catch (error) {
            console.error('File upload failed:', error);

            return {
                success: false,
                error: this.getUploadErrorMessage(error),
            };
        }
    }

    /**
     * Validate file before upload
     */
    private static validateFile(
        file: File,
        existingAttachments: number,
        config: FileUploadConfig
    ): { valid: boolean; errors?: string[] } {
        const errors: string[] = [];

        // Check file size
        if (file.size > config.maxFileSize) {
            errors.push(`File size exceeds maximum limit of ${this.formatFileSize(config.maxFileSize)}`);
        }

        // Check file type
        if (!config.allowedMimeTypes.includes(file.type)) {
            errors.push('File type not allowed. Supported types: images, PDF, text, and Word documents');
        }

        // Check attachment limit
        if (existingAttachments >= config.maxAttachments) {
            errors.push(`Maximum of ${config.maxAttachments} attachments allowed per ticket`);
        }

        // Check filename
        if (!file.name || file.name.trim().length === 0) {
            errors.push('File must have a valid filename');
        }

        // Check for potentially dangerous filenames
        if (this.isDangerousFilename(file.name)) {
            errors.push('Filename contains invalid characters or patterns');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * Perform the actual file upload
     */
    private static async performFileUpload(file: File, filePath: string): Promise<void> {
        // In a real implementation, this would upload to cloud storage (S3, etc.)
        // For now, we'll simulate the upload process

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', filePath);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Upload failed with status ${response.status}`);
        }
    }

    /**
     * Generate unique filename to prevent conflicts
     */
    private static generateUniqueFilename(originalFilename: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = originalFilename.split('.').pop() || '';
        const nameWithoutExtension = originalFilename.replace(/\.[^/.]+$/, '');

        // Sanitize filename
        const sanitizedName = nameWithoutExtension
            .replace(/[^a-zA-Z0-9\-_]/g, '_')
            .substring(0, 50); // Limit length

        return `${sanitizedName}_${timestamp}_${random}.${extension}`;
    }

    /**
     * Generate unique file ID
     */
    private static generateFileId(): string {
        return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Check if filename is potentially dangerous
     */
    private static isDangerousFilename(filename: string): boolean {
        const dangerousPatterns = [
            /\.\./,           // Directory traversal
            /[<>:"|?*]/,      // Invalid filename characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
            /^\./,            // Hidden files
            /\.(exe|bat|cmd|scr|pif|com)$/i, // Executable files
        ];

        return dangerousPatterns.some(pattern => pattern.test(filename));
    }

    /**
     * Determine if upload error should trigger retry
     */
    private static shouldRetryUpload(error: any): boolean {
        // Retry on network errors and server errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return true;
        }

        // Retry on HTTP 5xx errors but not 4xx errors
        if (error.status >= 500) {
            return true;
        }

        // Don't retry on client errors (validation, file too large, etc.)
        if (error.status >= 400 && error.status < 500) {
            return false;
        }

        return false;
    }

    /**
     * Get user-friendly error message for upload failures
     */
    private static getUploadErrorMessage(error: any): string {
        if (error.message?.includes('File size')) {
            return 'The file you are trying to upload is too large.';
        }

        if (error.message?.includes('File type')) {
            return 'The file type you are trying to upload is not supported.';
        }

        if (error.message?.includes('Network')) {
            return 'Upload failed due to network issues. Please check your connection and try again.';
        }

        if (error.status === 413) {
            return 'The file is too large to upload.';
        }

        if (error.status === 415) {
            return 'The file type is not supported.';
        }

        if (error.status >= 500) {
            return 'Upload failed due to server error. Please try again in a few moments.';
        }

        return 'File upload failed. Please try again.';
    }

    /**
     * Format file size for display
     */
    private static formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Delete uploaded file (cleanup on error)
     */
    static async deleteFile(filePath: string): Promise<void> {
        try {
            await fetch('/api/upload', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath }),
            });
        } catch (error) {
            console.error('Failed to delete file:', error);
            // Don't throw error - this is cleanup
        }
    }

    /**
     * Validate multiple files for batch upload
     */
    static validateMultipleFiles(
        files: File[],
        existingAttachments: number = 0,
        config: Partial<FileUploadConfig> = {}
    ): { valid: boolean; errors?: string[]; validFiles?: File[] } {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
        const errors: string[] = [];
        const validFiles: File[] = [];

        // Check total attachment limit
        if (existingAttachments + files.length > finalConfig.maxAttachments) {
            errors.push(`Cannot upload ${files.length} files. Maximum of ${finalConfig.maxAttachments} attachments allowed per ticket`);
            return { valid: false, errors };
        }

        // Validate each file
        files.forEach((file, index) => {
            const validation = this.validateFile(file, existingAttachments + index, finalConfig);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(`File "${file.name}": ${validation.errors?.join(', ')}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            validFiles: validFiles.length > 0 ? validFiles : undefined,
        };
    }

    /**
     * Get file upload progress (for future implementation)
     */
    static createUploadProgressTracker(): {
        onProgress: (callback: (progress: number) => void) => void;
        abort: () => void;
    } {
        let progressCallback: ((progress: number) => void) | null = null;
        let abortController: AbortController | null = null;

        return {
            onProgress: (callback: (progress: number) => void) => {
                progressCallback = callback;
            },
            abort: () => {
                if (abortController) {
                    abortController.abort();
                }
            },
        };
    }
}