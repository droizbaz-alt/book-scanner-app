import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export const exportToExcel = (books, libraryName) => {
  const worksheet = XLSX.utils.json_to_sheet(books.filter(b => b.library === libraryName));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Libros");
  XLSX.writeFile(workbook, `${libraryName}_libreria.xlsx`);
};

export const exportToPDF = (books, libraryName) => {
  const doc = new jsPDF();
  const libraryBooks = books.filter(b => b.library === libraryName);
  
  doc.setFontSize(18);
  doc.text(`Lista de Libros - ${libraryName}`, 14, 22);
  
  doc.setFontSize(11);
  let y = 40;
  
  libraryBooks.forEach((book, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${index + 1}. ${book.title} - ${book.author}`, 14, y);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`   Editorial: ${book.publisher || 'N/A'} | Género: ${book.genre || 'N/A'}`, 14, y);
    doc.setTextColor(0);
    doc.setFontSize(11);
    y += 10;
  });
  
  doc.save(`${libraryName}_libreria.pdf`);
};

export const backupToJson = (books, libraries) => {
  const data = JSON.stringify({ books, libraries }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_libros_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};
