import React, { useState, useEffect, useRef } from 'react';
import { 
  Library, 
  ScanBarcode, 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  BookOpen, 
  Settings, 
  ChevronRight,
  X,
  FileJson,
  FileSpreadsheet,
  FileText,
  Camera,
  Keyboard,
  Loader2,
  FolderOpen,
  HardDrive,
  BookMarked,
  MonitorDown,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy components
const Scanner = React.lazy(() => import('./components/Scanner'));

const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'cbz', 'mobi', 'djvu', 'azw3'];

const FORMAT_COLORS = {
  PDF:  '#ef4444',
  EPUB: '#22c55e',
  CBZ:  '#f97316',
  MOBI: '#a855f7',
  DJVU: '#3b82f6',
  AZW3: '#eab308',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [scannerMode, setScannerMode] = useState('barcode'); // 'barcode' | 'cover' | 'digital'
  const [books, setBooks] = useState([]);
  const [libraries, setLibraries] = useState(['Mi Biblioteca']);
  const [currentLibrary, setCurrentLibrary] = useState('Mi Biblioteca');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [manualQuery, setManualQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);

  // Bulk processing state
  const [bulkStatus, setBulkStatus] = useState({ 
    isProcessing: false, 
    current: 0, 
    total: 0, 
    currentFile: '' 
  });
  const cancelBulkRef = useRef(false);

  // Digital book state
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [folderFiles, setFolderFiles] = useState([]);
  const [pendingDigitalMeta, setPendingDigitalMeta] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const folderInputRef = useRef(null);

  // Persistencia local
  useEffect(() => {
    try {
      const savedBooks = localStorage.getItem('libros_scanner');
      const savedLibs = localStorage.getItem('librerias_scanner');
      if (savedBooks) setBooks(JSON.parse(savedBooks));
      if (savedLibs) setLibraries(JSON.parse(savedLibs));
    } catch (err) {
      console.error("Error loading from localStorage:", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('libros_scanner', JSON.stringify(books));
      localStorage.setItem('librerias_scanner', JSON.stringify(libraries));
    } catch (err) {
      console.warn("Could not save to localStorage", err);
    }
  }, [books, libraries]);

  const addBookToLibrary = (info, isbn = 'N/A') => {
    const digitalMeta = pendingDigitalMeta;
    setPendingDigitalMeta(null);

    const newBook = {
      id: Date.now().toString(),
      isbn,
      title: info.title,
      author: info.authors ? info.authors.join(', ') : 'Desconocido',
      publisher: info.publisher || 'Desconocido',
      genre: info.categories ? info.categories[0] : 'General',
      synopsis: info.description || 'Sin sinopsis disponible.',
      cover: info.imageLinks ? info.imageLinks.thumbnail : '',
      library: currentLibrary,
      type: digitalMeta ? 'digital' : 'physical',
      ...(digitalMeta ? {
        format: digitalMeta.format,
        fileSize: digitalMeta.fileSize,
        fileName: digitalMeta.fileName,
      } : {}),
    };

    setBooks(prev => {
      if (prev.find(b => b.title === info.title && b.author === newBook.author && b.library === currentLibrary)) {
        alert('Este libro ya está en tu librería.');
        return prev;
      }
      return [...prev, newBook];
    });

    setActiveTab('library');
    setShowManualModal(false);
    setSearchResults([]);
    setManualQuery('');
    alert(`¡Libro añadido: ${info.title}!`);
  };

  const searchBooks = async (query, maxResults = 5) => {
    try {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${maxResults}`);
      const data = await res.json();
      if (!data.docs) return { items: [] };
      const items = data.docs.map(doc => ({
        id: doc.key,
        volumeInfo: {
          title: doc.title,
          authors: doc.author_name || ['Desconocido'],
          publisher: doc.publisher ? doc.publisher[0] : 'Desconocido',
          categories: doc.subject || ['General'],
          description: '', 
          imageLinks: {
            thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            smallThumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : ''
          }
        }
      }));
      return { items };
    } catch { return { items: [] }; }
  };

  const fetchBookByISBN = async (isbn) => {
    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
      const data = await res.json();
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        return {
          items: [{
            id: bookData.key,
            volumeInfo: {
              title: bookData.title,
              authors: bookData.authors ? bookData.authors.map(a => a.name) : ['Desconocido'],
              publisher: bookData.publishers ? bookData.publishers.map(p => p.name).join(', ') : 'Desconocido',
              categories: bookData.subjects ? bookData.subjects.map(s => s.name) : ['General'],
              description: bookData.excerpts && bookData.excerpts.length > 0 ? bookData.excerpts[0].text : '',
              imageLinks: {
                thumbnail: bookData.cover ? bookData.cover.medium : '',
                smallThumbnail: bookData.cover ? bookData.cover.small : ''
              }
            }
          }]
        };
      }
    } catch (e) { console.warn(e); }
    return searchBooks(`isbn:${isbn}`, 1);
  };

  const fetchBookData = async (isbn) => {
    setLoading(true);
    try {
      const data = await fetchBookByISBN(isbn);
      if (data.items && data.items.length > 0) {
        addBookToLibrary(data.items[0].volumeInfo, isbn);
      } else {
        alert('No se encontraron datos para este ISBN.');
      }
    } catch (error) {
      console.error('Error fetching book:', error);
      alert('Error al conectar con la base de datos de libros.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async (query) => {
    if (!query) return;
    setLoading(true);
    try {
      const data = await searchBooks(query, 5);
      setSearchResults(data.items || []);
    } catch (error) {
      alert('Error en la búsqueda manual');
    } finally {
      setLoading(false);
    }
  };

  const handleOcrCapture = async (imageData) => {
    setLoading(true);
    setOcrProgress(10);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa');
      setOcrProgress(30);
      const { data: { text } } = await worker.recognize(imageData);
      setOcrProgress(70);
      await worker.terminate();
      const cleanText = text.replace(/\n/g, ' ').trim();
      if (cleanText.length < 5) {
        alert("No se pudo leer texto claro de la portada. Intenta con más luz.");
        return;
      }
      const data = await searchBooks(cleanText, 3);
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setShowManualModal(true);
        setManualQuery(cleanText);
      } else {
        alert("Texto reconocido: " + cleanText.substring(0, 50) + "... Pero no se encontró el libro.");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Error al procesar la imagen.");
    } finally {
      setLoading(false);
      setOcrProgress(0);
    }
  };

  const onNewScanResult = (decodedText) => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (window.navigator.vibrate) window.navigator.vibrate(100);
    fetchBookData(decodedText);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const removeBook = (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este libro?')) {
      setBooks(prev => prev.filter(b => b.id !== id));
    }
  };

  const addLibrary = () => {
    const name = prompt('Nombre de la nueva librería:');
    if (name && !libraries.includes(name)) {
      setLibraries(prev => [...prev, name]);
      setCurrentLibrary(name);
    }
  };

  const importFromJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.books && data.libraries) {
          if (window.confirm('¿Quieres sobrescribir tus datos actuales con esta copia de seguridad?')) {
            setBooks(data.books);
            setLibraries(data.libraries);
            if (data.libraries.length > 0) setCurrentLibrary(data.libraries[0]);
            alert('¡Copia de seguridad restaurada con éxito!');
          }
        } else {
          alert('Formato de archivo no válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo de copia de seguridad.');
      }
    };
    reader.readAsText(file);
  };

  // ── Digital Book Helpers ──────────────────────────────────────────

  const startBulkImport = async () => {
    if (folderFiles.length === 0) return;
    if (!window.confirm(`¿Quieres importar los ${folderFiles.length} libros detectados automáticamente?`)) return;
    
    setBulkStatus({ isProcessing: true, current: 0, total: folderFiles.length, currentFile: '' });
    cancelBulkRef.current = false;
    
    const newBooksList = [];
    const existingTitles = new Set(books.map(b => b.title + b.author + b.library));
    
    for (let i = 0; i < folderFiles.length; i++) {
      if (cancelBulkRef.current) break;
      
      const file = folderFiles[i];
      setBulkStatus(prev => ({ ...prev, current: i + 1, currentFile: file.name }));
      
      const ext = file.name.split('.').pop().toUpperCase();
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_\-\.]+/g, ' ')
        .replace(/\s\s+/g, ' ')
        .trim();

      let info = { 
        title: cleanName, 
        authors: ['Desconocido'], 
        publisher: 'Importación Masiva', 
        categories: ['Libro Digital'],
        description: '' // No guardamos descripción larga para ahorrar espacio
      };

      // Intentar búsqueda rápida
      try {
        if (cleanName.length > 3) {
          const data = await searchBooks(cleanName, 1);
          if (data.items && data.items.length > 0) {
            const vol = data.items[0].volumeInfo;
            // Solo aceptamos si el título se parece (básico)
            if (vol.title.toLowerCase().includes(cleanName.toLowerCase().split(' ')[0])) {
              info = {
                ...info,
                title: vol.title,
                authors: vol.authors || ['Desconocido'],
                publisher: vol.publisher || 'Desconocido',
                categories: vol.categories || ['Digital'],
                cover: vol.imageLinks?.thumbnail || ''
              };
            }
          }
        }
      } catch (e) {
        console.warn("Error en búsqueda masiva para:", cleanName);
      }

      // Evitar duplicados
      const authorStr = info.authors.join(', ');
      if (!existingTitles.has(info.title + authorStr + currentLibrary)) {
        newBooksList.push({
          id: (Date.now() + i).toString(),
          isbn: 'N/A',
          title: info.title,
          author: authorStr,
          publisher: info.publisher,
          genre: info.categories[0],
          synopsis: '', // Optimizado: sin sinopsis larga
          cover: info.cover || '',
          library: currentLibrary,
          type: 'digital',
          format: ext,
          fileSize: `${sizeInMB} MB`,
          fileName: file.name,
        });
        existingTitles.add(info.title + authorStr + currentLibrary);
      }

      // Throttling: pequeño retraso para no saturar a Google (300ms)
      await new Promise(r => setTimeout(r, 300));
    }

    if (newBooksList.length > 0) {
      setBooks(prev => [...prev, ...newBooksList]);
    }
    
    const wasCancelled = cancelBulkRef.current;
    setBulkStatus(prev => ({ ...prev, isProcessing: false }));
    setFolderFiles([]);
    alert(wasCancelled ? "Importación cancelada." : `¡Importación finalizada! Se añadieron ${newBooksList.length} libros.`);
    setActiveTab('library');
  };

  const handleFolderScan = (files) => {
    const supported = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });
    setFolderFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const newOnes = supported.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...newOnes];
    });
  };

  const handleSelectFolder = async () => {
    // Use File System Access API in Chrome/Edge; fallback otherwise
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        const files = [];
        for await (const [name, handle] of dirHandle.entries()) {
          if (handle.kind === 'file') {
            const ext = name.split('.').pop().toLowerCase();
            if (SUPPORTED_EXTENSIONS.includes(ext)) {
              const file = await handle.getFile();
              files.push(file);
            }
          }
        }
        if (files.length === 0) {
          alert('No se encontraron archivos compatibles en esa carpeta.\nFormatos soportados: PDF, EPUB, CBZ, MOBI, DJVU, AZW3');
        } else {
          handleFolderScan(files);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          // Fallback
          folderInputRef.current?.click();
        }
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleAddDigitalFile = async (file) => {
    const ext = file.name.split('.').pop().toUpperCase();
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    
    // Limpieza avanzada del nombre: quita extensión, quita puntos, guiones, 
    // y palabras comunes de archivos piratas o versiones (v1, x264, etc.)
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '') // quita extensión
      .replace(/[_\-\.]+/g, ' ') // cambia _, - y . por espacios
      .replace(/\s\s+/g, ' ') // quita espacios dobles
      .replace(/\(.*\)/g, '') // quita paréntesis y lo de dentro
      .replace(/\[.*\]/g, '') // quita corchetes y lo de dentro
      .trim();

    setPendingDigitalMeta({ format: ext, fileSize: `${sizeInMB} MB`, fileName: file.name });
    setManualQuery(cleanName);
    setShowManualModal(true);
    
    // Solo buscamos si el nombre resultante tiene sentido
    if (cleanName.length > 2) {
      await handleManualSearch(cleanName);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = [];
    if (e.dataTransfer.items) {
      for (const item of e.dataTransfer.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          const ext = file?.name.split('.').pop().toLowerCase();
          if (file && SUPPORTED_EXTENSIONS.includes(ext)) files.push(file);
        }
      }
    } else {
      for (const file of e.dataTransfer.files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) files.push(file);
      }
    }
    if (files.length > 0) handleFolderScan(files);
  };

  // ── Filtered books ────────────────────────────────────────────────

  const filteredBooks = books.filter(book =>
    book.library === currentLibrary &&
    (libraryFilter === 'all' ||
      (libraryFilter === 'physical' && (!book.type || book.type === 'physical')) ||
      (libraryFilter === 'digital'  && book.type === 'digital')) &&
    (book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     book.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const digitalCount  = books.filter(b => b.library === currentLibrary && b.type === 'digital').length;
  const physicalCount = books.filter(b => b.library === currentLibrary && (!b.type || b.type === 'physical')).length;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="container">
      {/* Header */}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={24} className="text-primary" /> {currentLibrary}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            {physicalCount} físicos · {digitalCount} digitales
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setShowManualModal(true)}>
            <Plus size={20} />
          </button>
          <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setActiveTab('export')}>
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'library' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab('library')}
        >
          <Library size={18} /> Mi Librería
        </button>
        <button
          className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab('scanner')}
        >
          <Plus size={18} /> Añadir Libros
        </button>
      </div>

      <main style={{ paddingBottom: '100px' }}>
        <AnimatePresence mode="wait">

          {/* ── SECCIÓN LIBRERÍA ────────────────────────────────── */}
          {activeTab === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Search */}
              <div style={{ marginBottom: '12px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Buscar en mi biblioteca..."
                  style={{ paddingLeft: '40px' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {[
                  { id: 'all',      label: `Todos (${physicalCount + digitalCount})`,  icon: <BookOpen size={13}/> },
                  { id: 'physical', label: `Físicos (${physicalCount})`,               icon: <BookOpen size={13}/> },
                  { id: 'digital',  label: `Digitales (${digitalCount})`,              icon: <HardDrive size={13}/> },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setLibraryFilter(f.id)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: `1px solid ${libraryFilter === f.id ? 'var(--primary)' : 'var(--border)'}`,
                      background: libraryFilter === f.id ? 'var(--primary)' : 'transparent',
                      color: libraryFilter === f.id ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>

              {/* Book List */}
              {filteredBooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <BookOpen size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <p>No hay libros en esta vista.</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('scanner')}>
                    Añadir libros
                  </button>
                </div>
              ) : (
                filteredBooks.map(book => {
                  const fmtColor = FORMAT_COLORS[book.format] || '#6b7280';
                  return (
                    <div key={book.id} className="card" style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
                      {/* Cover / Format icon */}
                      {book.cover ? (
                        <div style={{
                          width: '56px', height: '76px', borderRadius: '8px', flexShrink: 0,
                          backgroundImage: `url(${book.cover})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                        }} />
                      ) : book.type === 'digital' ? (
                        <div style={{
                          width: '56px', height: '76px', borderRadius: '8px', flexShrink: 0,
                          backgroundColor: fmtColor + '18',
                          border: `1.5px solid ${fmtColor}44`,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: '4px',
                        }}>
                          <BookMarked size={22} style={{ color: fmtColor }} />
                          <span style={{ fontSize: '0.55rem', fontWeight: '800', color: fmtColor, letterSpacing: '0.04em' }}>
                            {book.format}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          width: '56px', height: '76px', borderRadius: '8px', flexShrink: 0,
                          backgroundColor: 'var(--bg-main)',
                        }} />
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {book.title}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{book.author}</p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className="badge">{book.genre}</span>
                          {book.type === 'digital' && (
                            <span className="badge" style={{
                              backgroundColor: fmtColor + '22',
                              color: fmtColor,
                              border: `1px solid ${fmtColor}44`,
                              fontWeight: '700',
                            }}>
                              {book.format}
                            </span>
                          )}
                        </div>
                        {book.type === 'digital' && book.fileSize && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {book.fileName ? `📄 ${book.fileName.length > 30 ? book.fileName.substring(0,28)+'…' : book.fileName}` : ''} · {book.fileSize}
                          </p>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px', alignSelf: 'flex-start', color: 'var(--danger)' }}
                        onClick={() => removeBook(book.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ── SCANNER TAB ─────────────────────────────────────── */}
          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ textAlign: 'center' }}
            >
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>¿Qué quieres añadir?</p>

              {/* Mode selector — 3 tabs */}
              <div className="glass-panel" style={{ display: 'flex', padding: '4px', marginBottom: '24px', borderRadius: '12px', gap: '2px' }}>
                {[
                  { id: 'barcode', icon: <ScanBarcode size={14}/>, label: 'Barras' },
                  { id: 'cover',   icon: <Camera size={14}/>,      label: 'Portada' },
                  { id: 'digital', icon: <HardDrive size={14}/>,   label: 'Digital' },
                ].map(m => (
                  <button
                    key={m.id}
                    className={`btn ${scannerMode === m.id ? 'btn-primary' : ''}`}
                    style={{
                      flex: 1,
                      background: scannerMode === m.id ? '' : 'transparent',
                      color: scannerMode === m.id ? 'white' : 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      fontSize: '0.82rem',
                    }}
                    onClick={() => setScannerMode(m.id)}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {/* Barcode / Cover scanner */}
              {scannerMode !== 'digital' && (
                <div className="glass-panel" style={{ padding: '10px', marginBottom: '20px', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
                  {loading ? (
                    <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <Loader2 size={40} className="animate-spin text-primary" />
                      <p>{ocrProgress > 0 ? `Analizando texto... ${ocrProgress}%` : 'Buscando libro...'}</p>
                    </div>
                  ) : (
                    <React.Suspense fallback={<div style={{ padding: '40px' }}>Iniciando cámara...</div>}>
                      <Scanner
                        mode={scannerMode}
                        qrCodeSuccessCallback={onNewScanResult}
                        onCapture={handleOcrCapture}
                      />
                    </React.Suspense>
                  )}
                  {!loading && (
                    <div style={{ marginTop: '20px', padding: '10px' }}>
                      <p style={{ color: isProcessing ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {scannerMode === 'barcode'
                          ? 'Apunta al código de barras ISBN'
                          : 'Encuadra la portada y pulsa el botón'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Digital Mode ────────────────────────────────── */}
              {scannerMode === 'digital' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'left' }}
                >
                  {/* Supported formats */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
                    {Object.entries(FORMAT_COLORS).map(([fmt, color]) => (
                      <span key={fmt} style={{
                        fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px',
                        borderRadius: '6px', backgroundColor: color + '18',
                        color, border: `1px solid ${color}44`
                      }}>{fmt}</span>
                    ))}
                  </div>

                  {/* Drop / Folder zone */}
                  {!bulkStatus.isProcessing && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      style={{
                        border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: '16px',
                        padding: '28px 20px',
                        textAlign: 'center',
                        backgroundColor: isDragging ? 'rgba(99,102,241,0.08)' : 'transparent',
                        transition: 'all 0.2s',
                        marginBottom: '16px',
                      }}
                    >
                      <FolderOpen size={36} style={{ color: isDragging ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '10px', transition: 'color 0.2s' }} />
                      <p style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {isDragging ? 'Suelta aquí tus libros' : 'Arrastra archivos aquí'}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Selecciona o arrastra tu biblioteca digital completa
                      </p>
                      <button
                        className="btn btn-primary"
                        style={{ margin: '0 auto' }}
                        onClick={handleSelectFolder}
                      >
                        <FolderOpen size={16} /> Seleccionar carpeta
                      </button>

                      {/* Hidden fallback file input */}
                      <input
                        ref={folderInputRef}
                        type="file"
                        multiple
                        // eslint-disable-next-line react/no-unknown-property
                        webkitdirectory=""
                        accept=".pdf,.epub,.cbz,.mobi,.djvu,.azw3"
                        onChange={(e) => handleFolderScan(e.target.files)}
                        style={{ display: 'none' }}
                      />
                    </div>
                  )}

                  {/* Bulk Progress Bar */}
                  {bulkStatus.isProcessing && (
                    <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
                      <Loader2 size={32} className="animate-spin text-primary" style={{ margin: '0 auto 12px' }} />
                      <h4 style={{ marginBottom: '8px' }}>Procesando Biblioteca...</h4>
                      <div style={{ 
                        width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.05)', 
                        borderRadius: '10px', height: '12px', overflow: 'hidden', marginBottom: '12px' 
                      }}>
                        <div style={{ 
                          width: `${(bulkStatus.current / bulkStatus.total) * 100}%`, 
                          height: '100%', backgroundColor: 'var(--primary)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                        {bulkStatus.current} de {bulkStatus.total}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bulkStatus.currentFile}
                      </p>
                      <button 
                        className="btn btn-secondary" 
                        style={{ marginTop: '20px', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                        onClick={() => cancelBulkRef.current = true}
                      >
                        Cancelar Proceso
                      </button>
                    </div>
                  )}

                  {/* File list / Bulk Button */}
                  {folderFiles.length > 0 && !bulkStatus.isProcessing && (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '16px', fontSize: '1rem', background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                          onClick={startBulkImport}
                        >
                          🚀 Importar {folderFiles.length} libros (Automático)
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                          <MonitorDown size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                          {folderFiles.length} libro{folderFiles.length !== 1 ? 's' : ''} detectado{folderFiles.length !== 1 ? 's' : ''}
                        </p>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => setFolderFiles([])}
                        >
                          Limpiar
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                        {folderFiles.map((file, i) => {
                          const ext   = file.name.split('.').pop().toUpperCase();
                          const size  = (file.size / (1024 * 1024)).toFixed(1);
                          const color = FORMAT_COLORS[ext] || '#6b7280';
                          const nameWithout = file.name.replace(/\.[^/.]+$/, '');
                          return (
                            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
                              {/* Format chip */}
                              <div style={{
                                width: '38px', height: '46px', borderRadius: '7px', flexShrink: 0,
                                backgroundColor: color + '18', border: `1.5px solid ${color}44`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                              }}>
                                <BookMarked size={14} style={{ color }} />
                                <span style={{ fontSize: '0.5rem', fontWeight: '800', color, letterSpacing: '0.03em' }}>{ext}</span>
                              </div>

                              {/* Name + size */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.82rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {nameWithout}
                                </p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{size} MB</p>
                              </div>

                              {/* Add button */}
                              <button
                                className="btn btn-primary"
                                style={{ padding: '6px 10px', fontSize: '0.78rem', flexShrink: 0, gap: '4px' }}
                                onClick={() => handleAddDigitalFile(file)}
                              >
                                <Plus size={13} /> Añadir
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Bottom buttons (barcode / cover) */}
              {scannerMode !== 'digital' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowManualModal(true)}>
                    <Search size={18} /> Buscar por Nombre/Autor
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveTab('library')}>
                    Cancelar
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── EXPORT TAB ──────────────────────────────────────── */}
          {/* ── SECCIÓN SINCRONIZACIÓN ────────────────────────── */}
          {activeTab === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Bloque: PC a Móvil */}
                <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--primary)' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MonitorDown size={18} className="text-primary" /> Sincronizar con el Móvil
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Si has añadido libros en el PC, haz una copia aquí e impórtala en tu móvil.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px' }} onClick={async () => {
                      const { backupToJson } = await import('./utils/exportUtils');
                      backupToJson(books, libraries);
                    }}>
                      <Download size={18} /> Crear Copia de la Biblioteca (.json)
                    </button>
                    
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={importFromJson} 
                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} 
                      />
                      <button className="btn btn-secondary" style={{ justifyContent: 'center', padding: '14px', width: '100%', borderStyle: 'dashed' }}>
                        <Plus size={18} className="text-primary" /> Importar Copia en este dispositivo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloque: Reportes */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={async () => {
                    const { exportToExcel } = await import('./utils/exportUtils');
                    exportToExcel(books, currentLibrary);
                  }}>
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={async () => {
                    const { exportToPDF } = await import('./utils/exportUtils');
                    exportToPDF(books, currentLibrary);
                  }}>
                    <FileText size={16} /> PDF
                  </button>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Gestión de Librerías</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {libraries.map(lib => (
                      <button 
                        key={lib} 
                        className={`btn ${currentLibrary === lib ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ justifyContent: 'space-between' }}
                        onClick={() => {
                          setCurrentLibrary(lib);
                          setActiveTab('library');
                        }}
                      >
                        {lib} {currentLibrary === lib && <ChevronRight size={16} />}
                      </button>
                    ))}
                    <button className="btn btn-secondary" style={{ borderStyle: 'dashed', opacity: 0.7 }} onClick={addLibrary}>
                      <Plus size={18} /> Nueva Librería
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Manual Search Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel"
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 1000, padding: '24px',
              display: 'flex', flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.97)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ marginBottom: '2px' }}>
                  {pendingDigitalMeta ? '💾 Añadir Libro Digital' : 'Añadir Libro'}
                </h2>
                {pendingDigitalMeta && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: FORMAT_COLORS[pendingDigitalMeta.format] || '#6b7280', fontWeight: '700' }}>
                      {pendingDigitalMeta.format}
                    </span>
                    {' · '}{pendingDigitalMeta.fileSize}{' · '}{pendingDigitalMeta.fileName}
                  </p>
                )}
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '8px' }}
                onClick={() => {
                  setShowManualModal(false);
                  setSearchResults([]);
                  setPendingDigitalMeta(null);
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Título o Autor..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch(manualQuery)}
              />
              <button className="btn btn-primary" onClick={() => handleManualSearch(manualQuery)}>
                Buscar
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searchResults.length > 0 && searchResults.map(item => (
                <div
                  key={item.id}
                  className="card"
                  style={{ display: 'flex', gap: '12px', cursor: 'pointer' }}
                  onClick={() => addBookToLibrary(item.volumeInfo)}
                >
                  <img
                    src={item.volumeInfo.imageLinks?.smallThumbnail || ''}
                    style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', backgroundColor: '#334155' }}
                    alt=""
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{item.volumeInfo.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.volumeInfo.authors?.join(', ')}</p>
                  </div>
                  <CheckSquare size={16} className="text-primary" style={{ flexShrink: 0, alignSelf: 'center' }} />
                </div>
              ))}

              {loading && (
                <div style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <Loader2 size={32} className="animate-spin text-primary" />
                  <p>Buscando en Google Books...</p>
                </div>
              )}
              
              {!loading && searchResults.length === 0 && (
                <div style={{ 
                  textAlign: 'center', padding: '30px 20px', 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  borderRadius: '12px', border: '1px dashed var(--border)' 
                }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                    No hemos encontrado información automática para este archivo.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    style={{ margin: '0 auto' }}
                    onClick={() => addBookToLibrary({
                      title: manualQuery,
                      authors: ['Desconocido'],
                      publisher: 'Añadido manualmente',
                      categories: ['Libro Digital'],
                    })}
                  >
                    <Plus size={18} /> Añadir sin metadatos
                  </button>
                  <p style={{ fontSize: '0.75rem', marginTop: '12px', color: 'var(--text-muted)', opacity: 0.7 }}>
                    Usa el buscador arriba para intentar otra búsqueda manual.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <footer className="glass-panel" style={{
        position: 'fixed', bottom: '20px', left: '20px', right: '20px',
        padding: '12px', display: 'flex', justifyContent: 'space-around', zIndex: 100,
      }}>
        <button className="btn" style={{ padding: '8px', color: activeTab === 'library' ? 'var(--primary)' : 'inherit' }} onClick={() => setActiveTab('library')}>
          <Library size={24} />
        </button>
        <button className="btn" style={{ padding: '8px', color: activeTab === 'scanner' ? 'var(--primary)' : 'inherit' }} onClick={() => setActiveTab('scanner')}>
          <ScanBarcode size={24} />
        </button>
        <button className="btn" style={{ padding: '8px', color: activeTab === 'export' ? 'var(--primary)' : 'inherit' }} onClick={() => setActiveTab('export')}>
          <Settings size={24} />
        </button>
      </footer>
    </div>
  );
}
