import React, { useState, useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion } from 'framer-motion';
import './CustomChart.css';

const Plot = createPlotlyComponent(Plotly);

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: '📊' },
  { value: 'line', label: 'Line', icon: '📈' },
  { value: 'scatter', label: 'Scatter', icon: '🔵' },
  { value: 'histogram', label: 'Histogram', icon: '📶' },
  { value: 'pie', label: 'Pie', icon: '🥧' },
  { value: 'box', label: 'Box Plot', icon: '📦' },
];

const COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892'];

function CustomChart({ data, session }) {
  const [chartType, setChartType] = useState('bar');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [generated, setGenerated] = useState(false);

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const columnTypes = data?.column_types || {};

  const numericCols = useMemo(() =>
    columns.filter(c => {
      const t = (columnTypes[c] || '').toLowerCase();
      return t.includes('num') || t.includes('int') || t.includes('float');
    }), [columns, columnTypes]
  );

  const categoricalCols = useMemo(() =>
    columns.filter(c => {
      const t = (columnTypes[c] || '').toLowerCase();
      return !t.includes('num') && !t.includes('int') && !t.includes('float');
    }), [columns, columnTypes]
  );

  // Auto-suggest columns based on chart type
  const suggestColumns = (type) => {
    if (type === 'histogram' || type === 'box') {
      setXCol(numericCols[0] || columns[0] || '');
      setYCol('');
    } else if (type === 'pie') {
      setXCol(categoricalCols[0] || columns[0] || '');
      setYCol(numericCols[0] || '');
    } else {
      setXCol(categoricalCols[0] || columns[0] || '');
      setYCol(numericCols[0] || columns[1] || '');
    }
  };

  const handleTypeChange = (type) => {
    setChartType(type);
    suggestColumns(type);
    setGenerated(false);
  };

  const buildPlotData = () => {
    if (!xCol) return null;

    const xValues = rows.map(r => r[xCol]).filter(v => v !== null && v !== undefined);

    switch (chartType) {
      case 'histogram':
        return {
          data: [{ x: xValues, type: 'histogram', marker: { color: COLORS[0], opacity: 0.85 } }],
          layout: { xaxis: { title: xCol }, yaxis: { title: 'Count' } }
        };

      case 'box':
        return {
          data: [{ y: xValues, type: 'box', marker: { color: COLORS[0] }, name: xCol }],
          layout: { yaxis: { title: xCol } }
        };

      case 'pie': {
        // Aggregate: count by xCol, or sum yCol by xCol
        const agg = {};
        rows.forEach(r => {
          const label = String(r[xCol] ?? 'N/A');
          if (yCol) {
            agg[label] = (agg[label] || 0) + (Number(r[yCol]) || 0);
          } else {
            agg[label] = (agg[label] || 0) + 1;
          }
        });
        const labels = Object.keys(agg).slice(0, 10);
        const values = labels.map(l => agg[l]);
        return {
          data: [{ labels, values, type: 'pie', hole: 0.35, marker: { colors: COLORS } }],
          layout: {}
        };
      }

      case 'bar': {
        if (!yCol) {
          // Count by xCol
          const agg = {};
          rows.forEach(r => { const v = String(r[xCol] ?? 'N/A'); agg[v] = (agg[v] || 0) + 1; });
          const labels = Object.keys(agg).slice(0, 20);
          return {
            data: [{ x: labels, y: labels.map(l => agg[l]), type: 'bar', marker: { color: COLORS[0] } }],
            layout: { xaxis: { title: xCol }, yaxis: { title: 'Count' } }
          };
        }
        const yValues = rows.map(r => r[yCol]).filter(v => v !== null && v !== undefined);
        return {
          data: [{ x: xValues.slice(0, 50), y: yValues.slice(0, 50), type: 'bar', marker: { color: COLORS[0] } }],
          layout: { xaxis: { title: xCol }, yaxis: { title: yCol } }
        };
      }

      case 'line':
      case 'scatter': {
        const yValues = yCol ? rows.map(r => r[yCol]) : [];
        return {
          data: [{
            x: xValues.slice(0, 200),
            y: yValues.slice(0, 200),
            type: 'scatter',
            mode: chartType === 'line' ? 'lines+markers' : 'markers',
            marker: { color: COLORS[0], size: chartType === 'scatter' ? 8 : 5 },
            line: chartType === 'line' ? { color: COLORS[0], width: 2 } : undefined,
          }],
          layout: { xaxis: { title: xCol }, yaxis: { title: yCol || 'Value' } }
        };
      }

      default:
        return null;
    }
  };

  const handleGenerate = () => {
    setGenerated(true);
  };

  const plotConfig = generated ? buildPlotData() : null;

  const needsYCol = !['histogram', 'box'].includes(chartType);

  return (
    <motion.div
      className="custom-chart-container"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Controls */}
      <div className="custom-chart-controls">
        <div className="control-section">
          <label className="control-label">Chart Type</label>
          <div className="chart-type-grid">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.value}
                className={`chart-type-btn ${chartType === ct.value ? 'active' : ''}`}
                onClick={() => handleTypeChange(ct.value)}
              >
                <span className="chart-type-icon">{ct.icon}</span>
                <span className="chart-type-name">{ct.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="control-row">
          <div className="control-section">
            <label className="control-label">
              {chartType === 'histogram' || chartType === 'box' ? 'Column' : 'X Axis'}
            </label>
            <select
              className="control-select"
              value={xCol}
              onChange={(e) => { setXCol(e.target.value); setGenerated(false); }}
            >
              <option value="">Select column...</option>
              {columns.map(c => (
                <option key={c} value={c}>{c} ({columnTypes[c] || 'unknown'})</option>
              ))}
            </select>
          </div>

          {needsYCol && (
            <div className="control-section">
              <label className="control-label">Y Axis {chartType === 'pie' ? '(optional)' : ''}</label>
              <select
                className="control-select"
                value={yCol}
                onChange={(e) => { setYCol(e.target.value); setGenerated(false); }}
              >
                <option value="">{chartType === 'pie' ? 'Count (default)' : 'Select column...'}</option>
                {columns.filter(c => c !== xCol).map(c => (
                  <option key={c} value={c}>{c} ({columnTypes[c] || 'unknown'})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <motion.button
          className="btn-primary generate-btn"
          onClick={handleGenerate}
          disabled={!xCol}
          whileTap={{ scale: 0.97 }}
        >
          Generate Chart
        </motion.button>
      </div>

      {/* Chart Output */}
      {plotConfig && (
        <motion.div
          className="custom-chart-output"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Plot
            data={plotConfig.data}
            layout={{
              ...plotConfig.layout,
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { family: 'Inter, sans-serif', color: '#9C9892' },
              xaxis: { ...plotConfig.layout.xaxis, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
              yaxis: { ...plotConfig.layout.yaxis, gridcolor: '#2A2A30', zerolinecolor: '#2A2A30' },
              margin: { t: 20, r: 20, b: 50, l: 60 },
            }}
            config={{ responsive: true, displayModeBar: 'hover', displaylogo: false }}
            style={{ width: '100%', height: '400px' }}
            useResizeHandler={true}
          />
        </motion.div>
      )}

      {!generated && (
        <div className="custom-chart-placeholder">
          <p>Select columns and chart type, then click "Generate Chart"</p>
        </div>
      )}
    </motion.div>
  );
}

export default CustomChart;
