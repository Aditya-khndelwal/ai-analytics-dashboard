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

export const uploadFromUrl = async (url) => {
  const response = await fetch(`${API_BASE}/api/upload/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'URL upload failed');
  }
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

export const getSessions = async () => {
  const response = await fetch(`${API_BASE}/api/sessions`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
};

// ── ML Endpoints ──
const mlError = async (r, fallback) => {
  const e = await r.json().catch(() => ({}));
  throw new Error(e.detail || `${fallback} (HTTP ${r.status})`);
};

export const getAnomalies = async (sessionId) => {
  const r = await fetch(`${API_BASE}/api/ml/anomalies/${sessionId}`);
  if (!r.ok) await mlError(r, 'Anomaly detection failed');
  return r.json();
};

export const getClusters = async (sessionId, columns = null, nClusters = 3) => {
  const r = await fetch(`${API_BASE}/api/ml/cluster/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns, n_clusters: nClusters }),
  });
  if (!r.ok) await mlError(r, 'Clustering failed');
  return r.json();
};

export const getForecast = async (sessionId, dateCol = null, valueCol = null, periods = 10) => {
  const r = await fetch(`${API_BASE}/api/ml/forecast/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_col: dateCol, value_col: valueCol, periods }),
  });
  if (!r.ok) await mlError(r, 'Forecasting failed');
  return r.json();
};

export const getImportance = async (sessionId, targetCol = null) => {
  const r = await fetch(`${API_BASE}/api/ml/importance/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_col: targetCol }),
  });
  if (!r.ok) await mlError(r, 'Feature importance failed');
  return r.json();
};

export const getCleaning = async (sessionId) => {
  const r = await fetch(`${API_BASE}/api/ml/cleaning/${sessionId}`);
  if (!r.ok) await mlError(r, 'Data cleaning analysis failed');
  return r.json();
};

export const getPca = async (sessionId, nComponents = 2) => {
  const r = await fetch(`${API_BASE}/api/ml/pca/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ n_components: nComponents }),
  });
  if (!r.ok) await mlError(r, 'PCA failed');
  return r.json();
};

export const getAutoMl = async (sessionId, targetCol = null) => {
  const r = await fetch(`${API_BASE}/api/ml/automl/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_col: targetCol }),
  });
  if (!r.ok) await mlError(r, 'Auto ML failed');
  return r.json();
};

export const getHeatmap = async (sessionId) => {
  const r = await fetch(`${API_BASE}/api/ml/heatmap/${sessionId}`);
  if (!r.ok) await mlError(r, 'Heatmap failed');
  return r.json();
};

export const localQuery = async (sessionId, question) => {
  const r = await fetch(`${API_BASE}/api/ml/query/${sessionId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) await mlError(r, 'Query failed');
  return r.json();
};
