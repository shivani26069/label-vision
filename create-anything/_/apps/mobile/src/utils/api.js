const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://192.168.1.5:8000';

// Test connectivity
export const testConnection = async () => {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    const data = await response.json();
    console.log('Connection test:', data);
    return data;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  }
};

export const scanImage = async (imageUri) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🎯 Starting image upload...', imageUri);
      
      // Use XMLHttpRequest which works better in React Native
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          console.log(`📤 Upload progress: ${percent.toFixed(0)}%`);
        }
      };
      
      xhr.onload = () => {
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
      
      xhr.onerror = () => reject(new Error('Network request failed'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));
      
      const uploadUrl = `${API_BASE}/scan`;
      console.log('📤 Uploading to:', uploadUrl);
      
      xhr.open('POST', uploadUrl, true);
      xhr.timeout = 30000;
      
      // Create FormData with file URI
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'label_scan.jpg',
      });
      
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
