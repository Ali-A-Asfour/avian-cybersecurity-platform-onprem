import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function POST(request: NextRequest) {
  // Auth required
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filePath = formData.get('path') as string;

    if (!file || !filePath) {
      return NextResponse.json({ error: 'File and path are required' }, { status: 400 });
    }

    // Block path traversal
    if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\0')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    // Enforce size limit (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const uploadDir = join(process.cwd(), 'storage', 'uploads');
    const fullPath = join(uploadDir, filePath);

    // Ensure resolved path stays within upload directory
    if (!resolve(fullPath).startsWith(resolve(uploadDir))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const directory = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (!existsSync(directory)) {
      await mkdir(directory, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(fullPath, buffer);

    return NextResponse.json({ success: true, message: 'File uploaded successfully', path: filePath });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path: filePath } = await request.json();
    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\0')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('File deletion error:', error);
    return NextResponse.json({ error: 'File deletion failed' }, { status: 500 });
  }
}
