// In production, API_BASE points to the Render backend URL.
// In development, Vite proxy handles /api → localhost:8000.
const API_BASE = import.meta.env.VITE_API_URL || '';

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Upload failed');
  return response.json();
};

export const uploadSample = async (datasetName) => {
  const response = await fetch(`${API_BASE}/api/upload/sample/${datasetName}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Sample upload failed');
  return response.json();
};

export const triggerAnalysis = async (sessionId) => {
  const response = await fetch(`${API_BASE}/api/analyze/${sessionId}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Analysis trigger failed');
  return response.json();
};

export const getResults = async (sessionId) => {
  const response = await fetch(`${API_BASE}/api/results/${sessionId}`);
  if (!response.ok) throw new Error('Failed to get results');
  return response.json();
};

export const pollStatus = async (sessionId) => {
  const response = await fetch(`${API_BASE}/api/status/${sessionId}`);
  if (!response.ok) throw new Error('Failed to poll status');
  return response.json();
};

export const downloadReport = async (sessionId, format) => {
  window.location.href = `${API_BASE}/api/report/${sessionId}?format=${format}`;
};

export const chatWithData = async (sessionId, message) => {
  const response = await fetch(`${API_BASE}/api/chat/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error('Chat request failed');
  return response.json();
};

export const createShareLink = async (sessionId) => {
  const response = await fetch(`${API_BASE}/api/share/${sessionId}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to create share link');
  return response.json();
};

export const getSharedResults = async (token) => {
  const response = await fetch(`${API_BASE}/api/shared/${token}`);
  if (!response.ok) throw new Error('Shared link not found');
  return response.json();
};
