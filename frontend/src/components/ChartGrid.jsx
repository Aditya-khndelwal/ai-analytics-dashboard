import React, { useState, useRef } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion, AnimatePresence } from 'framer-motion';
import './ChartGrid.css';

const Plot = createPlotlyComponent(Plotly);

const CHART_TYPE_OPTIONS = ['histogram', 'bar', 'line', 'scatter', 'pie'];

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

const ChartGrid = ({ charts }) => {
  const [expandedChart, setExpandedChart] = useState(null);
  const [expandedType, setExpandedType] = useState(null);

  if (!charts || charts.length === 0) {
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
        {charts.map((chart, index) => (
          <ChartCard key={chart.id} chart={chart} index={index} onExpand={handleExpand} />
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
