import React, { useState, useEffect } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion, AnimatePresence } from 'framer-motion';
import { getAnomalies, getClusters, getForecast, getImportance, getCleaning, getPca, getAutoMl, getHeatmap } from '../api/client';
import './MLInsights.css';

const Plot = createPlotlyComponent(Plotly);
const COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892', '#D4A574', '#6B8E7B'];

function MLInsights({ sessionId }) {
  const [activePanel, setActivePanel] = useState('anomalies');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const loadPanel = async (panel) => {
    if (data[panel]) return; // Already loaded
    setLoading(p => ({ ...p, [panel]: true }));
    setErrors(p => ({ ...p, [panel]: null }));
    try {
      let result;
      switch (panel) {
        case 'anomalies': result = await getAnomalies(sessionId); break;
        case 'clusters': result = await getClusters(sessionId); break;
        case 'forecast': result = await getForecast(sessionId); break;
        case 'importance': result = await getImportance(sessionId); break;
        case 'cleaning': result = await getCleaning(sessionId); break;
        case 'pca': result = await getPca(sessionId); break;
        case 'automl': result = await getAutoMl(sessionId); break;
        case 'heatmap': result = await getHeatmap(sessionId); break;
      }
      setData(p => ({ ...p, [panel]: result }));
    } catch (e) {
      setErrors(p => ({ ...p, [panel]: e.message }));
    }
    setLoading(p => ({ ...p, [panel]: false }));
  };

  useEffect(() => { loadPanel(activePanel); }, [activePanel]);

  const panels = [
    { id: 'anomalies', label: 'Anomalies', icon: '🔍' },
    { id: 'clusters', label: 'Clustering', icon: '🧮' },
    { id: 'forecast', label: 'Forecast', icon: '📈' },
    { id: 'importance', label: 'Importance', icon: '🎯' },
    { id: 'pca', label: 'PCA', icon: '🔬' },
    { id: 'automl', label: 'Auto ML', icon: '🤖' },
    { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  ];

  return (
    <div className="ml-insights">
      <div className="ml-tabs">
        {panels.map(p => (
          <button key={p.id} className={`ml-tab ${activePanel === p.id ? 'active' : ''}`} onClick={() => setActivePanel(p.id)}>
            <span className="ml-tab-icon">{p.icon}</span>
            <span className="ml-tab-label">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="ml-content">
        {loading[activePanel] && <div className="ml-loading"><div className="ml-spinner" /><span>Running {activePanel}...</span></div>}
        {errors[activePanel] && (
          <div className="ml-error">
            <p>⚠️ {errors[activePanel]}</p>
            <p style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>Make sure the backend server is running and the dataset is still available.</p>
            <button className="ml-btn" style={{ marginTop: 10 }} onClick={() => { setErrors(p => ({...p, [activePanel]: null})); setData(p => ({...p, [activePanel]: undefined})); loadPanel(activePanel); }}>Retry</button>
          </div>
        )}

        {!loading[activePanel] && !errors[activePanel] && data[activePanel] && (
          <AnimatePresence mode="wait">
            <motion.div key={activePanel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {activePanel === 'anomalies' && <AnomalyPanel data={data.anomalies} />}
              {activePanel === 'clusters' && <ClusterPanel data={data.clusters} sessionId={sessionId} onRefresh={(d) => setData(p => ({...p, clusters: d}))} />}
              {activePanel === 'forecast' && <ForecastPanel data={data.forecast} />}
              {activePanel === 'importance' && <ImportancePanel data={data.importance} />}
              {activePanel === 'pca' && <PcaPanel data={data.pca} />}
              {activePanel === 'automl' && <AutoMlPanel data={data.automl} />}
              {activePanel === 'heatmap' && <HeatmapPanel data={data.heatmap} />}
              {activePanel === 'cleaning' && <CleaningPanel data={data.cleaning} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function AnomalyPanel({ data }) {
  const { anomalies, column_stats, total_anomalous_rows, total_rows, method } = data;
  const pct = total_rows > 0 ? ((total_anomalous_rows / total_rows) * 100).toFixed(1) : 0;

  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Anomaly Detection</h3>
        <span className="ml-method-badge">{method}</span>
      </div>

      <div className="ml-stat-row">
        <div className="ml-stat-card accent">{total_anomalous_rows}<span>Anomalous Rows</span></div>
        <div className="ml-stat-card">{pct}%<span>of Dataset</span></div>
        <div className="ml-stat-card">{Object.keys(column_stats).length}<span>Columns Checked</span></div>
      </div>

      {Object.keys(column_stats).length > 0 && (
        <div className="ml-section">
          <h4>Per-Column Anomalies</h4>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead><tr><th>Column</th><th>Outliers</th><th>%</th><th>Bounds</th></tr></thead>
              <tbody>
                {Object.entries(column_stats).sort((a, b) => b[1].anomaly_count - a[1].anomaly_count).map(([col, s]) => (
                  <tr key={col}>
                    <td className="ml-col-name">{col}</td>
                    <td><span className={`ml-count-badge ${s.anomaly_count > 0 ? 'warn' : ''}`}>{s.anomaly_count}</span></td>
                    <td>{s.anomaly_pct}%</td>
                    <td className="ml-bounds">[{s.lower_bound}, {s.upper_bound}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="ml-section">
          <h4>Flagged Rows (top {anomalies.length})</h4>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead><tr><th>Row</th><th>Flagged Columns</th><th>Values</th></tr></thead>
              <tbody>
                {anomalies.slice(0, 20).map((a, i) => (
                  <tr key={i}>
                    <td>#{a.row_index}</td>
                    <td>{a.flagged_columns.join(', ')}</td>
                    <td>{Object.entries(a.values).map(([k, v]) => `${k}=${v}`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClusterPanel({ data, sessionId, onRefresh }) {
  const [nClusters, setNClusters] = useState(data.n_clusters || 3);
  const [reloading, setReloading] = useState(false);
  const { scatter_data, cluster_summary, method, columns_used, inertia } = data;

  const handleRecluster = async () => {
    setReloading(true);
    try {
      const result = await getClusters(sessionId, null, nClusters);
      onRefresh(result);
    } catch {}
    setReloading(false);
  };

  const traces = [];
  if (scatter_data) {
    const unique = [...new Set(scatter_data.labels)];
    unique.forEach((label, i) => {
      const mask = scatter_data.labels.map((l, j) => l === label ? j : -1).filter(j => j >= 0);
      traces.push({
        x: mask.map(j => scatter_data.x[j]),
        y: mask.map(j => scatter_data.y[j]),
        type: 'scatter', mode: 'markers',
        name: `Cluster ${label}`,
        marker: { color: COLORS[i % COLORS.length], size: 6, opacity: 0.7 },
      });
    });
  }

  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>K-Means Clustering</h3>
        <span className="ml-method-badge">{method}</span>
      </div>

      <div className="ml-controls-row">
        <label>Clusters:</label>
        <input type="range" min="2" max="8" value={nClusters} onChange={e => setNClusters(Number(e.target.value))} />
        <span className="ml-range-val">{nClusters}</span>
        <button className="ml-btn" onClick={handleRecluster} disabled={reloading}>{reloading ? '...' : 'Re-cluster'}</button>
      </div>

      <div className="ml-stat-row">
        <div className="ml-stat-card accent">{data.n_clusters}<span>Clusters</span></div>
        <div className="ml-stat-card">{data.total_points}<span>Data Points</span></div>
        <div className="ml-stat-card">{inertia}<span>Inertia</span></div>
      </div>

      {traces.length > 0 && (
        <div className="ml-chart-box">
          <Plot data={traces} layout={{
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { family: 'Inter', color: '#9C9892' },
            xaxis: { title: scatter_data.x_label, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
            yaxis: { title: scatter_data.y_label, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
            margin: { t: 10, r: 20, b: 50, l: 60 }, legend: { font: { color: '#9C9892' } },
          }} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: '360px' }} useResizeHandler />
        </div>
      )}

      {cluster_summary && (
        <div className="ml-section">
          <h4>Cluster Summary</h4>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead><tr><th>Cluster</th><th>Size</th>{columns_used.map(c => <th key={c}>{c} (mean)</th>)}</tr></thead>
              <tbody>
                {cluster_summary.map(cs => (
                  <tr key={cs.cluster}>
                    <td><span className="ml-cluster-dot" style={{ background: COLORS[cs.cluster % COLORS.length] }} /> {cs.cluster}</td>
                    <td>{cs.size}</td>
                    {columns_used.map(c => <td key={c}>{cs[`${c}_mean`]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ForecastPanel({ data }) {
  const { historical_dates, historical_values, trend_line, forecast_dates, forecast_values, moving_average, method, slope, r_squared, date_col, value_col } = data;

  const traces = [
    { x: historical_dates, y: historical_values, type: 'scatter', mode: 'lines', name: 'Actual', line: { color: '#9C9892', width: 1.5 } },
    { x: historical_dates, y: trend_line, type: 'scatter', mode: 'lines', name: 'Trend', line: { color: '#C9A76A', width: 2, dash: 'dash' } },
    { x: historical_dates, y: moving_average, type: 'scatter', mode: 'lines', name: 'Moving Avg', line: { color: '#5FA98A', width: 1.5 } },
    { x: forecast_dates, y: forecast_values, type: 'scatter', mode: 'lines+markers', name: 'Forecast', line: { color: '#B0637E', width: 2 }, marker: { size: 6 } },
  ];

  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Time Series Forecast</h3>
        <span className="ml-method-badge">{method}</span>
      </div>
      <div className="ml-stat-row">
        <div className="ml-stat-card">{date_col}<span>Date Column</span></div>
        <div className="ml-stat-card">{value_col}<span>Value Column</span></div>
        <div className="ml-stat-card accent">{r_squared}<span>R² Score</span></div>
        <div className="ml-stat-card">{slope > 0 ? '↑' : '↓'} {Math.abs(slope)}<span>Slope</span></div>
      </div>
      <div className="ml-chart-box">
        <Plot data={traces} layout={{
          paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
          font: { family: 'Inter', color: '#9C9892' },
          xaxis: { gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
          yaxis: { title: value_col, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
          margin: { t: 10, r: 20, b: 50, l: 60 }, legend: { font: { color: '#9C9892' } },
        }} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: '360px' }} useResizeHandler />
      </div>
    </div>
  );
}

function ImportancePanel({ data }) {
  const { rankings, target_column, method } = data;
  const top = rankings.slice(0, 15);

  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Feature Importance</h3>
        <span className="ml-method-badge">{method}</span>
      </div>
      <p className="ml-subtitle">Target: <strong>{target_column}</strong></p>

      <div className="ml-chart-box">
        <Plot data={[{
          y: top.map(r => r.feature).reverse(),
          x: top.map(r => r.combined_score).reverse(),
          type: 'bar', orientation: 'h',
          marker: { color: top.map((_, i) => COLORS[i % COLORS.length]).reverse() },
        }]} layout={{
          paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
          font: { family: 'Inter', color: '#9C9892', size: 11 },
          xaxis: { title: 'Importance Score', gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
          yaxis: { automargin: true }, margin: { t: 10, r: 20, b: 40, l: 120 },
        }} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: Math.max(250, top.length * 30) + 'px' }} useResizeHandler />
      </div>

      <div className="ml-section">
        <h4>Detailed Scores</h4>
        <div className="ml-table-wrap">
          <table className="ml-table">
            <thead><tr><th>Feature</th><th>Correlation</th><th>Mutual Info</th><th>Combined</th></tr></thead>
            <tbody>
              {rankings.map(r => (
                <tr key={r.feature}>
                  <td className="ml-col-name">{r.feature}</td>
                  <td>{r.correlation}</td>
                  <td>{r.mutual_info}</td>
                  <td><strong>{r.combined_score}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CleaningPanel({ data }) {
  const { suggestions, summary, quality_score, method } = data;
  const scoreColor = quality_score >= 80 ? '#5FA98A' : quality_score >= 50 ? '#C9A76A' : '#B0637E';

  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Data Cleaning</h3>
        <span className="ml-method-badge">{method}</span>
      </div>

      <div className="ml-stat-row">
        <div className="ml-stat-card" style={{ color: scoreColor }}>{quality_score}%<span>Quality Score</span></div>
        <div className="ml-stat-card">{summary.total_missing}<span>Missing Values</span></div>
        <div className="ml-stat-card">{summary.total_duplicates}<span>Duplicate Rows</span></div>
        <div className="ml-stat-card">{suggestions.length}<span>Suggestions</span></div>
      </div>

      {suggestions.length === 0 ? (
        <div className="ml-empty">✅ Your data looks clean! No issues detected.</div>
      ) : (
        <div className="ml-suggestions">
          {suggestions.map((s, i) => (
            <div key={i} className={`ml-suggestion ${s.severity}`}>
              <div className="ml-suggestion-header">
                <span className={`ml-severity-dot ${s.severity}`} />
                <span className="ml-suggestion-col">{s.column}</span>
                <span className="ml-suggestion-type">{s.type.replace(/_/g, ' ')}</span>
              </div>
              <p className="ml-suggestion-issue">{s.issue}</p>
              <p className="ml-suggestion-fix">💡 {s.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PcaPanel({ data }) {
  const { components, scatter_data, total_explained_variance, n_features, method } = data;
  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>PCA — Dimensionality Reduction</h3>
        <span className="ml-method-badge">{method}</span>
      </div>
      <div className="ml-stat-row">
        <div className="ml-stat-card accent">{total_explained_variance}%<span>Variance Explained</span></div>
        <div className="ml-stat-card">{n_features}<span>Original Features</span></div>
        <div className="ml-stat-card">{components.length}<span>Components</span></div>
      </div>
      {scatter_data && (
        <div className="ml-chart-box">
          <Plot data={[{ x: scatter_data.x, y: scatter_data.y, type: 'scatter', mode: 'markers', marker: { color: '#C9A76A', size: 4, opacity: 0.6 } }]}
            layout={{ paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { family: 'Inter', color: '#9C9892' },
              xaxis: { title: `PC1 (${components[0]?.explained_variance}%)`, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
              yaxis: { title: `PC2 (${components[1]?.explained_variance || 0}%)`, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
              margin: { t: 10, r: 20, b: 50, l: 60 } }}
            config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: '360px' }} useResizeHandler />
        </div>
      )}
      <div className="ml-section">
        <h4>Component Loadings</h4>
        {components.map(c => (
          <div key={c.component} style={{ marginBottom: 12 }}>
            <p className="ml-subtitle"><strong>PC{c.component}</strong> — {c.explained_variance}% variance</p>
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead><tr><th>Feature</th><th>Loading</th></tr></thead>
                <tbody>{c.top_features.map(f => (
                  <tr key={f.feature}><td className="ml-col-name">{f.feature}</td><td>{f.loading}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutoMlPanel({ data }) {
  const { task_type, target_column, results, best_model, metric_name, n_features, train_size, test_size, method } = data;
  const metricKey = task_type === 'Classification' ? 'accuracy' : 'r2_score';
  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Auto ML — Model Comparison</h3>
        <span className="ml-method-badge">{method}</span>
      </div>
      <div className="ml-stat-row">
        <div className="ml-stat-card accent">{best_model}<span>Best Model</span></div>
        <div className="ml-stat-card">{task_type}<span>Task Type</span></div>
        <div className="ml-stat-card">{n_features}<span>Features</span></div>
        <div className="ml-stat-card">{train_size}/{test_size}<span>Train/Test</span></div>
      </div>
      <p className="ml-subtitle">Target: <strong>{target_column}</strong></p>
      <div className="ml-chart-box">
        <Plot data={[{
          x: results.map(r => r.model),
          y: results.map(r => r[metricKey]),
          type: 'bar',
          marker: { color: results.map((r, i) => i === 0 ? '#C9A76A' : '#5C5A56') },
          text: results.map(r => `${r[metricKey]}%`),
          textposition: 'outside',
        }]} layout={{
          paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
          font: { family: 'Inter', color: '#9C9892' },
          yaxis: { title: metric_name + ' (%)', gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
          margin: { t: 20, r: 20, b: 80, l: 60 },
        }} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: '320px' }} useResizeHandler />
      </div>
      <div className="ml-section">
        <h4>Detailed Results</h4>
        <div className="ml-table-wrap">
          <table className="ml-table">
            <thead><tr><th>Model</th><th>{metric_name}</th>{task_type === 'Classification' ? <th>F1 Score</th> : <th>RMSE</th>}</tr></thead>
            <tbody>{results.map(r => (
              <tr key={r.model} style={r.model === best_model ? { background: 'var(--accent-subtle)' } : {}}>
                <td className="ml-col-name">{r.model} {r.model === best_model && '🏆'}</td>
                <td><strong>{r[metricKey]}%</strong></td>
                <td>{task_type === 'Classification' ? `${r.f1_score}%` : r.rmse}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeatmapPanel({ data }) {
  const { labels, matrix, top_pairs, method } = data;
  return (
    <div className="ml-panel">
      <div className="ml-panel-header">
        <h3>Correlation Heatmap</h3>
        <span className="ml-method-badge">{method}</span>
      </div>
      <div className="ml-chart-box">
        <Plot data={[{
          z: matrix, x: labels, y: labels, type: 'heatmap',
          colorscale: [[0, '#B0637E'], [0.5, '#16161A'], [1, '#5FA98A']],
          zmin: -1, zmax: 1, showscale: true,
          colorbar: { tickfont: { color: '#9C9892' }, title: { text: 'r', font: { color: '#9C9892' } } },
        }]} layout={{
          paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
          font: { family: 'Inter', color: '#9C9892', size: 10 },
          margin: { t: 10, r: 60, b: 100, l: 100 },
          xaxis: { tickangle: -45 }, yaxis: { autorange: 'reversed' },
        }} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: '450px' }} useResizeHandler />
      </div>
      {top_pairs && top_pairs.length > 0 && (
        <div className="ml-section">
          <h4>Strongest Correlations</h4>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead><tr><th>Column 1</th><th>Column 2</th><th>Correlation</th></tr></thead>
              <tbody>{top_pairs.map((p, i) => (
                <tr key={i}>
                  <td className="ml-col-name">{p.col1}</td>
                  <td className="ml-col-name">{p.col2}</td>
                  <td style={{ color: p.correlation > 0 ? '#5FA98A' : '#B0637E', fontWeight: 600 }}>{p.correlation}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MLInsights;
