import React, { useState, useRef, useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion, AnimatePresence } from 'framer-motion';
import './ChartGrid.css';

const Plot = createPlotlyComponent(Plotly);

const CHART_TYPE_OPTIONS = ['histogram', 'bar', 'line', 'scatter', 'pie'];

const COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892', '#E8C872', '#6DB89C', '#8FA5C4', '#C47B94'];

/**
 * Auto-generate charts from raw data_preview on the frontend.
 * No backend API calls needed.
 */
function autoGenerateCharts(dataPreview) {
  if (!dataPreview || !dataPreview.rows || !dataPreview.columns) return [];
  const { rows, columns, column_types } = dataPreview;
  if (rows.length === 0) return [];

  const charts = [];

  // Detect column types
  const numericCols = columns.filter(col => {
    const type = (column_types?.[col] || '').toLowerCase();
    if (type.includes('int') || type.includes('float') || type.includes('num')) return true;
    const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
    return vals.length > 0 && vals.every(v => !isNaN(Number(v)));
  });
  const catCols = columns.filter(col => !numericCols.includes(col));

  // 1. Histogram for each numeric column (up to 3)
  numericCols.slice(0, 3).forEach(col => {
    const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
    charts.push({
      title: `Distribution of ${col}`,
      chart_type: 'histogram',
      data: [{ x: values, type: 'histogram', marker: { color: COLORS[0] }, nbinsx: 25 }],
      layout: { xaxis: { title: col }, yaxis: { title: 'Frequency' } },
    });
  });

  // 2. Bar chart for categorical columns (top 10 values, up to 2)
  catCols.slice(0, 2).forEach(col => {
    const counts = {};
    rows.forEach(r => {
      const v = r[col];
      if (v !== null && v !== undefined && v !== '') counts[String(v)] = (counts[String(v)] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts.push({
      title: `Top Values — ${col}`,
      chart_type: 'bar',
      data: [{ x: sorted.map(s => s[0]), y: sorted.map(s => s[1]), type: 'bar', marker: { color: COLORS[1] } }],
      layout: { xaxis: { title: col }, yaxis: { title: 'Count' } },
    });
  });

  // 3. Scatter plot: first two numeric columns
  if (numericCols.length >= 2) {
    const xCol = numericCols[0], yCol = numericCols[1];
    const x = rows.map(r => Number(r[xCol])).filter(v => !isNaN(v));
    const y = rows.map(r => Number(r[yCol])).filter(v => !isNaN(v));
    const len = Math.min(x.length, y.length, 500);
    charts.push({
      title: `${xCol} vs ${yCol}`,
      chart_type: 'scatter',
      data: [{ x: x.slice(0, len), y: y.slice(0, len), type: 'scatter', mode: 'markers', marker: { color: COLORS[3], size: 5, opacity: 0.6 } }],
      layout: { xaxis: { title: xCol }, yaxis: { title: yCol } },
    });
  }

  // 4. Pie chart for first categorical column
  if (catCols.length > 0) {
    const col = catCols[0];
    const counts = {};
    rows.forEach(r => {
      const v = r[col];
      if (v !== null && v !== undefined && v !== '') counts[String(v)] = (counts[String(v)] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    charts.push({
      title: `Breakdown of ${col}`,
      chart_type: 'pie',
      data: [{ labels: sorted.map(s => s[0]), values: sorted.map(s => s[1]), type: 'pie', hole: 0.35, marker: { colors: COLORS } }],
      layout: {},
    });
  }

  // 5. Box plot for numeric columns (up to 4)
  if (numericCols.length >= 1) {
    const boxTraces = numericCols.slice(0, 4).map((col, i) => ({
      y: rows.map(r => Number(r[col])).filter(v => !isNaN(v)),
      type: 'box', name: col, marker: { color: COLORS[i % COLORS.length] },
    }));
    charts.push({
      title: 'Numeric Distributions (Box Plot)',
      chart_type: 'box',
      data: boxTraces,
      layout: {},
    });
  }

  // 6. Line chart for first numeric column (shows trend by row order)
  if (numericCols.length >= 1) {
    const col = numericCols[0];
    const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v)).slice(0, 500);
    charts.push({
      title: `Trend — ${col}`,
      chart_type: 'line',
      data: [{ y: values, type: 'scatter', mode: 'lines', line: { color: COLORS[0], width: 1.5 } }],
      layout: { xaxis: { title: 'Row Index' }, yaxis: { title: col } },
    });
  }

  return charts;
}

function convertChartData(originalData, originalType, newType) {
  if (newType === originalType) return originalData;

  const trace = originalData[0] || {};
  
  switch (newType) {
    case 'bar':
      return [{ ...trace, type: 'bar', mode: undefined }];
    case 'line':
      return [{ x: trace.x, y: trace.y || trace.values, type: 'scatter', mode: 'lines+markers', marker: trace.marker }];
    case 'scatter':
      return [{ x: trace.x, y: trace.y || trace.values, type: 'scatter', mode: 'markers', marker: { ...trace.marker, size: 8 } }];
    case 'histogram':
      return [{ x: trace.x || trace.labels, type: 'histogram', marker: trace.marker }];
    case 'pie':
      if (trace.x && trace.y) {
        return [{ labels: trace.x.slice(0, 10), values: trace.y.slice(0, 10), type: 'pie', hole: 0.35, marker: { colors: ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892'] } }];
      }
      return originalData;
    default:
      return originalData;
  }
}

function getLayoutOverrides(layout, isFullscreen) {
  const { title: _removedTitle, ...restLayout } = layout || {};
  return {
    ...restLayout,
    title: '',
    transition: { duration: 500, easing: 'cubic-in-out' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      family: 'Inter, sans-serif',
      color: '#9C9892',
      size: isFullscreen ? 14 : 12,
    },
    xaxis: {
      ...restLayout?.xaxis,
      gridcolor: '#2A2A30',
      zerolinecolor: '#2A2A30',
    },
    yaxis: {
      ...restLayout?.yaxis,
      gridcolor: '#2A2A30',
      zerolinecolor: '#2A2A30',
    },
    margin: isFullscreen
      ? { t: 20, r: 40, b: 60, l: 70 }
      : { t: 10, r: 20, b: 40, l: 50 },
  };
}

function ChartCard({ chart, index, onExpand }) {
  const [chartType, setChartType] = useState(chart.chart_type);
  const chartRef = React.useRef(null);
  const displayData = convertChartData(chart.data, chart.chart_type, chartType);

  const handleDownloadPng = () => {
    const plotEl = chartRef.current?.el;
    if (plotEl) {
      Plotly.downloadImage(plotEl, {
        format: 'png',
        width: 1200,
        height: 700,
        filename: chart.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'chart',
      });
    }
  };

  return (
    <motion.div
      className="card chart-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
    >
      <div className="card-header chart-header">
        <h3 className="card-title">{chart.title}</h3>
        <div className="chart-actions">
          <select
            className="chart-type-select"
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            title="Switch chart type"
          >
            {CHART_TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <button className="chart-expand-btn" onClick={handleDownloadPng} title="Download PNG">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          <button className="chart-expand-btn" onClick={() => onExpand(chart, chartType)} title="Fullscreen">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="chart-container">
        <Plot
          ref={chartRef}
          data={displayData}
          layout={getLayoutOverrides(chart.layout, false)}
          config={{ responsive: true, displayModeBar: 'hover', displaylogo: false }}
          style={{ width: '100%', height: '100%', minHeight: '280px' }}
          useResizeHandler={true}
        />
      </div>
    </motion.div>
  );
}

const ChartGrid = ({ charts, dataPreview }) => {
  const [expandedChart, setExpandedChart] = useState(null);
  const [expandedType, setExpandedType] = useState(null);

  // Auto-generate charts from data if none provided by backend
  const localCharts = useMemo(() => {
    if (charts && charts.length > 0) return charts;
    return autoGenerateCharts(dataPreview);
  }, [charts, dataPreview]);

  if (!localCharts || localCharts.length === 0) {
    return (
      <motion.div className="chart-empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p>No charts available</p>
      </motion.div>
    );
  }

  const handleExpand = (chart, type) => {
    setExpandedChart(chart);
    setExpandedType(type);
  };

  return (
    <>
      <div className="chart-grid">
        {localCharts.map((chart, index) => (
          <ChartCard key={chart.id || index} chart={chart} index={index} onExpand={handleExpand} />
        ))}
      </div>

      {/* Fullscreen Chart Modal */}
      <AnimatePresence>
        {expandedChart && (
          <motion.div
            className="chart-fullscreen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedChart(null)}
          >
            <motion.div
              className="chart-fullscreen-modal"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chart-fullscreen-header">
                <h2 className="chart-fullscreen-title">{expandedChart.title}</h2>
                <div className="chart-actions">
                  <select
                    className="chart-type-select"
                    value={expandedType}
                    onChange={(e) => setExpandedType(e.target.value)}
                  >
                    {CHART_TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <button className="chart-close-btn" onClick={() => setExpandedChart(null)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="chart-fullscreen-body">
                <Plot
                  data={convertChartData(expandedChart.data, expandedChart.chart_type, expandedType)}
                  layout={getLayoutOverrides(expandedChart.layout, true)}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%', height: '100%' }}
                  useResizeHandler={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChartGrid;
