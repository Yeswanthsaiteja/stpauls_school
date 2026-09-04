import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, LibrarySquare, BookCopy, Loader2, X, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { listRacks, addRack, deleteRack, updateRack, listBooks, updateBook } from '../../services/firebase/libraryService';

export default function RackArrangement() {
  const [racks, setRacks] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRack, setSelectedRack] = useState(null);

  // Modals
  const [showAddRack, setShowAddRack] = useState(false);
  const [showAssignBookToShelf, setShowAssignBookToShelf] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [fetchedRacks, fetchedBooks] = await Promise.all([listRacks(), listBooks()]);
    setRacks(fetchedRacks);
    setBooks(fetchedBooks);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleAddRack = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = fd.get('rackNumber');
    const desc = fd.get('description');
    if (!num) return;
    
    await addRack({ rackNumber: num, description: desc, shelves: [] });
    toast.success('Rack created');
    setShowAddRack(false);
    loadData();
  };

  const handleDeleteRack = async (rackId) => {
    if (!window.confirm("Are you sure you want to delete this rack?")) return;
    // Unassign all books in this rack
    const booksInRack = books.filter(b => b.rackId === rackId);
    for (const b of booksInRack) {
      await updateBook(b.id, { rackId: null });
    }
    await deleteRack(rackId);
    if (selectedRack?.id === rackId) setSelectedRack(null);
    toast.success('Rack deleted');
    loadData();
  };

  const handleRemoveBookFromRack = async (bookId) => {
    await updateBook(bookId, { rackId: null });
    toast.success('Book removed from rack');
    loadData();
  };

  const handleAddShelf = async () => {
    if (!selectedRack) return;
    const currentShelves = selectedRack.shelves || [];
    // Calculate next shelf letter (A, B, C...)
    const nextChar = String.fromCharCode(65 + currentShelves.length);
    const newShelfName = `${selectedRack.rackNumber}${nextChar}`;
    
    const updatedShelves = [...currentShelves, newShelfName];
    await updateRack(selectedRack.id, { shelves: updatedShelves });
    toast.success(`Shelf ${newShelfName} created`);
    loadData();
    setSelectedRack(prev => ({ ...prev, shelves: updatedShelves }));
  };

  const handleAssignBooks = async (bookIds, shelfName) => {
    if (bookIds.length === 0) return;
    try {
      await Promise.all(bookIds.map(id => updateBook(id, { rackId: selectedRack.id, rackInfo: shelfName })));
      toast.success(`${bookIds.length} book(s) assigned to ${shelfName}`);
      loadData();
    } catch (e) {
      toast.error('Failed to assign books');
    }
  };

  // Only books assigned to this rack AND available (not issued)
  const currentRackBooks = selectedRack 
    ? books.filter(b => b.rackId === selectedRack.id && b.status === 'AVAILABLE')
    : [];

  // Available books not assigned to any rack
  const unassignedAvailableBooks = books.filter(b => !b.rackId && b.status === 'AVAILABLE');

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      
      {/* ─── Left Panel: Racks ───────────────────────────────────── */}
      <div className="w-full md:w-1/3 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-black text-xl tracking-tight uppercase">Racks</h2>
          <button onClick={() => setShowAddRack(true)} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl label-eyebrow transition-colors text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Rack
          </button>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto thin-scrollbar pr-2">
          {racks.length === 0 && <div className="text-muted-foreground text-sm text-center py-6">No racks found.</div>}
          {racks.map(r => {
            const isSelected = selectedRack?.id === r.id;
            const bookCount = books.filter(b => b.rackId === r.id && b.status === 'AVAILABLE').length;
            return (
              <div 
                key={r.id} 
                onClick={() => setSelectedRack(r)}
                className={`p-4 rounded-[1.5rem] border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {r.rackNumber}
                    </div>
                    <div>
                      <div className="font-bold text-sm">Rack {r.rackNumber}</div>
                      <div className="text-xs text-muted-foreground">{r.description || 'No description'}</div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteRack(r.id); }}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <BookCopy className="w-3.5 h-3.5" /> {bookCount} Available Books
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Right Panel: Books in Rack ──────────────────────────── */}
      <div className="w-full md:w-2/3 glass-morphism rounded-[2rem] border border-border flex flex-col h-[650px] overflow-hidden">
        {selectedRack ? (
          <>
            <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
              <div>
                <h3 className="font-display font-black text-xl uppercase text-primary flex items-center gap-2">
                  <LibrarySquare className="w-5 h-5" /> Rack {selectedRack.rackNumber}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedRack.description || 'Manage shelves and books'}</p>
              </div>
              <button onClick={handleAddShelf} className="flex items-center gap-2 px-4 h-10 bg-primary/10 text-primary hover:bg-primary/20 rounded-2xl label-eyebrow transition-colors">
                <Plus className="w-4 h-4" /> Add Shelf
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto thin-scrollbar p-5 bg-card/20 space-y-6">
              {!(selectedRack.shelves?.length > 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <LibrarySquare className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-bold">No shelves in this rack</p>
                  <p className="text-sm mt-1">Add a shelf to start organizing books.</p>
                </div>
              ) : (
                selectedRack.shelves.map((shelfName) => {
                  const booksInShelf = currentRackBooks.filter(b => b.rackInfo === shelfName);
                  return (
                    <div key={shelfName} className="bg-card border border-border rounded-[1.5rem] overflow-hidden">
                      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                        <div className="font-display font-black tracking-tight text-lg flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">{shelfName.slice(-1)}</div>
                          Shelf {shelfName}
                        </div>
                        <button onClick={() => setShowAssignBookToShelf(shelfName)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl label-eyebrow transition-colors text-xs">
                          <Plus className="w-3.5 h-3.5" /> Assign Books
                        </button>
                      </div>
                      <div className="p-4">
                        {booksInShelf.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-4">No books in this shelf.</div>
                        ) : (
                          <div className="space-y-2">
                            {booksInShelf.map(b => (
                              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/30 transition-all bg-background">
                                <div>
                                  <div className="font-bold text-sm text-foreground">{b.title}</div>
                                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-semibold">
                                    <span>Acc: <span className="text-primary">{b.accessionNo}</span></span>
                                    <span>{b.author}</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleRemoveBookFromRack(b.id)}
                                  className="px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </  >
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <LibrarySquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold">Select a Rack</p>
            <p className="text-sm">Choose a rack from the left panel to manage its books.</p>
          </div>
        )}
      </div>

      {/* ─── Add Rack Modal ──────────────────────────────────────── */}
      {showAddRack && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-morphism rounded-[2rem] border border-border w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/50">
              <h2 className="font-display font-black text-xl tracking-tight uppercase">New Rack</h2>
              <button onClick={() => setShowAddRack(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddRack}>
              <div className="p-6 space-y-4 bg-card">
                <div>
                  <label className="block label-eyebrow text-muted-foreground mb-1.5">Rack Number / Name *</label>
                  <input name="rackNumber" required autoFocus placeholder="e.g. 1 or A" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block label-eyebrow text-muted-foreground mb-1.5">Description (Optional)</label>
                  <input name="description" placeholder="e.g. Fiction Section" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddRack(false)} className="px-5 h-11 label-eyebrow text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 h-11 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 rounded-2xl transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Assign Book Modal ───────────────────────────────────── */}
      {showAssignBookToShelf && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-morphism rounded-[2rem] border border-border w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/50">
              <h2 className="font-display font-black text-xl tracking-tight uppercase">Assign to Shelf {showAssignBookToShelf}</h2>
              <button onClick={() => setShowAssignBookToShelf(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            {/* Search Input inside Modal */}
            <AssignBookSearch 
              books={unassignedAvailableBooks} 
              onAssign={(ids) => { handleAssignBooks(ids, showAssignBookToShelf); setShowAssignBookToShelf(null); }} 
            />

          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent for handling search efficiently
function AssignBookSearch({ books, onAssign }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const filtered = search.trim() 
    ? books.filter(b => 
        (b.title || '').toLowerCase().includes(search.toLowerCase()) || 
        (b.accessionNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.author || '').toLowerCase().includes(search.toLowerCase())
      )
    : books;

  // Render only up to 50 items to avoid DOM lag
  const displayedBooks = filtered.slice(0, 50);

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(b => b.id)));
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-card">
      <div className="p-5 border-b border-border space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Search unassigned books..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
            />
          </div>
          <button 
            disabled={selectedIds.size === 0}
            onClick={() => onAssign(Array.from(selectedIds))}
            className="px-6 label-eyebrow text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-2xl transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" /> Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-semibold">Showing {filtered.length} available, unassigned books.</p>
          <button onClick={toggleAll} className="text-xs font-bold text-primary hover:underline">
            {selectedIds.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All Filtered'}
          </button>
        </div>
      </div>
      <div className="p-5 overflow-y-auto thin-scrollbar flex-1 space-y-2">
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No available books match your search.</div>}
        {displayedBooks.map(b => {
          const isSelected = selectedIds.has(b.id);
          return (
            <div 
              key={b.id} 
              onClick={() => toggleSelect(b.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <div className="flex-shrink-0">
                <input 
                  type="checkbox" 
                  checked={isSelected} 
                  onChange={() => {}} // handled by parent div click
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{b.title}</div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-semibold">
                  <span>Acc: <span className="text-primary">{b.accessionNo}</span></span>
                  <span className="truncate">{b.author}</span>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length > 50 && (
          <div className="text-center text-xs font-semibold text-muted-foreground pt-4 pb-2">
            Showing 50 of {filtered.length} books. Use search to find specific books.
          </div>
        )}
      </div>
    </div>
  );
}
