import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const formatBook = (book) => ({
  Título:     book.title,
  Autor:      book.author,
  Editorial:  book.publisher || 'N/A',
  Género:     book.genre || 'N/A',
  ISBN:       book.isbn || 'N/A',
  Tipo:       book.type === 'digital' ? 'Digital' : 'Físico',
  Formato:    book.format || '—',
  Tamaño:     book.fileSize || '—',
  Archivo:    book.fileName || '—',
});

export const exportToExcel = (books, libraryName) => {
  const rows = books
    .filter(b => b.library === libraryName)
    .map(formatBook);

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Libros');
  XLSX.writeFile(workbook, `${libraryName}_libreria.xlsx`);
};

export const exportToPDF = (books, libraryName) => {
  const doc = new jsPDF();
  const libraryBooks = books.filter(b => b.library === libraryName);

  doc.setFontSize(18);
  doc.text(`Lista de Libros — ${libraryName}`, 14, 22);

  const physical = libraryBooks.filter(b => !b.type || b.type === 'physical');
  const digital  = libraryBooks.filter(b => b.type === 'digital');

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${physical.length} físicos · ${digital.length} digitales`, 14, 32);
  doc.setTextColor(0);

  let y = 44;

  const printSection = (sectionBooks, title) => {
    if (sectionBooks.length === 0) return;

    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(title, 14, y);
    doc.setFont(undefined, 'normal');
    y += 8;

    sectionBooks.forEach((book, index) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${book.title} — ${book.author}`, 14, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(100);

      let meta = `   Editorial: ${book.publisher || 'N/A'} | Género: ${book.genre || 'N/A'}`;
      if (book.type === 'digital') {
        meta += ` | Formato: ${book.format} | ${book.fileSize}`;
      }
      doc.text(meta, 14, y);
      doc.setTextColor(0);
      doc.setFontSize(11);
      y += 10;
    });
  };

  printSection(physical, '📚 Libros Físicos');
  y += 4;
  printSection(digital,  '💾 Libros Digitales');

  doc.save(`${libraryName}_libreria.pdf`);
};

export const backupToJson = (books, libraries) => {
  const data = JSON.stringify({ books, libraries }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `backup_libros_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};
