import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn('[R2] Missing environment variables. R2 operations will be no-ops.');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadToR2(
  key: string,
  body: string | Uint8Array | Buffer,
  contentType: string = 'application/json',
  metadata?: Record<string, string>
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_BUCKET_NAME) {
    return { success: false, error: 'R2_BUCKET_NAME not configured' };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    await r2Client.send(command);

    const url = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

    return { success: true, url };
  } catch (error) {
    console.error('[R2] Upload failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function downloadFromR2(key: string): Promise<{ success: boolean; body?: string; error?: string }> {
  if (!R2_BUCKET_NAME) {
    return { success: false, error: 'R2_BUCKET_NAME not configured' };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    const body = await response.Body?.transformToString();

    return { success: true, body: body || '' };
  } catch (error) {
    console.error('[R2] Download failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  if (!R2_BUCKET_NAME) {
    return { success: false, error: 'R2_BUCKET_NAME not configured' };
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('[R2] Delete failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string = 'application/json',
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_BUCKET_NAME) {
    return { success: false, error: 'R2_BUCKET_NAME not configured' };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    return { success: true, url };
  } catch (error) {
    console.error('[R2] Presigned URL failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_BUCKET_NAME) {
    return { success: false, error: 'R2_BUCKET_NAME not configured' };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    return { success: true, url };
  } catch (error) {
    console.error('[R2] Presigned download URL failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function objectExists(key: string): Promise<boolean> {
  if (!R2_BUCKET_NAME) return false;

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch {
    return false;
  }
}

export function generateR2Key(sourceId: string, contentHash: string, date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toISOString().split('T')[0].replace(/-/g, '/');
  return `source-archives/${sourceId}/${dateStr}/${contentHash}.json`;
}