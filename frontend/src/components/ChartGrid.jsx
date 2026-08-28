import React from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion } from 'framer-motion';
import './ChartGrid.css';

const Plot = createPlotlyComponent(Plotly);

const ChartGrid = ({ charts }) => {
  if (!charts || charts.length === 0) {
    return (
      <motion.div 
        className="chart-empty-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <p>No charts available</p>
      </motion.div>
    );
  }

  return (
    <div className="chart-grid">
      {charts.map((chart, index) => {
        // Remove Plotly's built-in title — we show it in the card header instead
        const { title: _removedTitle, ...restLayout } = chart.layout || {};
        const layoutOverrides = {
          ...restLayout,
          title: '',
          transition: { duration: 500, easing: 'cubic-in-out' },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            family: 'Inter, sans-serif',
            color: '#9C9892'
          },
          xaxis: {
            ...restLayout?.xaxis,
            gridcolor: '#2A2A30',
            zerolinecolor: '#2A2A30'
          },
          yaxis: {
            ...restLayout?.yaxis,
            gridcolor: '#2A2A30',
            zerolinecolor: '#2A2A30'
          },
          margin: { t: 10, r: 20, b: 40, l: 50 }
        };

        return (
          <motion.div 
            key={chart.id} 
            className="card chart-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
            whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
          >
            <div className="card-header chart-header">
              <h3 className="card-title">{chart.title}</h3>
              <span className="card-badge">{chart.chart_type}</span>
            </div>
            <div className="chart-container">
              <Plot
                data={chart.data}
                layout={layoutOverrides}
                config={{
                  responsive: true,
                  displayModeBar: 'hover',
                  displaylogo: false
                }}
                style={{ width: '100%', height: '100%', minHeight: '280px' }}
                useResizeHandler={true}
                frames={chart.frames || []}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ChartGrid;
