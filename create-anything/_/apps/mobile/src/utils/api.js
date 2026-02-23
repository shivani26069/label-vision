const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://192.168.1.6:8000';

// Test connectivity
export const testConnection = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('Connection test:', data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Connection test failed:', error);
    throw error;
  }
};

export const scanImage = async (imageUri) => {
  return new Promise((resolve, reject) => {
    try {
      // Handle both single image and multiple images
      const imageUris = Array.isArray(imageUri) ? imageUri : [imageUri];
      const isMultiple = Array.isArray(imageUri);
      
      console.log(`🎯 Starting image upload... (${imageUris.length} image${imageUris.length > 1 ? 's' : ''})`);
      
      const xhr = new XMLHttpRequest();
      let timeoutId = null;
      
      // Cleanup function
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        xhr.abort();
      };
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Cap progress at 100% to handle edge cases where loaded > total
          const percent = Math.min(100, (e.loaded / e.total) * 100);
          console.log(`📤 Upload progress: ${percent.toFixed(0)}%`);
        }
      };
      
      xhr.onload = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            console.log('✅ Scan result:', result);
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`API Error (${xhr.status}): ${xhr.responseText}`));
        }
      };
      
      xhr.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('❌ XHR error');
        reject(new Error('Network request failed'));
      };
      
      xhr.ontimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('❌ XHR timeout');
        reject(new Error('Request timeout'));
      };

      const endpoint = isMultiple ? '/scanMultiple' : '/scan';
      const uploadUrl = `${API_BASE}${endpoint}`;
      console.log('📤 Uploading to:', uploadUrl);
      
      xhr.open('POST', uploadUrl, true);
      // IMPORTANT: OCR + Gemini extraction takes 3-4 minutes with variable network
      // Using 20 minute timeout to handle slow networks without zombie connections
      xhr.timeout = 1200000;
      
      // Create FormData with file(s)
      // IMPORTANT: /scan expects 'file' (singular), /scanMultiple expects 'files' (plural)
      const formData = new FormData();
      const fieldName = isMultiple ? 'files' : 'file';  // Correct key for endpoint
      imageUris.forEach((uri, index) => {
        formData.append(fieldName, {
          uri: uri,
          type: 'image/jpeg',
          name: `label_scan_${index + 1}.jpg`,
        });
      });

      // Set up fallback timeout (5 seconds longer than xhr.timeout)
      const fallbackTimeout = 1205000;
      timeoutId = setTimeout(() => {
        console.error('❌ Fallback timeout triggered');
        cleanup();
        reject(new Error('Request timeout'));
      }, fallbackTimeout);
      
      xhr.send(formData);
      
    } catch (error) {
      console.error('❌ scanImage error:', error);
      reject(error);
    }
  });
};

export const getHistory = async (page = 1, limit = 20) => {
  const response = await fetch(`${API_BASE}/history?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
};

export const getScanDetail = async (scanId) => {
  const response = await fetch(`${API_BASE}/history/${scanId}`);
  if (!response.ok) throw new Error('Failed to fetch scan detail');
  return response.json();
};
