import React, { useState, useEffect } from 'react';
import { Search, BookPlus, Loader2, X, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { listBooks, issueBook, listIssues, returnBook } from '../../services/firebase/libraryService';
import { listClasses } from '../../services/firebase/academicService';
import { listStudents } from '../../services/firebase/studentsService';

export default function StudentIssue() {
  const [activeTab, setActiveTab] = useState('ISSUE'); // ISSUE, STATUS
  
  // Issue flow state
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Status flow state
  const [issues, setIssues] = useState([]);
  
  // Issue Modal
  const [issueModalStudent, setIssueModalStudent] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [cls, iss] = await Promise.all([listClasses(), listIssues('STUDENT')]);
    setClasses(cls);
    setIssues(iss);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedClass) { setStudents([]); return; }
    setLoading(true);
    listStudents({ className: selectedClass }).then(st => {
      setStudents(st);
      setLoading(false);
    });
  }, [selectedClass]);

  const handleReturn = async (issueId, bookId) => {
    if (!window.confirm("Mark this book as returned?")) return;
    await returnBook(issueId, bookId);
    toast.success("Book marked as returned!");
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <button onClick={() => setActiveTab('ISSUE')} className={`px-5 py-2.5 label-eyebrow rounded-2xl transition-colors ${activeTab === 'ISSUE' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>Issue Book</button>
        <button onClick={() => setActiveTab('STATUS')} className={`px-5 py-2.5 label-eyebrow rounded-2xl transition-colors ${activeTab === 'STATUS' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>Issue Status Tracking</button>
      </div>

      {activeTab === 'ISSUE' && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <select
              value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="w-64 px-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
            >
              <option value="">Select a Class...</option>
              {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          </div>

          {selectedClass && students.length > 0 && (
            <div className="glass-morphism rounded-[2rem] overflow-hidden border border-border">
              <div className="overflow-x-auto thin-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4 label-eyebrow border-b border-border">Admission No</th>
                      <th className="px-5 py-4 label-eyebrow border-b border-border">Student Name</th>
                      <th className="px-5 py-4 label-eyebrow border-b border-border">Section</th>
                      <th className="px-5 py-4 label-eyebrow border-b border-border text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map(s => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 font-mono font-medium text-muted-foreground">{s.admissionNo}</td>
                        <td className="px-5 py-3 font-bold text-foreground">{s.fullName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.section || '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => setIssueModalStudent(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl label-eyebrow transition-colors">
                            <BookPlus className="w-3.5 h-3.5" /> Issue Book
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {selectedClass && students.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground label-eyebrow">No students found in this class.</div>
          )}
        </div>
      )}

      {activeTab === 'STATUS' && (
        <div className="glass-morphism rounded-[2rem] overflow-hidden border border-border">
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Student Name</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Class</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Book Title</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Acc. No</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Issue Date</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Due Date</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border">Status</th>
                  <th className="px-5 py-4 label-eyebrow border-b border-border text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {issues.map(i => {
                  const isOverdue = i.status === 'ISSUED' && new Date() > new Date(i.dueDate);
                  return (
                    <tr key={i.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-bold text-foreground">{i.borrowerName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{i.borrowerClass}</td>
                      <td className="px-5 py-3 font-bold text-foreground max-w-[150px] truncate" title={i.title}>{i.title}</td>
                      <td className="px-5 py-3 font-mono text-muted-foreground">{i.accessionNo}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(i.issueDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(i.dueDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {i.status === 'RETURNED' ? (
                          <span className="flex items-center gap-1 label-eyebrow text-[10px] text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit"><CheckCircle2 className="w-3 h-3"/> RETURNED</span>
                        ) : isOverdue ? (
                          <span className="flex items-center gap-1 label-eyebrow text-[10px] text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-full w-fit"><Clock className="w-3 h-3"/> OVERDUE</span>
                        ) : (
                          <span className="flex items-center gap-1 label-eyebrow text-[10px] text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full w-fit"><Clock className="w-3 h-3"/> ISSUED</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {i.status === 'ISSUED' && (
                          <button onClick={() => handleReturn(i.id, i.bookId)} className="label-eyebrow text-[10px] text-primary hover:text-primary/80 underline">Mark Returned</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {issues.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground label-eyebrow">No student issues found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {issueModalStudent && <IssueBookModal student={issueModalStudent} onClose={() => setIssueModalStudent(null)} onIssue={() => { setIssueModalStudent(null); loadData(); }} />}
    </div>
  );
}

function IssueBookModal({ student, onClose, onIssue }) {
  const [search, setSearch] = useState('');
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listBooks().then(data => setBooks(data.filter(b => b.status === 'AVAILABLE')));
  }, []);

  const filteredBooks = search ? books.filter(b => 
    (b.title || '').toLowerCase().includes(search.toLowerCase()) || 
    (b.accessionNo?.toString() || '').includes(search)
  ).slice(0, 10) : [];

  const handleIssue = async () => {
    if (!selectedBook) return;
    setSaving(true);
    
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2); // 2 days for students

    await issueBook(selectedBook.id, {
      bookId: selectedBook.id,
      accessionNo: selectedBook.accessionNo,
      title: selectedBook.title,
      borrowerType: 'STUDENT',
      borrowerId: student.id,
      borrowerName: student.fullName,
      borrowerClass: `${student.className} ${student.section || ''}`.trim(),
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      status: 'ISSUED'
    });

    toast.success("Book issued successfully!");
    onIssue();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-morphism rounded-[2rem] border border-border w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/50">
          <h2 className="font-display font-black text-2xl tracking-tight uppercase">Issue Book to Student</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 bg-card">
          <div className="p-5 bg-muted/50 border border-border rounded-2xl flex justify-between items-center">
            <div>
              <div className="label-eyebrow text-muted-foreground mb-1">STUDENT</div>
              <div className="font-bold text-foreground">{student.fullName}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{student.className} {student.section}</div>
            </div>
            <div className="text-right">
              <div className="label-eyebrow text-muted-foreground mb-1">DUE PERIOD</div>
              <div className="font-bold text-rose-500">2 Days</div>
            </div>
          </div>

          <div className="relative">
            <label className="block label-eyebrow text-muted-foreground mb-2">Select Book (Search Title or Acc No)</label>
            {!selectedBook ? (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="text" placeholder="Search..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
                />
                {search && filteredBooks.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto thin-scrollbar">
                    {filteredBooks.map(b => (
                      <button key={b.id} onClick={() => setSelectedBook(b)} className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 transition-colors">
                        <div className="font-bold text-sm text-foreground truncate">{b.title}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">Acc: {b.accessionNo} · Author: {b.author || '—'}</div>
                      </button>
                    ))}
                  </div>
                )}
                {search && filteredBooks.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl z-20 px-4 py-4 text-sm text-muted-foreground text-center">
                    No available books found.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl">
                <div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{selectedBook.title}</div>
                  <div className="text-xs text-emerald-600/80 font-mono mt-0.5">Acc: {selectedBook.accessionNo}</div>
                </div>
                <button onClick={() => setSelectedBook(null)} className="text-emerald-600 hover:bg-emerald-500/20 p-2 rounded-xl transition-colors"><X className="w-4 h-4"/></button>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3">
          <button onClick={onClose} type="button" className="px-5 h-11 label-eyebrow text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancel</button>
          <button onClick={handleIssue} disabled={!selectedBook || saving} className="px-5 h-11 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-2xl transition-colors flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookPlus className="w-4 h-4" />} Confirm Issue
          </button>
        </div>
      </div>
    </div>
  );
}
