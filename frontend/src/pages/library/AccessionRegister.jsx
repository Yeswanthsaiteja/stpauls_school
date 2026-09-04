import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, FileSpreadsheet, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { listBooks, addBook, bulkAddBooks, updateBook } from '../../services/firebase/libraryService';

export default function AccessionRegister() {
  const [books, setBooks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    const data = await listBooks();
    setBooks(data);
    setFiltered(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(books); return; }
    const q = search.toLowerCase();
    setFiltered(books.filter(b => 
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.accessionNo?.toString() || '').toLowerCase().includes(q)
    ));
  }, [search, books]);

  // Bulk Excel Upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        // Find a sheet named "Sheet1" or fallback to the last sheet (since charts are at the start)
        const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('sheet')) || workbook.SheetNames[workbook.SheetNames.length - 1];
        const worksheet = workbook.Sheets[targetSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Find the actual header row dynamically (usually has >5 columns and contains keywords like 'Title' or 'Acc')
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i] || [];
          if (row.length > 5) {
            headerRowIndex = i;
            break;
          }
        }
        
        const dataRows = jsonData.slice(headerRowIndex + 1);
        
        const mappedBooks = dataRows.map(row => {
          return {
            slNo: row[0]?.toString() || '',
            numberOfBooks: row[1]?.toString() || '',
            accessionNo: row[2]?.toString() || '',
            callNo: row[3]?.toString() || '',
            author: row[4]?.toString() || '',
            title: row[5]?.toString() || '',
            isbn: row[6]?.toString() || '',
            pages: row[7]?.toString() || '',
            publisher: row[8]?.toString() || '',
            placeOfPublication: row[9]?.toString() || '',
            volume: row[10]?.toString() || '',
            edition: row[11]?.toString() || '',
            year: row[12]?.toString() || '',
            foreignPrice: row[13]?.toString() || '',
            inrPrice: row[14]?.toString() || '',
            remarks: row[15]?.toString() || '',
            rackInfo: row[16]?.toString() || '',
          };
        }).filter(b => b.title && b.title.trim() !== '' && b.accessionNo && b.accessionNo.trim() !== '');

        if (mappedBooks.length === 0) {
          toast.error("No valid books found in Excel.");
          setLoading(false);
          return;
        }

        await bulkAddBooks(mappedBooks);
        toast.success(`Successfully imported ${mappedBooks.length} books!`);
        loadData();
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Title, Author, Acc No..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
          />
        </div>
        <div className="flex gap-3">
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleExcelUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 h-11 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-2xl label-eyebrow transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Import Excel
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl label-eyebrow transition-colors">
            <Plus className="w-4 h-4" /> Add Book
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-morphism rounded-[2rem] overflow-hidden border border-border">
          <div className="overflow-x-auto max-h-[600px] thin-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Sl. No</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Acc. No</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Title</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Author</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Publisher</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Year</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(b => (
                  <tr key={b.id} onClick={() => setSelectedBook(b)} className="hover:bg-muted/20 cursor-pointer transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{b.slNo || '—'}</td>
                    <td className="px-5 py-3 font-mono font-bold text-primary">{b.accessionNo || '—'}</td>
                    <td className="px-5 py-3 font-bold text-foreground max-w-[250px] truncate" title={b.title}>{b.title || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.author || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.publisher || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.year || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full label-eyebrow ${
                        b.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600' :
                        b.status === 'ISSUED' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {b.status || 'AVAILABLE'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No books found in the register.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdd={() => { setShowAdd(false); loadData(); }} />}
      {selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onUpdate={() => { setSelectedBook(null); loadData(); }} />}
    </div>
  );
}

function AddBookModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    slNo: '', numberOfBooks: '1', accessionNo: '', callNo: '', author: '',
    title: '', isbn: '', pages: '', publisher: '', placeOfPublication: '',
    volume: '', edition: '', year: '', foreignPrice: '', inrPrice: '', remarks: '', rackInfo: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.accessionNo) return toast.error("Title and Accession No are required");
    setSaving(true);
    await addBook(form);
    toast.success("Book added successfully");
    onAdd();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-morphism rounded-[2rem] border border-border w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/50">
          <h2 className="font-display font-black text-2xl tracking-tight uppercase">Add New Book</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto thin-scrollbar bg-card">
          <form id="add-book" onSubmit={handleSubmit} className="grid grid-cols-2 gap-5">
            {[
              { label: 'Accession No *', key: 'accessionNo', req: true },
              { label: 'Title *', key: 'title', req: true },
              { label: 'Author', key: 'author' },
              { label: 'Sl. No', key: 'slNo' },
              { label: 'No. of Books', key: 'numberOfBooks' },
              { label: 'Call No.', key: 'callNo' },
              { label: 'ISBN', key: 'isbn' },
              { label: 'Pages', key: 'pages' },
              { label: 'Publisher', key: 'publisher' },
              { label: 'Place of Publication', key: 'placeOfPublication' },
              { label: 'Volume', key: 'volume' },
              { label: 'Edition', key: 'edition' },
              { label: 'Year', key: 'year' },
              { label: 'Price (INR)', key: 'inrPrice' },
              { label: 'Foreign Price', key: 'foreignPrice' },
              { label: 'Rack Info', key: 'rackInfo' },
              { label: 'Remarks', key: 'remarks' },
            ].map(f => (
              <div key={f.key}>
                <label className="block label-eyebrow text-muted-foreground mb-1.5">{f.label}</label>
                <input
                  type="text" required={f.req}
                  value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              </div>
            ))}
          </form>
        </div>
        <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3">
          <button onClick={onClose} type="button" className="px-5 h-11 label-eyebrow text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancel</button>
          <button form="add-book" type="submit" disabled={saving} className="px-5 h-11 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-2xl transition-colors flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Book
          </button>
        </div>
      </div>
    </div>
  );
}

function BookDetailsModal({ book, onClose, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ ...book });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await updateBook(book.id, form);
    toast.success("Book details updated");
    onUpdate();
  };

  const fields = [
    { label: 'Accession No', key: 'accessionNo', req: true },
    { label: 'Title', key: 'title', req: true },
    { label: 'Author', key: 'author' },
    { label: 'Sl. No', key: 'slNo' },
    { label: 'No. of Books', key: 'numberOfBooks' },
    { label: 'Call No.', key: 'callNo' },
    { label: 'ISBN', key: 'isbn' },
    { label: 'Pages', key: 'pages' },
    { label: 'Publisher', key: 'publisher' },
    { label: 'Place of Publication', key: 'placeOfPublication' },
    { label: 'Volume', key: 'volume' },
    { label: 'Edition', key: 'edition' },
    { label: 'Year', key: 'year' },
    { label: 'Price (INR)', key: 'inrPrice' },
    { label: 'Foreign Price', key: 'foreignPrice' },
    { label: 'Rack Info', key: 'rackInfo' },
    { label: 'Remarks', key: 'remarks' },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-morphism rounded-[2rem] border border-border w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/50">
          <h2 className="font-display font-black text-2xl tracking-tight uppercase">
            {isEditing ? 'Edit Book Details' : 'Book Details'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto thin-scrollbar bg-card">
          {isEditing ? (
            <form id="edit-book" onSubmit={handleSubmit} className="grid grid-cols-2 gap-5">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block label-eyebrow text-muted-foreground mb-1.5">{f.label} {f.req && '*'}</label>
                  <input
                    type="text" required={f.req}
                    value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              ))}
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block label-eyebrow text-muted-foreground mb-1">{f.label}</label>
                  <div className="font-semibold text-sm">{book[f.key] || '—'}</div>
                </div>
              ))}
              <div>
                <label className="block label-eyebrow text-muted-foreground mb-1">Status</label>
                <div className={`w-fit px-2.5 py-1 rounded-full label-eyebrow ${
                  book.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600' :
                  book.status === 'ISSUED' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                }`}>
                  {book.status || 'AVAILABLE'}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} type="button" className="px-5 h-11 label-eyebrow text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancel</button>
              <button form="edit-book" type="submit" disabled={saving} className="px-5 h-11 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-2xl transition-colors flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} type="button" className="px-5 h-11 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 rounded-2xl transition-colors flex items-center gap-2">
              Edit Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
