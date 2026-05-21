import { toast } from 'sonner';

export const CLOUDINARY_CLOUD_NAME = "dljiukpd4";
export const CLOUDINARY_PRESET = "chat_upload";

/**
 * Determine the Cloudinary resource type for a file.
 * Images stay as 'image'. Everything else (PDFs, docs, spreadsheets) goes to 'raw'
 * because free-tier Cloudinary blocks PDF delivery under the 'image' resource type.
 */
export function getCloudinaryResourceType(fileType: string, _fileName: string): 'image' | 'raw' {
  const type = fileType.toLowerCase();
  if (type.startsWith('image/')) {
    return 'image';
  }
  return 'raw';
}

/**
 * Get the Cloudinary upload URL for a file
 */
export function getCloudinaryUploadUrl(fileType: string, fileName: string): string {
  const resourceType = getCloudinaryResourceType(fileType, fileName);
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
}

/**
 * Extract Cloudinary public_id and resource_type from a URL
 */
export function extractCloudinaryInfo(url: string) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('cloudinary.com')) return null;

    const pathParts = parsed.pathname.split('/');
    
    // Find where the version part is (starts with 'v' followed by digits)
    const versionIndex = pathParts.findIndex(part => /^v\d+$/.test(part));
    let publicIdParts: string[] = [];
    if (versionIndex !== -1) {
      publicIdParts = pathParts.slice(versionIndex + 1);
    } else {
      publicIdParts = pathParts.slice(4);
    }
    
    const publicIdWithExt = publicIdParts.join('/');
    const resourceType = pathParts[2];
    let publicId = publicIdWithExt;
    
    // For non-raw resources (like images), strip the file extension
    // since the public_id doesn't contain it.
    if (resourceType !== 'raw') {
      const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        publicId = publicIdWithExt.substring(0, lastDotIndex);
      }
    }
    
    return {
      cloudName: pathParts[1],
      resourceType,
      publicId
    };
  } catch (e) {
    console.error("Failed to parse Cloudinary URL:", e);
    return null;
  }
}

/**
 * Download a Cloudinary file by fetching it as a blob and triggering
 * a programmatic <a download> click. This completely bypasses Cloudinary's
 * URL-transformation restrictions (fl_attachment causes HTTP 400 on free plans).
 */
export async function downloadCloudinaryFile(url: string, filename?: string): Promise<void> {
  try {
    toast.loading('Preparing download…', { id: 'cloud-dl' });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    toast.success('Download started!', { id: 'cloud-dl' });
  } catch (err) {
    console.error('[Cloudinary] Blob download failed, falling back to direct open:', err);
    toast.error('Direct download failed – opening in new tab', { id: 'cloud-dl' });
    window.open(url, '_blank');
  }
}

// Helper to compute SHA-1 hash using Web Crypto API
async function sha1(string: string): Promise<string> {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-1', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Safely delete an asset from Cloudinary using client-side signature generation.
 * If credentials are missing in .env, prints a warning to console but does not fail the deletion.
 */
export async function deleteCloudinaryAsset(url: string): Promise<boolean> {
  const info = extractCloudinaryInfo(url);
  if (!info) {
    console.warn("[Cloudinary] Not a Cloudinary URL or could not parse for deletion:", url);
    return false;
  }

  const { cloudName, resourceType, publicId } = info;
  
  // Retrieve API Key and Secret from environment variables
  const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY || '296719391483863';
  const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

  if (!apiSecret) {
    console.warn(
      `[Cloudinary Cleanup] VITE_CLOUDINARY_API_SECRET is not set in .env.\n` +
      `Asset "${publicId}" was deleted from DB but remains in Cloudinary. To enable clean-up, please add VITE_CLOUDINARY_API_SECRET to your .env file.`
    );
    return false;
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    
    // Sort parameters alphabetically: public_id, then timestamp
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1(signatureString);

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("api_key", apiKey);
    formData.append("signature", signature);

    const destroyUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
    const res = await fetch(destroyUrl, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    if (data.result === 'ok') {
      console.log(`[Cloudinary Cleanup] Successfully deleted asset from Cloudinary: ${publicId}`);
      return true;
    } else {
      console.error("[Cloudinary Cleanup] Destroy failed:", data);
      return false;
    }
  } catch (error) {
    console.error("[Cloudinary Cleanup] Error making destroy request:", error);
    return false;
  }
}
