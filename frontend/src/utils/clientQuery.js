/**
 * Client-Side Smart Natural Language Query Engine.
 * Answers data questions directly in the browser using dataPreview rows and columns.
 * Zero external API calls, zero server requirement.
 */

export function queryClientData(dataPreview, question) {
  if (!dataPreview || !dataPreview.rows || dataPreview.rows.length === 0) {
    return { answer: 'No data loaded to query.', chart: null };
  }

  const q = question.toLowerCase().trim();
  const rows = dataPreview.rows;
  const cols = dataPreview.columns || [];

  // Identify numeric & categorical columns
  const numericCols = [];
  const catCols = [];

  for (const c of cols) {
    let numCount = 0;
    let nonNull = 0;
    for (let i = 0; i < Math.min(50, rows.length); i++) {
      const v = rows[i][c];
      if (v !== null && v !== undefined && v !== '') {
        nonNull++;
        if (!isNaN(Number(v))) numCount++;
      }
    }
    if (nonNull > 0 && numCount / nonNull >= 0.8) {
      numericCols.push(c);
    } else {
      catCols.push(c);
    }
  }

  // Helper to find mentioned column
  const mentionedCol = findMentionedCol(q, cols);

  // 1. Summary / Overview
  if (['summary', 'overview', 'describe', 'tell me about', 'what is this'].some(k => q.includes(k))) {
    const lines = [
      `📊 **Dataset Overview**`,
      `- **Total Records**: ${rows.length.toLocaleString()}`,
      `- **Columns**: ${cols.length} (${numericCols.length} numeric, ${catCols.length} categorical)`,
      `- **Numeric features**: ${numericCols.slice(0, 5).join(', ')}${numericCols.length > 5 ? '...' : ''}`,
      `- **Categorical features**: ${catCols.slice(0, 5).join(', ')}${catCols.length > 5 ? '...' : ''}`,
    ];
    return { answer: lines.join('\n'), chart: null };
  }

  // 2. Average / Mean
  if (['average', 'avg', 'mean'].some(k => q.includes(k))) {
    // Check if user asked "average X by Y" or "average X per Y"
    if (catCols.length > 0 && numericCols.length > 0 && (q.includes(' by ') || q.includes(' per '))) {
      const targetCat = catCols.find(c => q.includes(c.toLowerCase())) || catCols[0];
      const targetNum = numericCols.find(c => q.includes(c.toLowerCase())) || numericCols[0];
      return groupAverage(rows, targetCat, targetNum);
    }

    const col = mentionedCol && numericCols.includes(mentionedCol) ? mentionedCol : numericCols[0];
    if (col) {
      const nums = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
      const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      return {
        answer: `The average **${col}** is **${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}** across ${nums.length} records.`,
        chart: null,
      };
    }
  }

  // 3. Maximum / Highest / Top
  if (['highest', 'maximum', 'max', 'largest', 'top', 'biggest'].some(k => q.includes(k))) {
    const col = mentionedCol && numericCols.includes(mentionedCol) ? mentionedCol : numericCols[0];
    if (col) {
      let maxVal = -Infinity;
      let topRow = null;
      rows.forEach(r => {
        const v = Number(r[col]);
        if (!isNaN(v) && v > maxVal) {
          maxVal = v;
          topRow = r;
        }
      });
      const topInfo = Object.entries(topRow || {})
        .slice(0, 5)
        .map(([k, v]) => `**${k}**: ${v}`)
        .join(', ');
      return {
        answer: `The highest **${col}** is **${maxVal.toLocaleString()}**.\n\nRecord details: ${topInfo}`,
        chart: null,
      };
    }
  }

  // 4. Minimum / Lowest / Smallest
  if (['lowest', 'minimum', 'min', 'smallest', 'bottom'].some(k => q.includes(k))) {
    const col = mentionedCol && numericCols.includes(mentionedCol) ? mentionedCol : numericCols[0];
    if (col) {
      let minVal = Infinity;
      let bottomRow = null;
      rows.forEach(r => {
        const v = Number(r[col]);
        if (!isNaN(v) && v < minVal) {
          minVal = v;
          bottomRow = r;
        }
      });
      const bottomInfo = Object.entries(bottomRow || {})
        .slice(0, 5)
        .map(([k, v]) => `**${k}**: ${v}`)
        .join(', ');
      return {
        answer: `The lowest **${col}** is **${minVal.toLocaleString()}**.\n\nRecord details: ${bottomInfo}`,
        chart: null,
      };
    }
  }

  // 5. Total Count / How many
  if (['how many', 'count', 'total'].some(k => q.includes(k))) {
    if (mentionedCol) {
      if (catCols.includes(mentionedCol)) {
        const counts = {};
        rows.forEach(r => {
          const v = r[mentionedCol] || '(Blank)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5).map(([k, v]) => `- **${k}**: ${v}`).join('\n');
        const chartData = {
          data: [{
            x: sorted.slice(0, 10).map(s => s[0]),
            y: sorted.slice(0, 10).map(s => s[1]),
            type: 'bar',
            marker: { color: '#C9A76A' },
          }],
          layout: { title: `Frequency Breakdown: ${mentionedCol}`, xaxis: { title: mentionedCol }, yaxis: { title: 'Count' } },
        };
        return {
          answer: `**${mentionedCol}** contains **${sorted.length}** distinct categories:\n\n${top5}`,
          chart: chartData,
        };
      } else {
        const nonNull = rows.filter(r => r[mentionedCol] !== null && r[mentionedCol] !== undefined).length;
        return {
          answer: `**${mentionedCol}** has **${nonNull.toLocaleString()}** valid values out of **${rows.length.toLocaleString()}** total rows.`,
          chart: null,
        };
      }
    }
    return {
      answer: `The dataset contains **${rows.length.toLocaleString()}** total rows and **${cols.length}** columns.`,
      chart: null,
    };
  }

  // 6. Distribution / Histogram
  if (['distribution', 'histogram', 'spread'].some(k => q.includes(k))) {
    const col = mentionedCol && numericCols.includes(mentionedCol) ? mentionedCol : numericCols[0];
    if (col) {
      const vals = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
      vals.sort((a, b) => a - b);
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      const median = vals[Math.floor(vals.length / 2)];
      const min = vals[0];
      const max = vals[vals.length - 1];
      const chart = {
        data: [{ x: vals, type: 'histogram', marker: { color: '#C9A76A' }, nbinsx: 25 }],
        layout: { title: `Distribution of ${col}`, xaxis: { title: col }, yaxis: { title: 'Frequency' } },
      };
      return {
        answer: `**${col}** statistics:\n- **Mean**: ${m.toFixed(2)}\n- **Median**: ${median}\n- **Range**: [${min}, ${max}]`,
        chart,
      };
    }
  }

  // 7. Missing / Null Values
  if (['missing', 'null', 'empty', 'blank'].some(k => q.includes(k))) {
    const missing = [];
    cols.forEach(c => {
      let count = 0;
      rows.forEach(r => {
        if (r[c] === null || r[c] === undefined || r[c] === '') count++;
      });
      if (count > 0) {
        missing.push(`- **${c}**: ${count} missing (${((count / rows.length) * 100).toFixed(1)}%)`);
      }
    });
    if (missing.length > 0) {
      return { answer: `Columns with missing values:\n\n${missing.join('\n')}`, chart: null };
    }
    return { answer: '✅ Excellent data hygiene! No missing or null values found.', chart: null };
  }

  // 8. Breakdown / Group By
  if (['group', 'by', 'breakdown', 'per'].some(k => q.includes(k)) && catCols.length > 0 && numericCols.length > 0) {
    const targetCat = catCols.find(c => q.includes(c.toLowerCase())) || catCols[0];
    const targetNum = numericCols.find(c => q.includes(c.toLowerCase())) || numericCols[0];
    return groupAverage(rows, targetCat, targetNum);
  }

  // 9. Specific Column Query
  if (mentionedCol) {
    if (numericCols.includes(mentionedCol)) {
      const vals = rows.map(r => Number(r[mentionedCol])).filter(v => !isNaN(v));
      const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return {
        answer: `Column **${mentionedCol}** (Numeric):\n- **Count**: ${vals.length}\n- **Average**: ${avg.toFixed(2)}\n- **Range**: [${min}, ${max}]`,
        chart: {
          data: [{ x: vals, type: 'histogram', marker: { color: '#C9A76A' } }],
          layout: { title: `Distribution of ${mentionedCol}` },
        },
      };
    } else {
      const counts = {};
      rows.forEach(r => { counts[r[mentionedCol]] = (counts[r[mentionedCol]] || 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return {
        answer: `Column **${mentionedCol}** (Categorical):\n- **Unique Values**: ${Object.keys(counts).length}\n- **Top Values**: ${top.map(t => `${t[0]} (${t[1]})`).join(', ')}`,
        chart: {
          data: [{ x: top.map(t => t[0]), y: top.map(t => t[1]), type: 'bar', marker: { color: '#C9A76A' } }],
          layout: { title: `Top ${mentionedCol}` },
        },
      };
    }
  }

  // Fallback: Default Summary
  return {
    answer: `I analyzed your query for this dataset (${rows.length.toLocaleString()} rows, ${cols.length} columns). Try asking specific questions like:\n- *"What is the average ${numericCols[0] || 'value'}?"*\n- *"Highest ${numericCols[1] || numericCols[0] || 'value'}?"*\n- *"Breakdown of ${numericCols[0] || 'data'} by ${catCols[0] || 'category'}?"*\n- *"Show missing data"*`,
    chart: null,
  };
}

function groupAverage(rows, catCol, numCol) {
  const groups = {};
  rows.forEach(r => {
    const cat = r[catCol] || '(Blank)';
    const val = Number(r[numCol]);
    if (!isNaN(val)) {
      if (!groups[cat]) groups[cat] = { sum: 0, count: 0 };
      groups[cat].sum += val;
      groups[cat].count++;
    }
  });

  const averages = Object.entries(groups)
    .map(([cat, d]) => ({ category: cat, avg: d.sum / (d.count || 1) }))
    .sort((a, b) => b.avg - a.avg);

  const top10 = averages.slice(0, 10);
  const lines = top10.map(a => `- **${a.category}**: ${a.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

  const chart = {
    data: [{
      x: top10.map(a => a.category),
      y: top10.map(a => parseFloat(a.avg.toFixed(2))),
      type: 'bar',
      marker: { color: '#C9A76A' },
    }],
    layout: {
      title: `Average ${numCol} by ${catCol}`,
      xaxis: { title: catCol },
      yaxis: { title: `Avg ${numCol}` },
    },
  };

  return {
    answer: `Average **${numCol}** grouped by **${catCol}**:\n\n${lines.join('\n')}`,
    chart,
  };
}

function findMentionedCol(query, columns) {
  const q = query.toLowerCase();
  for (const c of columns) {
    if (q.includes(c.toLowerCase())) return c;
  }
  for (const c of columns) {
    const parts = c.toLowerCase().split(/[_\s]+/);
    if (parts.some(p => p.length >= 4 && q.includes(p))) return c;
  }
  return null;
}
