import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Mock components for Radix UI


const Tabs = ({ children, defaultValue, value, onValueChange }) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultValue);
  const activeTab = value ?? internalActiveTab;

  const changeTab = (nextValue) => {
    if (onValueChange) {
      onValueChange(nextValue);
      return;
    }
    setInternalActiveTab(nextValue);
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-lg">
        {React.Children.map(children, child => {
          if (child.props.value) {
            return (
              <button
                onClick={() => changeTab(child.props.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${activeTab === child.props.value ? 'bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {child.props.label || child.props.value}
              </button>
            );
          }
          return null;
        })}
      </div>
      {React.Children.map(children, child => {
        if (child.props.value === activeTab) {
          return child;
        }
        return null;
      })}
    </div>
  );
};

const TabsContent = ({ children }) => <div>{children}</div>;






const Input = ({ type = 'text', value, onChange, onBlur, className = '', ...props }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    onBlur={onBlur}
    className={`w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

const Button = ({ children, onClick, className = '', ...props }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md font-medium transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Select = ({ name, value, onChange, children, ...props }) => (
  <select
    name={name}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    {...props}
  >
    {children}
  </select>
);

const Table = ({ children }) => <div className="overflow-x-auto"><table className="w-full bg-gray-700 rounded-lg overflow-hidden">{children}</table></div>;
const TableHeader = ({ children }) => <thead className="bg-gray-800">{children}</thead>;
const TableBody = ({ children }) => <tbody>{children}</tbody>;
const TableHead = ({ children }) => <th className="px-4 py-2 text-center text-sm font-medium text-gray-300 align-middle">{children}</th>;
const TableRow = ({ children }) => <tr className="border-b border-gray-600 hover:bg-gray-600">{children}</tr>;
const TableCell = ({ children }) => <td className="px-4 py-2 text-sm text-center align-middle">{children}</td>;


const prepareSearchResults = (stones) => {
  const groupedByPallet = {};

  (Array.isArray(stones) ? stones : []).forEach(stone => {
    if (!groupedByPallet[stone.palletNumber]) {
      groupedByPallet[stone.palletNumber] = {
        palletNumber: stone.palletNumber,
        stones: [],
        totalArea: 0
      };
    }
    groupedByPallet[stone.palletNumber].stones.push(stone);
    groupedByPallet[stone.palletNumber].totalArea += stone.area;
  });

  return Object.values(groupedByPallet);
};

const createEntryRow = (defaults = {}) => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  palletNumber: defaults.palletNumber || '',
  type: defaults.type || '',
  cutCode: defaults.cutCode || '',
  grade: defaults.grade || '',
  thickness: defaults.thickness || '',
  length: '',
  width: '',
  quantity: '1',
  notes: '',
});



export default function StoneInventoryApp() {
  const [activeTab, setActiveTab] = useState('input');
  const [stoneTypes, setStoneTypes] = useState(['Granite', 'Marble', 'Limestone']);
  const [newStoneType, setNewStoneType] = useState('');
  const [stones, setStones] = useState([]);
  const [filters, setFilters] = useState({
    showSold: false,
    type: '',
    palletNumber: '',
    grade: '',
    minLength: '',
    maxLength: '',
    minWidth: '',
    maxWidth: '',
    minThickness: '',
    maxThickness: '',
    cutCode: '',
    invoiceNumber: ''
  });
  const [palletDetails, setPalletDetails] = useState(null);
  const [palletNumberInput, setPalletNumberInput] = useState('');

  const [selectedPallets, setSelectedPallets] = useState([]);
  const [bulkInvoiceNumber, setBulkInvoiceNumber] = useState('');
  const [settings, setSettings] = useState({
    showLogoInPdf: true,
    showQrInPdf: true,
    enableFormDefaults: true,
    pdfFontScale: 1.15,
    pdfHeaderText: '',
    customLogoDataUrl: '',
  });

  const [lastEntryDefaults, setLastEntryDefaults] = useState({
    type: '',
    cutCode: '',
    grade: '',
    thickness: '',
  });
  const [entryRows, setEntryRows] = useState(() => [createEntryRow()]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const persistData = async (dataToSave) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveData(dataToSave);
        setLastUpdatedAt(new Date());
        return;
      }
      localStorage.setItem('stone-inventory-data', JSON.stringify(dataToSave));
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to save inventory data:', error);
    }
  };

  // بارگذاری داده‌ها
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electronAPI) {
          const data = await window.electronAPI.loadData();
          if (data) {
            const loadedStones = Array.isArray(data.stones) ? data.stones : [];
            const loadedStoneTypes = Array.isArray(data.stoneTypes) && data.stoneTypes.length > 0
              ? data.stoneTypes
              : ['Granite', 'Marble', 'Limestone'];
            setStones(loadedStones);
            setStoneTypes(loadedStoneTypes);
            if (data.settings) {
              setSettings((prev) => ({ ...prev, ...data.settings }));
            }
          }
          return;
        }

        const raw = localStorage.getItem('stone-inventory-data');
        if (!raw) return;
        const data = JSON.parse(raw);
        const loadedStones = Array.isArray(data.stones) ? data.stones : [];
        const loadedStoneTypes = Array.isArray(data.stoneTypes) && data.stoneTypes.length > 0
          ? data.stoneTypes
          : ['Granite', 'Marble', 'Limestone'];
        setStones(loadedStones);
        setStoneTypes(loadedStoneTypes);
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      } catch (error) {
        console.error('Failed to load inventory data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ذخیره‌سازی سریع بعد از تغییرات
  useEffect(() => {
    if (isLoading) return undefined;
    const dataToSave = {
      stones: Array.isArray(stones) ? stones : [],
      stoneTypes: Array.isArray(stoneTypes) ? stoneTypes : ['Granite', 'Marble', 'Limestone'],
      settings,
    };
    const timeout = setTimeout(() => {
      persistData(dataToSave);
    }, 300);

    return () => clearTimeout(timeout);
  }, [stones, stoneTypes, settings, isLoading]);

  // ذخیره‌سازی نهایی هنگام بستن/ریلـود
  useEffect(() => {
    const handleBeforeUnload = () => {
      const dataToSave = {
      stones: Array.isArray(stones) ? stones : [],
      stoneTypes: Array.isArray(stoneTypes) ? stoneTypes : ['Granite', 'Marble', 'Limestone'],
      settings,
    };

      if (window.electronAPI) {
        window.electronAPI.saveData(dataToSave);
      } else {
        localStorage.setItem('stone-inventory-data', JSON.stringify(dataToSave));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stones, stoneTypes, settings]);


  const normalizePalletInput = (rawValue) => {
    const cleaned = String(rawValue || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const letterMatch = cleaned.match(/[A-Z]/);
    if (!letterMatch) return '';

    const letter = letterMatch[0];
    const rest = cleaned.slice(cleaned.indexOf(letter) + 1);
    const digits = rest.replace(/[^0-9]/g, '').slice(0, 3);

    return `${letter}${digits}`;
  };

  const formatPalletOnBlur = (rawValue) => {
    const normalized = normalizePalletInput(rawValue);
    const match = normalized.match(/^([A-Z])(\d{1,3})$/);
    if (!match) return '';
    return `${match[1]}-${match[2]}`;
  };

  const updateEntryRow = (id, field, value) => {
    setEntryRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [field]: value };
      if (field === 'palletNumber') next.palletNumber = normalizePalletInput(value);
      return next;
    }));
  };

  const formatEntryPallet = (id) => {
    setEntryRows((rows) => rows.map((row) => row.id === id
      ? { ...row, palletNumber: formatPalletOnBlur(row.palletNumber) }
      : row));
  };

  const addEntryRow = (seed = {}) => {
    setEntryRows((rows) => [...rows, createEntryRow({
      palletNumber: seed.palletNumber || rows.at(-1)?.palletNumber,
      type: seed.type || rows.at(-1)?.type || lastEntryDefaults.type,
      cutCode: seed.cutCode || lastEntryDefaults.cutCode,
      grade: seed.grade || rows.at(-1)?.grade || lastEntryDefaults.grade,
      thickness: seed.thickness || rows.at(-1)?.thickness || lastEntryDefaults.thickness,
    })]);
  };

  const removeEntryRow = (id) => {
    setEntryRows((rows) => rows.length === 1 ? [createEntryRow()] : rows.filter((row) => row.id !== id));
  };

  const saveEntryRows = () => {
    const rowsToSave = entryRows.filter((row) => [row.palletNumber, row.type, row.cutCode, row.grade, row.thickness, row.length, row.width, row.notes].some((value) => String(value || '').trim() !== ''));
    const errors = rowsToSave.filter((row) => (
      !/^[A-Z]-\d{1,3}$/.test(formatPalletOnBlur(row.palletNumber))
      || !row.type || row.cutCode === '' || !row.length || !row.width || !row.quantity
      || Number(row.length) <= 0 || Number(row.width) <= 0 || Number(row.quantity) <= 0
    ));

    if (rowsToSave.length === 0) {
      alert('حداقل یک ردیف را کامل کنید.');
      return;
    }
    if (errors.length > 0) {
      alert(`اطلاعات ${errors.length} ردیف کامل یا معتبر نیست. شماره پالت را مانند A-123 وارد کنید.`);
      return;
    }

    const now = Date.now();
    const newStones = rowsToSave.map((row, index) => {
      const length = Number(row.length) / 100;
      const width = Number(row.width) / 100;
      const quantity = Number(row.quantity);
      const palletNumber = formatPalletOnBlur(row.palletNumber);
      return {
        ...row,
        id: `${now}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        palletNumber,
        invoiceNumber: getPalletInvoice(palletNumber),
        thickness: row.thickness === '' ? 0 : Number(row.thickness) / 100,
        length: Math.max(length, width),
        width: Math.min(length, width),
        quantity,
        area: Number((length * width * quantity).toFixed(2)),
        createdAt: new Date().toISOString(),
      };
    });

    setStones((current) => [...newStones, ...current]);
    const lastRow = rowsToSave.at(-1);
    setLastEntryDefaults({ type: lastRow.type, cutCode: lastRow.cutCode, grade: lastRow.grade, thickness: lastRow.thickness });
    setEntryRows([createEntryRow({ ...lastRow, palletNumber: formatPalletOnBlur(lastRow.palletNumber) })]);
    alert(`${newStones.length} آیتم با موفقیت ثبت شد.`);
  };

  const handleEntryKeyDown = (event, rowIndex, fieldIndex) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const row = entryRows[rowIndex];
    const fieldNames = ['palletNumber', 'type', 'cutCode', 'grade', 'thickness', 'length', 'width', 'quantity', 'notes'];
    if (fieldIndex === fieldNames.length - 1) {
      addEntryRow(row);
      requestAnimationFrame(() => document.querySelector(`[data-entry-row="${rowIndex + 1}"][data-entry-field="0"] input, [data-entry-row="${rowIndex + 1}"][data-entry-field="0"] select`)?.focus());
      return;
    }
    document.querySelector(`[data-entry-row="${rowIndex}"][data-entry-field="${fieldIndex + 1}"] input, [data-entry-row="${rowIndex}"][data-entry-field="${fieldIndex + 1}"] select`)?.focus();
  };

  const normalizedStones = Array.isArray(stones) ? stones : [];
  const normalizedStoneTypes = Array.isArray(stoneTypes) && stoneTypes.length > 0
    ? stoneTypes
    : ['Granite', 'Marble', 'Limestone'];



  function getPalletInvoice(palletNumber) {
    const invoices = [...new Set(
      normalizedStones
        .filter((stone) => stone.palletNumber === palletNumber)
        .map((stone) => String(stone.invoiceNumber || '').trim())
        .filter(Boolean)
    )];

    return invoices[0] || '';
  }

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: type === 'checkbox' ? checked : value };

      if (name === 'type' && value && !normalizedStoneTypes.includes(value)) {
        newFilters.type = '';
      }

      return newFilters;
    });
  };

  const filteredStones = normalizedStones.filter(stone => {
    const palletInvoice = getPalletInvoice(stone.palletNumber);
    if (!filters.showSold && palletInvoice) return false;
    if (filters.type && stone.type !== filters.type) return false;
    if (filters.palletNumber && !stone.palletNumber.includes(filters.palletNumber)) return false;
    if (filters.grade && stone.grade !== filters.grade) return false;
    if (filters.cutCode && String(stone.cutCode) !== String(filters.cutCode)) return false;
    if (filters.invoiceNumber && palletInvoice !== filters.invoiceNumber) return false;

    const thickness = parseFloat(stone.thickness);
    if (filters.minThickness && thickness < parseFloat(filters.minThickness)) return false;
    if (filters.maxThickness && thickness > parseFloat(filters.maxThickness)) return false;

    const length = parseFloat(stone.length);
    if (filters.minLength && length < parseFloat(filters.minLength)) return false;
    if (filters.maxLength && length > parseFloat(filters.maxLength)) return false;

    const width = parseFloat(stone.width);
    if (filters.minWidth && width < parseFloat(filters.minWidth)) return false;
    if (filters.maxWidth && width > parseFloat(filters.maxWidth)) return false;

    return true;
  }).sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || Number(a.id) || 0;
    const bTime = Date.parse(b.createdAt) || Number(b.id) || 0;
    return bTime - aTime;
  });

  const totalFilteredArea = filteredStones.reduce((sum, stone) => sum + stone.area, 0).toFixed(2);

  const calculatePalletArea = (palletNumber) => {
    return stones
      .filter(stone => stone.palletNumber === palletNumber)
      .reduce((sum, stone) => sum + stone.area, 0)
      .toFixed(2);
  };

  const handlePalletSearch = () => {
    const palletStones = normalizedStones.filter(stone => stone.palletNumber === palletNumberInput);

    if (palletStones.length > 0) {
      setPalletDetails({
        palletNumber: palletNumberInput,
        stones: palletStones,
        totalArea: calculatePalletArea(palletNumberInput)
      });
    } else {
      alert(`سنگی برای شماره پالت پیدا نشد: ${palletNumberInput}`);
      setPalletDetails(null);
    }
  };




  const normalizePdfText = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);

    // Handle mojibake cases like: þåþŽû...
    const hasExtendedLatin = /[À-ÿ]/.test(text);
    if (hasExtendedLatin) {
      try {
        const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (/[؀-ۿ]/.test(decoded)) {
          return decoded;
        }
      } catch {
        // keep original text
      }
    }

    return text;
  };

  const escapeHtml = (value) => normalizePdfText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const loadLogoDataUrl = async () => {
    const logoCandidates = ['./logo.png', '/logo.png', './build/logo.png'];

    for (const logoPath of logoCandidates) {
      try {
        const response = await fetch(logoPath);
        if (!response.ok) continue;

        const blob = await response.blob();
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        if (typeof dataUrl === 'string') {
          return dataUrl;
        }
      } catch {
        // ignore and try next path
      }
    }

    return null;
  };


  const loadQrDataUrl = async () => {
    try {
    return await QRCode.toDataURL('https://agse.ir/', {
        width: 165,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    } catch {
      return null;
    }
  };


  const getEffectiveLogoDataUrl = async () => {
    if (settings.customLogoDataUrl) return settings.customLogoDataUrl;
    return loadLogoDataUrl();
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        handleSettingsChange('customLogoDataUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const buildPdfHtml = ({ title, subtitle, headers, rows, logoDataUrl, qrDataUrl, fontScale = 1, darkTable = false, headerText = '' }) => {
    const borderColor = darkTable ? '#000000' : '#dddddd';
    const headerBg = darkTable ? '#000000' : '#f3f4f6';
    const headerColor = darkTable ? '#ffffff' : '#111111';
    const titleFontSize = Math.round(24 * fontScale);
    const subtitleFontSize = Math.round(16 * fontScale);
    const tableFontSize = Math.round(12 * fontScale);
    const numericFontSize = Math.round(tableFontSize * 1.25);
    const cellPadding = Math.max(2, Math.round(2 * fontScale));

    const headersHtml = headers.map((header) => `<th style="border:2px solid ${borderColor};padding:${cellPadding}px;background:${headerBg};color:${headerColor};font-weight:900;word-break:break-word;white-space:nowrap">${escapeHtml(header)}</th>`).join('');
    const rowsHtml = rows.map((row) => (
      `<tr>${row.map((cell) => { const text = escapeHtml(cell); const isNumeric = /^[-+]?\d+(?:[.,]\d+)?$/.test(String(text).trim()); return `<td style="border:2px solid ${borderColor};padding:${cellPadding}px;word-break:break-word;font-weight:${isNumeric ? 900 : 700};font-size:${isNumeric ? numericFontSize : tableFontSize}px">${text}</td>`; }).join('')}</tr>`
    )).join('');

    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="logo" style="height:144px;width:216px;object-fit:contain" />`
      : '<div style="height:144px;width:216px"></div>';

    const qrHtml = qrDataUrl
      ? `<img src="${qrDataUrl}" alt="qr" style="height:144px;width:144px;object-fit:contain" />`
      : '<div style="height:144px;width:144px"></div>';

    return `
      <div dir="ltr" style="font-family:'Vazirmatn','Tahoma','Segoe UI',Arial,sans-serif;padding:16px;color:#111;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;direction:ltr;margin-bottom:8px;gap:12px">
          <div>${logoHtml}</div>
          <div style="flex:1;text-align:center;font-size:${Math.round(18 * fontScale)}px;font-weight:800">${escapeHtml(headerText || '-')}</div>
          <div>${qrHtml}</div>
        </div>
        <h2 style="text-align:center;margin:0 0 10px 0;font-size:${titleFontSize}px;font-weight:900">${escapeHtml(title)}</h2>
        <p style="text-align:center;margin:0 0 14px 0;font-size:${subtitleFontSize}px;font-weight:800">${escapeHtml(subtitle)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:${tableFontSize}px;text-align:center;direction:ltr;font-weight:800;table-layout:auto">
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  };

  const exportHtmlPdf = async ({ htmlContent, htmlPages, fileName }) => {
    const pages = Array.isArray(htmlPages) && htmlPages.length > 0 ? htmlPages : [htmlContent];
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    for (let i = 0; i < pages.length; i += 1) {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.pointerEvents = 'none';
      container.style.width = '760px';
      container.style.background = '#ffffff';
      container.style.zIndex = '-1';
      container.innerHTML = pages[i];
      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        if (i > 0) doc.addPage();

        const renderedHeight = (canvas.height * printableWidth) / canvas.width;
        const scaleRatio = renderedHeight > printableHeight ? (printableHeight / renderedHeight) : 1;
        const drawWidth = printableWidth * scaleRatio;
        const drawHeight = renderedHeight * scaleRatio;
        const drawX = margin + ((printableWidth - drawWidth) / 2);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', drawX, margin, drawWidth, drawHeight);
      } finally {
        document.body.removeChild(container);
      }
    }

    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = blobUrl;
    download.download = fileName || 'stone-inventory.pdf';
    download.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const generatePalletPDF = async () => {
    if (!palletDetails || palletDetails.stones.length === 0) {
      alert('داده‌ای برای خروجی PDF کارت پالت وجود ندارد.');
      return;
    }

    const rows = palletDetails.stones.map((stone, index) => ([
      index + 1,
      stone.type,
      Number(stone.thickness).toFixed(2),
      Number(stone.length).toFixed(2),
      Number(stone.width).toFixed(2),
      stone.quantity,
      Number(stone.area).toFixed(2),
    ]));

    const logoDataUrl = settings.showLogoInPdf ? await getEffectiveLogoDataUrl() : null;
    const qrDataUrl = settings.showQrInPdf ? await loadQrDataUrl() : null;

    const chunkSize = 10;
    const rowChunks = [];
    for (let i = 0; i < rows.length; i += chunkSize) rowChunks.push(rows.slice(i, i + chunkSize));

    const htmlPages = rowChunks.map((chunk, idx) => buildPdfHtml({
      title: `Pallet Card: ${palletDetails.palletNumber}`,
      subtitle: `Total Area: ${Number(palletDetails.totalArea).toFixed(2)} m² | Page ${idx + 1}/${rowChunks.length}`,
      headers: ['#', 'Type', 'Thk', 'Len', 'Wid', 'Qty', 'Area'],
      rows: chunk,
      logoDataUrl,
      qrDataUrl,
      fontScale: settings.pdfFontScale,
      darkTable: true,
      headerText: settings.pdfHeaderText,
    }));

    await exportHtmlPdf({ htmlPages, fileName: `pallet-${palletDetails.palletNumber}.pdf` });
  };

  const generateSearchPDF = async () => {
      if (filteredStones.length === 0) {
        alert('هیچ سنگی با فیلترهای انتخابی پیدا نشد.');
        return;
      }

      const rows = filteredStones.map(stone => [
        stone.type,
        stone.cutCode,
        stone.palletNumber,
        stone.grade,
        Number(stone.thickness).toFixed(2),
        Number(stone.length).toFixed(2),
        Number(stone.width).toFixed(2),
        stone.quantity,
        Number(stone.area).toFixed(2),
        getPalletInvoice(stone.palletNumber) || '-',
        getPalletInvoice(stone.palletNumber) ? 'Sold' : 'In Stock',
      ]);

      const logoDataUrl = settings.showLogoInPdf ? await getEffectiveLogoDataUrl() : null;
      const qrDataUrl = settings.showQrInPdf ? await loadQrDataUrl() : null;

      const htmlContent = buildPdfHtml({
        title: 'Search Report',
        subtitle: `Count: ${filteredStones.length} | Total Area: ${totalFilteredArea} m²`,
        headers: ['Stone Type', 'Cut Code', 'Pallet No', 'Grade', 'Thickness', 'Length', 'Width', 'Qty', 'Area', 'Invoice', 'Status'],
        rows,
        logoDataUrl,
        qrDataUrl,
        headerText: settings.pdfHeaderText,
      });

      await exportHtmlPdf({ htmlContent, fileName: `Search_Report_${new Date().toISOString().slice(0, 10)}.pdf` });
    };

 
    const generatePalletCardPDF = async (palletNumber, stones, totalArea) => {
      const rows = stones.map((stone, index) => [
        index + 1,
        stone.type,
        Number(stone.thickness).toFixed(2),
        Number(stone.length).toFixed(2),
        Number(stone.width).toFixed(2),
        stone.quantity,
        Number(stone.area).toFixed(2),
      ]);

      const logoDataUrl = settings.showLogoInPdf ? await getEffectiveLogoDataUrl() : null;
      const qrDataUrl = settings.showQrInPdf ? await loadQrDataUrl() : null;

      const chunkSize = 10;
      const rowChunks = [];
      for (let i = 0; i < rows.length; i += chunkSize) rowChunks.push(rows.slice(i, i + chunkSize));

      const htmlPages = rowChunks.map((chunk, idx) => buildPdfHtml({
        title: `Pallet Card: ${palletNumber}`,
        subtitle: `Total Area: ${Number(totalArea).toFixed(2)} m² | Page ${idx + 1}/${rowChunks.length}`,
        headers: ['#', 'Type', 'Thk', 'Len', 'Wid', 'Qty', 'Area'],
        rows: chunk,
        logoDataUrl,
        qrDataUrl,
        fontScale: settings.pdfFontScale,
        darkTable: true,
        headerText: settings.pdfHeaderText,
      }));

      await exportHtmlPdf({ htmlPages, fileName: `Pallet_Card_${palletNumber}.pdf` });
    };



  const addStoneType = () => {
    if (newStoneType.trim() && !normalizedStoneTypes.includes(newStoneType)) {
      setStoneTypes([...normalizedStoneTypes, newStoneType]);
      setNewStoneType('');
    }
  };



  const editPallet = (palletNumber) => {
    const palletItems = normalizedStones.filter((stone) => stone.palletNumber === palletNumber);
    if (palletItems.length === 0) return;

    const sampleStone = palletItems[0];
    setEntryRows([createEntryRow({
      palletNumber,
      type: sampleStone.type || '',
      cutCode: sampleStone.cutCode || '',
      grade: sampleStone.grade || '',
      thickness: sampleStone.thickness ? String(Number(sampleStone.thickness) * 100) : '',
    })]);
    setActiveTab('input');
  };

  const deletePallet = (palletNumber) => {
    if (window.confirm(`از حذف کل پالت ${palletNumber} مطمئن هستید؟`)) {
      setStones(normalizedStones.filter((stone) => stone.palletNumber !== palletNumber));
      setSelectedPallets((prev) => prev.filter((code) => code !== palletNumber));
    }
  };

  const togglePalletSelection = (palletNumber, checked) => {
    setSelectedPallets((prev) => {
      if (checked) return Array.from(new Set([...prev, palletNumber]));
      return prev.filter((code) => code !== palletNumber);
    });
  };

  const markSelectedPalletsAsSold = () => {
    const invoice = String(bulkInvoiceNumber || '').trim();
    if (!invoice) {
      alert('شماره فاکتور را وارد کنید.');
      return;
    }

    if (selectedPallets.length === 0) {
      alert('حداقل یک پالت انتخاب کنید.');
      return;
    }

    setStones((prev) => prev.map((stone) => (
      selectedPallets.includes(stone.palletNumber)
        ? { ...stone, invoiceNumber: invoice }
        : stone
    )));
    setBulkInvoiceNumber('');
    setSelectedPallets([]);
  };

  const clearSelectedPalletsInvoice = () => {
    if (selectedPallets.length === 0) {
      alert('حداقل یک پالت انتخاب کنید.');
      return;
    }

    setStones((prev) => prev.map((stone) => (
      selectedPallets.includes(stone.palletNumber)
        ? { ...stone, invoiceNumber: '' }
        : stone
    )));
    setSelectedPallets([]);
  };

  const handleSettingsChange = (name, value) => {
    setSettings((prev) => ({ ...prev, [name]: value }));

    if (name === 'enableFormDefaults' && value === false) {
      setLastEntryDefaults({ type: '', cutCode: '', grade: '', thickness: '' });
    }
  };

  const prepareChartData = () => {
    const typeAreas = {};
    const typeSoldAreas = {};

    normalizedStones.forEach(stone => {
      if (!typeAreas[stone.type]) {
        typeAreas[stone.type] = 0;
        typeSoldAreas[stone.type] = 0;
      }
      typeAreas[stone.type] += stone.area;
      if (getPalletInvoice(stone.palletNumber)) {
        typeSoldAreas[stone.type] += stone.area;
      }
    });

    return {
      labels: Object.keys(typeAreas),
      totalAreas: Object.values(typeAreas),
      soldAreas: Object.values(typeSoldAreas)
    };
  };

  const chartData = prepareChartData();

  const inventoryChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'متراژ کل (متر مربع)',
        data: chartData.totalAreas,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'متراژ فروخته‌شده (متر مربع)',
        data: chartData.soldAreas,
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        borderColor: 'rgba(220, 38, 38, 1)',
        borderWidth: 1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'متراژ انواع سنگ',
        color: '#ffffff'
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">مدیریت موجودی سنگ</h1>

      <Tabs defaultValue="input" value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="input" label="ثبت سریع">
          <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-semibold text-blue-300">ثبت سریع آیتم‌های سنگ</h2>
                <p className="text-sm text-gray-300 mt-1">هر ردیف یک آیتم است؛ با Enter بین خانه‌ها حرکت کنید و در انتهای ردیف، ردیف بعدی ساخته می‌شود. ابعاد و ضخامت را به سانتی‌متر وارد کنید.</p>
              </div>
              <div className="text-xs text-gray-400">{isLoading ? 'در حال بارگذاری اطلاعات…' : lastUpdatedAt ? `آخرین ذخیره: ${lastUpdatedAt.toLocaleTimeString('fa-IR')}` : 'ذخیره‌سازی خودکار فعال است'}</div>
            </div>
            <div className="overflow-x-auto border border-gray-600 rounded-lg">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-gray-700 text-gray-200">
                  <tr>
                    {['پالت', 'نوع سنگ', 'برش', 'درجه', 'ضخامت (cm)', 'طول (cm)', 'عرض (cm)', 'تعداد', 'یادداشت', 'متراژ', ''].map((label) => <th key={label} className="p-2 text-right font-medium">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {entryRows.map((row, rowIndex) => {
                    const area = ((Number(row.length || 0) * Number(row.width || 0) * Number(row.quantity || 0)) / 10000).toFixed(2);
                    const cells = [
                      <Input key="pallet" name="palletNumber" value={row.palletNumber} onChange={(e) => updateEntryRow(row.id, 'palletNumber', e.target.value)} onBlur={() => formatEntryPallet(row.id)} placeholder="A-123" />,
                      <Select key="type" value={row.type} onChange={(value) => updateEntryRow(row.id, 'type', value)}><option value="">انتخاب کنید</option>{normalizedStoneTypes.map((type) => <option key={type} value={type}>{type}</option>)}</Select>,
                      <Input key="cut" type="number" value={row.cutCode} onChange={(e) => updateEntryRow(row.id, 'cutCode', e.target.value)} min="0" max="999" />,
                      <Input key="grade" value={row.grade} onChange={(e) => updateEntryRow(row.id, 'grade', e.target.value.toUpperCase())} maxLength="1" />,
                      <Input key="thickness" type="number" value={row.thickness} onChange={(e) => updateEntryRow(row.id, 'thickness', e.target.value)} min="0" step="0.01" />,
                      <Input key="length" type="number" value={row.length} onChange={(e) => updateEntryRow(row.id, 'length', e.target.value)} min="0" step="0.01" />,
                      <Input key="width" type="number" value={row.width} onChange={(e) => updateEntryRow(row.id, 'width', e.target.value)} min="0" step="0.01" />,
                      <Input key="quantity" type="number" value={row.quantity} onChange={(e) => updateEntryRow(row.id, 'quantity', e.target.value)} min="1" step="1" />,
                      <Input key="notes" value={row.notes} onChange={(e) => updateEntryRow(row.id, 'notes', e.target.value)} placeholder="اختیاری" />,
                    ];
                    return <tr key={row.id} className="border-t border-gray-700 align-top">{cells.map((cell, fieldIndex) => <td key={fieldIndex} className="p-1"><div data-entry-row={rowIndex} data-entry-field={fieldIndex} onKeyDown={(e) => handleEntryKeyDown(e, rowIndex, fieldIndex)}>{cell}</div></td>)}<td className="p-2 text-blue-300 font-semibold whitespace-nowrap">{area} m²</td><td className="p-1"><Button type="button" onClick={() => removeEntryRow(row.id)} className="bg-red-700 hover:bg-red-600 px-2 py-2 text-xs" aria-label="حذف ردیف">×</Button></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-3 mt-4">
              <Button type="button" onClick={() => addEntryRow()} className="bg-gray-600 hover:bg-gray-500">+ افزودن ردیف</Button>
              <div className="flex gap-2"><Button type="button" onClick={() => setEntryRows([createEntryRow()])} className="bg-gray-600 hover:bg-gray-500">پاک‌کردن جدول</Button><Button type="button" onClick={saveEntryRows} className="bg-blue-600 hover:bg-blue-500">ثبت همه ردیف‌ها</Button></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="search" label="جستجو و بازبینی">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div><h2 className="text-xl font-semibold text-blue-300">جستجو و بازبینی سنگ‌ها</h2><p className="text-sm text-gray-300 mt-1">نتایج بر اساس جدیدترین ثبت مرتب شده‌اند.</p></div>
              <span className="rounded-full bg-blue-900/70 px-3 py-1 text-xs text-blue-200">{isLoading ? 'در حال همگام‌سازی…' : lastUpdatedAt ? `به‌روزرسانی: ${lastUpdatedAt.toLocaleTimeString('fa-IR')}` : 'اطلاعات آماده است'}</span>
            </div>

            {/* فیلترها */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="showSold"
                  checked={filters.showSold}
                  onChange={handleFilterChange}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 focus:ring-blue-500 ml-2"
                  id="showSold"
                />
                <label htmlFor="showSold" className="text-sm font-medium">نمایش اقلام فروخته‌شده</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">نوع سنگ</label>
                <Select name="type" value={filters.type} onChange={(value) => setFilters(prev => ({...prev, type: value}))}>
                  <option value="">All types</option>
                  {normalizedStoneTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">شماره پالت</label>
                <Input
                  name="palletNumber"
                  value={filters.palletNumber}
                  onChange={handleFilterChange}
                  placeholder="e.g., A-123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">درجه</label>
                <Input
                  name="grade"
                  value={filters.grade}
                  onChange={handleFilterChange}
                  maxLength="1"
                  placeholder="A-Z"
                  className="uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداقل طول (متر)</label>
                <Input
                  type="number"
                  name="minLength"
                  value={filters.minLength}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداکثر طول (متر)</label>
                <Input
                  type="number"
                  name="maxLength"
                  value={filters.maxLength}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداقل عرض (متر)</label>
                <Input
                  type="number"
                  name="minWidth"
                  value={filters.minWidth}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداکثر عرض (متر)</label>
                <Input
                  type="number"
                  name="maxWidth"
                  value={filters.maxWidth}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">کد برش</label>
                <Input
                  type="number"
                  name="cutCode"
                  value={filters.cutCode}
                  onChange={handleFilterChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداقل ضخامت (متر)</label>
                <Input
                  type="number"
                  name="minThickness"
                  value={filters.minThickness}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حداکثر ضخامت (متر)</label>
                <Input
                  type="number"
                  name="maxThickness"
                  value={filters.maxThickness}
                  onChange={handleFilterChange}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">شماره فاکتور</label>
                <Input
                  name="invoiceNumber"
                  value={filters.invoiceNumber}
                  onChange={handleFilterChange}
                />
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-700 rounded-lg">
              <p className="font-semibold">
                متراژ کل نتایج: <span className="text-blue-300">{totalFilteredArea} m²</span>
              </p>
              <p className="font-semibold">
                تعداد کل سنگ‌ها: <span className="text-blue-300">{filteredStones.length}</span>
              </p>
            </div>

            <div className="mb-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-blue-300 mb-3">ثبت فروش گروهی پالت‌ها</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">شماره فاکتور</label>
                  <Input value={bulkInvoiceNumber} onChange={(e) => setBulkInvoiceNumber(e.target.value)} placeholder="INV-1001" />
                </div>
                <Button onClick={markSelectedPalletsAsSold} className="bg-blue-600 hover:bg-blue-500">ثبت فروش برای پالت‌های انتخاب‌شده</Button>
                <Button onClick={clearSelectedPalletsInvoice} className="bg-orange-600 hover:bg-orange-500">حذف فاکتور از پالت‌های انتخاب‌شده</Button>
              </div>
              <p className="text-xs text-gray-300 mt-2">تعداد پالت انتخاب‌شده: {selectedPallets.length}</p>
            </div>

            <div className="mb-4 flex justify-end">
              <Button onClick={generateSearchPDF} className="bg-green-600 hover:bg-green-500">
                خروجی PDF
              </Button>
            </div>

            <div className="mb-6 bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-blue-300">نمای کلی موجودی</h3>
              <div className="h-64">
                <Bar data={inventoryChartData} options={chartOptions} />
              </div>
            </div>

            {/* نمایش سنگ‌ها بر اساس پالت */}
            <div className="space-y-6">
              {prepareSearchResults(filteredStones).map(palletGroup => (
                <div key={palletGroup.palletNumber} className="border border-gray-600 rounded-lg p-4 bg-gray-800">
                  <div className="flex justify-between items-center mb-2">
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedPallets.includes(palletGroup.palletNumber)}
                        onChange={(e) => togglePalletSelection(palletGroup.palletNumber, e.target.checked)}
                      />
                      انتخاب پالت
                    </label>
                    <h3 className="font-semibold text-lg text-blue-300">
                      پالت: {palletGroup.palletNumber}
                      <span className="text-sm text-gray-300 mr-2">متراژ کل: {palletGroup.totalArea.toFixed(2)} m²</span>
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => generatePalletCardPDF(palletGroup.palletNumber, palletGroup.stones, palletGroup.totalArea)}
                        className="bg-green-600 hover:bg-green-500 px-3 py-1 text-xs"
                      >
                        چاپ کارت پالت
                      </Button>
                      <Button
                        onClick={() => editPallet(palletGroup.palletNumber)}
                        className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 text-xs"
                      >
                        ویرایش پالت
                      </Button>
                      <Button
                        onClick={() => deletePallet(palletGroup.palletNumber)}
                        className="bg-red-600 hover:bg-red-500 px-3 py-1 text-xs"
                      >
                        حذف پالت
                      </Button>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نوع</TableHead>
                        <TableHead>کد برش</TableHead>
                        <TableHead>درجه</TableHead>
                        <TableHead>ضخامت (متر)</TableHead>
                        <TableHead>طول (متر)</TableHead>
                        <TableHead>عرض (متر)</TableHead>
                        <TableHead>تعداد</TableHead>
                        <TableHead>متراژ (متر مربع)</TableHead>
                        <TableHead>فاکتور</TableHead>
                        <TableHead>وضعیت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {palletGroup.stones.map(stone => (
                        <TableRow key={stone.id}>
                          <TableCell>{stone.type}</TableCell>
                          <TableCell>{stone.cutCode}</TableCell>
                          <TableCell>{stone.grade}</TableCell>
                          <TableCell>{stone.thickness.toFixed(2)}</TableCell>
                          <TableCell>{stone.length.toFixed(2)}</TableCell>
                          <TableCell>{stone.width.toFixed(2)}</TableCell>
                          <TableCell>{stone.quantity}</TableCell>
                          <TableCell>{stone.area.toFixed(2)}</TableCell>
                          <TableCell>{getPalletInvoice(stone.palletNumber) || '-'}</TableCell>
                          <TableCell>{getPalletInvoice(stone.palletNumber) ? 'فروخته‌شده' : 'در انبار'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>


        <TabsContent value="pallet" label="کارت پالت">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-300">کارت پالت</h2>

            <div className="mb-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">شماره پالت</label>
                  <Input
                    value={palletNumberInput}
                    onChange={(e) => setPalletNumberInput(e.target.value)}
                    placeholder="e.g., A-123"
                  />
                </div>
                <Button onClick={handlePalletSearch} className="mt-6 bg-blue-600 hover:bg-blue-500">
                  جستجو
                </Button>
              </div>
            </div>

            {palletDetails && (
              <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">پالت: {palletDetails.palletNumber}</h3>
                  <p className="mb-4">Total Area: {palletDetails.totalArea} m²</p>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>نوع</TableHead>
                        <TableHead>ضخامت (متر)</TableHead>
                        <TableHead>طول (متر)</TableHead>
                        <TableHead>عرض (متر)</TableHead>
                        <TableHead>تعداد</TableHead>
                        <TableHead>متراژ (متر مربع)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {palletDetails.stones.map((stone, index) => (
                        <TableRow key={stone.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{stone.type}</TableCell>
                          <TableCell>{stone.thickness.toFixed(2)}</TableCell>
                          <TableCell>{stone.length.toFixed(2)}</TableCell>
                          <TableCell>{stone.width.toFixed(2)}</TableCell>
                          <TableCell>{stone.quantity}</TableCell>
                          <TableCell>{stone.area.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex justify-end">
                    <Button onClick={generatePalletPDF} className="bg-green-600 hover:bg-green-500">
                      ساخت PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>


        <TabsContent value="settings" label="تنظیمات">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
            <h2 className="text-xl font-semibold text-blue-300">تنظیمات برنامه</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between bg-gray-700 p-3 rounded">
                <span>نمایش لوگو در PDF</span>
                <input
                  type="checkbox"
                  checked={settings.showLogoInPdf}
                  onChange={(e) => handleSettingsChange('showLogoInPdf', e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between bg-gray-700 p-3 rounded">
                <span>نمایش QR در PDF</span>
                <input
                  type="checkbox"
                  checked={settings.showQrInPdf}
                  onChange={(e) => handleSettingsChange('showQrInPdf', e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between bg-gray-700 p-3 rounded md:col-span-2">
                <span>فعال بودن دیفالت‌های فرم (نوع/برش/درجه/ضخامت)</span>
                <input
                  type="checkbox"
                  checked={settings.enableFormDefaults}
                  onChange={(e) => handleSettingsChange('enableFormDefaults', e.target.checked)}
                />
              </label>

              <div className="bg-gray-700 p-3 rounded md:col-span-2">
                <label className="block mb-2">اندازه فونت PDF کارت پالت: {settings.pdfFontScale.toFixed(2)}x</label>
                <input
                  type="range"
                  min="0.8"
                  max="4"
                  step="0.05"
                  value={settings.pdfFontScale}
                  onChange={(e) => handleSettingsChange('pdfFontScale', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="bg-gray-700 p-3 rounded md:col-span-2">
                <label className="block mb-2">متن سربرگ کارت پالت (بین لوگو و QR)</label>
                <Input
                  value={settings.pdfHeaderText}
                  onChange={(e) => handleSettingsChange('pdfHeaderText', e.target.value)}
                  placeholder="نام شرکت / توضیح دلخواه"
                />
              </div>

              <div className="bg-gray-700 p-3 rounded md:col-span-2">
                <label className="block mb-2">لوگوی سفارشی برای PDF</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoUpload}
                  className="w-full"
                />
                {settings.customLogoDataUrl && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-green-300">لوگوی سفارشی فعال است.</span>
                    <Button
                      type="button"
                      onClick={() => handleSettingsChange('customLogoDataUrl', '')}
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 text-xs"
                    >
                      حذف لوگوی سفارشی
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="types" label="انواع سنگ">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-300">مدیریت انواع سنگ</h2>

            <div className="flex space-x-4 mb-6">
              <Input
                value={newStoneType}
                onChange={(e) => setNewStoneType(e.target.value)}
                placeholder="نوع سنگ جدید"
                className="flex-1"
              />
              <Button onClick={addStoneType} className="bg-blue-600 hover:bg-blue-500">
                افزودن نوع
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>نوع سنگ</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {normalizedStoneTypes.map((type, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{type}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (window.confirm('از حذف این نوع سنگ مطمئن هستید؟')) {
                            const stonesUsingType = normalizedStones.some(stone => stone.type === type);
                            if (stonesUsingType) {
                              alert('حذف ممکن نیست: این نوع سنگ در رکوردها استفاده شده است');
                              return;
                            }
                            setStoneTypes(normalizedStoneTypes.filter(t => t !== type));
                          }
                        }}
                        className="bg-red-600 hover:bg-red-500 px-2 py-1 text-xs"
                      >
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
