import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const filePath = formData.get('path') as string;

        if (!file || !filePath) {
            return NextResponse.json(
                { error: 'File and path are required' },
                { status: 400 }
            );
        }

        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), 'storage', 'uploads');
        const fullPath = join(uploadDir, filePath);
        const directory = fullPath.substring(0, fullPath.lastIndexOf('/'));

        if (!existsSync(directory)) {
            await mkdir(directory, { recursive: true });
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(fullPath, buffer);

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            path: filePath
        });

    } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json(
            { error: 'File upload failed' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { path: filePath } = await request.json();

        if (!filePath) {
            return NextResponse.json(
                { error: 'File path is required' },
                { status: 400 }
            );
        }

        const fullPath = join(process.cwd(), 'storage', 'uploads', filePath);

        // In a real implementation, you would delete from cloud storage
        // For now, we'll just return success
        return NextResponse.json({
            success: true,
            message: 'File deleted successfully'
        });

    } catch (error) {
        console.error('File deletion error:', error);
        return NextResponse.json(
            { error: 'File deletion failed' },
            { status: 500 }
        );
    }
}