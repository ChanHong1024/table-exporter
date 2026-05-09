document.addEventListener('DOMContentLoaded', async () => {
  const resultsDiv = document.getElementById('results');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 1. Automatically scan and get metadata for hints
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getTableMetadata,
  }, (injectionResults) => {
    if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
      resultsDiv.innerHTML = '<p>Unable to access this page.</p>';
      return;
    }

    const tables = injectionResults[0].result;
    
    if (tables.length === 0) {
      resultsDiv.innerHTML = '<p>No HTML tables detected.</p>';
      return;
    }

    resultsDiv.innerHTML = ''; 

    // 2. Build UI with Hints
    tables.forEach((table, i) => {
      const card = document.createElement('div');
      card.className = 'table-card';
      
      // Hint 1: Table ID or Class
      const identifier = table.id ? `#${table.id}` : (table.className ? `.${table.className.split(' ')[0]}` : `Table ${i+1}`);

      // Hint 2: Preview of headers or first row
      const previewText = table.preview.length > 0 
        ? ` Preview: ${table.preview.join(', ').substring(0, 60)}...` 
        : 'Empty table';

      card.innerHTML = `
        <div class="table-title">${identifier}</div>
        <div class="table-hint">${previewText}</div>
        <div class="btn-group">
          <button class="btn-csv" id="csv-${i}">CSV</button>
          <button class="btn-xlsx" id="xlsx-${i}">XLSX</button>
        </div>
      `;
      
      resultsDiv.appendChild(card);

      // Event listeners for buttons
      document.getElementById(`csv-${i}`).onclick = () => extractAndBuild(tab.id, i, 'csv');
      document.getElementById(`xlsx-${i}`).onclick = () => extractAndBuild(tab.id, i, 'xlsx');
    });
  });
});

// New logic to get metadata for hints
function getTableMetadata() {
  const tables = document.querySelectorAll('table');
  return Array.from(tables).map(t => {
    // Get the first row (headers or data) for a preview
    const firstRow = t.querySelector('tr');
    const previewCells = firstRow 
      ? Array.from(firstRow.querySelectorAll('th, td')).slice(0, 3).map(c => c.innerText.trim())
      : [];
      
    return {
      id: t.id,
      className: t.className,
      preview: previewCells
    };
  });
}

// (The extractAndBuild and getTableDataAsArray functions remain the same as the previous step)
function extractAndBuild(tabId, tableIndex, format) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: getTableDataAsArray,
    args: [tableIndex]
  }, (results) => {
    const tableData = results[0].result;
    if (!tableData) return;
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `table_${tableIndex + 1}.${format}`);
  });
}

function getTableDataAsArray(tableIndex) {
  const table = document.querySelectorAll('table')[tableIndex];
  if (!table) return null;
  return Array.from(table.querySelectorAll('tr')).map(row => {
    return Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText.trim());
  });
}