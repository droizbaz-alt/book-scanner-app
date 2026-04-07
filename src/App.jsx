import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  X,
  FileJson,
  FileSpreadsheet,
  FileText,
  Camera,
  Keyboard,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy components
const Scanner = React.lazy(() => import('./components/Scanner'));

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [scannerMode, setScannerMode] = useState('barcode'); // 'barcode' or 'cover'
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

  // Persistencia local
  useEffect(() => {
    try {
      const savedBooks = localStorage.getItem('libros_scanner');
      const savedLibs = localStorage.getItem('librerias_scanner');
      if (savedBooks) setBooks(JSON.parse(savedBooks));
      if (savedLibs) setLibraries(JSON.parse(savedLibs));
    } catch (err) {
      console.error("Error loading from localStorage:", err);
      // If corrupted, we just start fresh
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
    const newBook = {
      id: Date.now().toString(),
      isbn,
      title: info.title,
      author: info.authors ? info.authors.join(', ') : 'Desconocido',
      publisher: info.publisher || 'Desconocido',
      genre: info.categories ? info.categories[0] : 'General',
      synopsis: info.description || 'Sin sinopsis disponible.',
      cover: info.imageLinks ? info.imageLinks.thumbnail : '',
      library: currentLibrary
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

  const fetchBookData = async (isbn) => {
    setLoading(true);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      
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
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
      const data = await response.json();
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
      
      console.log("OCR Result:", text);
      const cleanText = text.replace(/\n/g, ' ').trim();
      if (cleanText.length < 5) {
        alert("No se pudo leer texto claro de la portada. Intenta con más luz.");
        return;
      }
      
      // Search by extracted text
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanText)}&maxResults=3`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setShowManualModal(true); // Let user pick the correct one
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
          alert('Informato de archivo no válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo de copia de seguridad.');
      }
    };
    reader.readAsText(file);
  };

  const filteredBooks = books.filter(book => 
    book.library === currentLibrary &&
    (book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     book.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container">
      {/* Header */}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={24} className="text-primary" /> {currentLibrary}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{filteredBooks.length} libros</p>
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
          {activeTab === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div style={{ marginBottom: '16px', position: 'relative' }}>
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

              {filteredBooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <BookOpen size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <p>No hay libros en esta librería.</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('scanner')}>
                    ¡Escanear mi primer libro!
                  </button>
                </div>
              ) : (
                filteredBooks.map(book => (
                  <div key={book.id} className="card" style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '80px', 
                      backgroundColor: 'var(--bg-main)', 
                      borderRadius: '8px',
                      backgroundImage: `url(${book.cover})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{book.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{book.author}</p>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                         <span className="badge">{book.genre}</span>
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '8px', alignSelf: 'flex-start', color: 'var(--danger)' }}
                      onClick={() => removeBook(book.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ textAlign: 'center' }}
            >
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>¿Qué quieres escanear?</p>
              
              <div className="glass-panel" style={{ display: 'flex', padding: '4px', marginBottom: '24px', borderRadius: '12px' }}>
                <button 
                  className={`btn ${scannerMode === 'barcode' ? 'btn-primary' : ''}`}
                  style={{ 
                    flex: 1, 
                    background: scannerMode === 'barcode' ? '' : 'transparent', 
                    color: scannerMode === 'barcode' ? 'white' : 'var(--text-main)',
                    whiteSpace: 'nowrap' 
                  }}
                  onClick={() => setScannerMode('barcode')}
                >
                  <ScanBarcode size={16} /> Código Barras
                </button>
                <button 
                  className={`btn ${scannerMode === 'cover' ? 'btn-primary' : ''}`}
                  style={{ 
                    flex: 1, 
                    background: scannerMode === 'cover' ? '' : 'transparent', 
                    color: scannerMode === 'cover' ? 'white' : 'var(--text-main)',
                    whiteSpace: 'nowrap' 
                  }}
                  onClick={() => setScannerMode('cover')}
                >
                  <Camera size={16} /> Portada (OCR)
                </button>
              </div>

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
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowManualModal(true)}>
                  <Keyboard size={18} /> Manual
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveTab('library')}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'export' && (
             <motion.div
                key="export"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
             >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '16px' }} onClick={async () => {
                    const { exportToExcel } = await import('./utils/exportUtils');
                    exportToExcel(books, currentLibrary);
                  }}>
                    <FileSpreadsheet size={20} className="text-primary" /> Exportar a Excel
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '16px' }} onClick={async () => {
                    const { exportToPDF } = await import('./utils/exportUtils');
                    exportToPDF(books, currentLibrary);
                  }}>
                    <FileText size={20} className="text-primary" /> Exportar a PDF
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '16px' }} onClick={async () => {
                    const { backupToJson } = await import('./utils/exportUtils');
                    backupToJson(books, libraries);
                  }}>
                    <FileJson size={20} className="text-primary" /> Copia de Seguridad
                  </button>
                  
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={importFromJson} 
                      style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} 
                    />
                    <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '16px', width: '100%' }}>
                      <Plus size={20} className="text-accent" /> Importar Copia (.json)
                    </button>
                  </div>
                  
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Mis Librerías</h3>
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
                      <button className="btn btn-secondary" style={{ borderStyle: 'dashed' }} onClick={addLibrary}>
                        <Plus size={18} /> Nueva Librería
                      </button>
                    </div>
                  </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Manual Search Modal */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel"
            style={{ 
              position: 'fixed', 
              top: 0, left: 0, right: 0, bottom: 0, 
              zIndex: 1000, 
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.95)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>Añadir Libro</h2>
              <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => {
                setShowManualModal(false);
                setSearchResults([]);
              }}>
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
              <button 
                className="btn btn-primary" 
                onClick={() => handleManualSearch(manualQuery)}
              >
                Buscar
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searchResults.map(item => (
                <div 
                  key={item.id} 
                  className="card" 
                  style={{ display: 'flex', gap: '12px', cursor: 'pointer', border: '1px solid transparent' }}
                  onClick={() => addBookToLibrary(item.volumeInfo)}
                >
                  <img 
                    src={item.volumeInfo.imageLinks?.smallThumbnail || ''} 
                    style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', backgroundColor: '#334155' }} 
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{item.volumeInfo.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.volumeInfo.authors?.join(', ')}</p>
                  </div>
                  <Plus size={16} className="text-primary" />
                </div>
              ))}
              
              {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Buscando...</div>}
              {!loading && searchResults.length === 0 && manualQuery && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Pulsa buscar para ver resultados</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <footer className="glass-panel" style={{ 
        position: 'fixed', bottom: '20px', left: '20px', right: '20px', 
        padding: '12px', display: 'flex', justifyContent: 'space-around', zIndex: 100
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
