import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { UploadCloud, CheckCircle2, XCircle, RefreshCw, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { listStudents, updateStudent } from '../../services/firebase/studentsService';
import { uploadToStorage } from '../../lib/storageUtils';
import { toast } from 'sonner';

// Smart matching for Indian names with initials (e.g. "B MAHESH" vs "BENDI MAHESH")
function similarity(fullName, fileName) {
  if (!fullName || !fileName) return 0;
  const fullParts = fullName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const fileParts = fileName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  
  if (fullParts.length === 0 || fileParts.length === 0) return 0;
  
  let score = 0;
  // Make a copy to avoid matching the same fullPart twice
  const availableFullParts = [...fullParts];
  
  for (const fPart of fileParts) {
    let bestPartScore = 0;
    let bestIndex = -1;
    
    for (let i = 0; i < availableFullParts.length; i++) {
      const full = availableFullParts[i];
      if (full === fPart) {
        bestPartScore = 1.0;
        bestIndex = i;
        break; // Exact match is perfect
      } else if (full.startsWith(fPart)) {
        // Prefix match (like "ch" for "challa")
        const prefixScore = 0.5 + (fPart.length / full.length) * 0.4; // 0.5 to 0.9 depending on length
        if (prefixScore > bestPartScore) {
          bestPartScore = prefixScore;
          bestIndex = i;
        }
      }
    }
    
    if (bestIndex !== -1) {
      score += bestPartScore;
      // Remove used part to prevent double matching
      availableFullParts.splice(bestIndex, 1);
    }
  }
  
  return score / Math.max(fullParts.length, fileParts.length);
}

function extractName(filename) {
  return filename.split('.').slice(0, -1).join('.').trim();
}

function parseClass(folderName) {
  if (!folderName) return '';
  let c = folderName.toUpperCase().trim();
  
  // Strip trailing section like " A" or " B" to map to the class name
  c = c.replace(/\s+[A-Z]$/, ''); 
  
  if (c === '10') return '10th';
  if (c === '9') return '9th';
  if (c === '8') return '8th';
  if (c === '7') return '7th';
  if (c === '6') return '6th';
  if (c === '5') return '5th';
  if (c === '4') return '4th';
  if (c === '3') return '3rd';
  if (c === '2') return '2nd';
  if (c === '1') return '1st';
  if (c === 'UKG') return 'UKG';
  if (c === 'LKG') return 'LKG';
  if (c === 'NURSERY') return 'Nursery';
  
  return folderName.trim();
}

export default function BulkPhotoUpload() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    listStudents({ status: 'ACTIVE' }).then(res => {
      setStudents(res);
      setLoading(false);
    });
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Filter only images
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return toast.error('No images found in the selected folder.');

    setSelectedFiles(imageFiles);
    
    // Perform matching
    const newMatches = imageFiles.map(file => {
      const pathParts = file.webkitRelativePath.split('/');
      let detectedClassRaw = '';
      if (pathParts.length >= 3) {
        detectedClassRaw = pathParts[pathParts.length - 2]; 
      }
      
      const detectedClass = parseClass(detectedClassRaw);
      const studentNameExtracted = extractName(file.name);
      
      // STRCIT class filtering to avoid matching students from other classes
      const classStudents = students.filter(s => {
        if (!detectedClass) return true;
        return s.className?.toLowerCase() === detectedClass.toLowerCase();
      });
      
      let bestMatch = null;
      let highestScore = 0;
      
      // ONLY search within the detected class if we found a valid class
      const pool = (detectedClass && classStudents.length > 0) ? classStudents : students;
      
      pool.forEach(s => {
        const score = similarity(s.fullName, studentNameExtracted);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = s;
        }
      });

      // Generate a local preview URL
      const previewUrl = URL.createObjectURL(file);

      return {
        id: file.webkitRelativePath,
        file,
        previewUrl,
        detectedClass,
        extractedName: studentNameExtracted,
        matchedStudentId: bestMatch && highestScore > 0.2 ? bestMatch.id : '',
        confidence: highestScore,
        status: 'pending' // pending, uploading, success, error
      };
    });
    
    setMatches(newMatches);
  };

  const handleMatchChange = (fileId, newStudentId) => {
    setMatches(prev => prev.map(m => m.id === fileId ? { ...m, matchedStudentId: newStudentId } : m));
  };

  const removeMatch = (fileId) => {
    setMatches(prev => prev.filter(m => m.id !== fileId));
  };

  const uploadAll = async () => {
    const validMatches = matches.filter(m => m.matchedStudentId && m.status !== 'success');
    if (validMatches.length === 0) return toast.error('No valid matches to upload.');
    
    if (!window.confirm(`Upload ${validMatches.length} photos?`)) return;
    
    setUploading(true);
    setProgress(0);
    
    let successCount = 0;
    
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'uploading' } : m));
      
      try {
        const student = students.find(s => s.id === match.matchedStudentId);
        const ext = match.file.name.split('.').pop();
        const path = `student-photos/${student.id}_${Date.now()}.${ext}`;
        
        const photoURL = await uploadToStorage(match.file, path);
        await updateStudent(student.id, { photoURL });
        
        setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'success' } : m));
        successCount++;
      } catch (err) {
        setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'error' } : m));
      }
      
      setProgress(Math.round(((i + 1) / validMatches.length) * 100));
    }
    
    setUploading(false);
    toast.success(`Successfully uploaded ${successCount} photos!`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24" data-testid="bulk-photo-upload">
      <div className="flex items-center justify-between">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary hover:underline">← Back to Directory</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Bulk Photo Upload</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload student photos by class folders.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {matches.length === 0 ? (
            <div className="glass-morphism rounded-[2rem] p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-primary/30 bg-primary/5 relative hover:bg-primary/10 transition-colors">
              <UploadCloud className="h-12 w-12 text-primary mb-4" />
              <h3 className="font-bold text-xl mb-2">Select Class Folders</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Select the top-level folder (e.g. "PICS 2026") containing class-wise subfolders, or select a specific class folder. We will automatically read the names and match them to students.
              </p>
              
              <div className="relative">
                <button className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-sm pointer-events-none">
                  Choose Folder
                </button>
                <input 
                  type="file" 
                  webkitdirectory="true" 
                  directory="true" 
                  multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-morphism rounded-[2rem] p-5 flex items-center justify-between sticky top-4 z-10 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-bold">{matches.length} Photos Found</div>
                    <div className="text-sm text-muted-foreground">{matches.filter(m => m.matchedStudentId).length} Matched to Students</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button onClick={() => setMatches([])} disabled={uploading} className="h-10 px-4 rounded-xl border border-border text-sm font-bold hover:bg-muted disabled:opacity-50">
                    Cancel / Reselect
                  </button>
                  <button onClick={uploadAll} disabled={uploading || matches.filter(m => m.matchedStudentId).length === 0} className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 shadow-md hover:bg-primary/90 disabled:opacity-50">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {uploading ? `Uploading ${progress}%` : 'Upload All'}
                  </button>
                </div>
              </div>

              {uploading && (
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-primary" />
                </div>
              )}

              <div className="glass-morphism rounded-[2rem] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-4 font-bold text-left w-24">Photo</th>
                      <th className="p-4 font-bold text-left">Detected Class</th>
                      <th className="p-4 font-bold text-left">Detected Name</th>
                      <th className="p-4 font-bold text-left">Matched Student (Verify)</th>
                      <th className="p-4 font-bold text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matches.map(match => (
                      <tr key={match.id} className={`hover:bg-muted/30 transition-colors ${!match.matchedStudentId ? 'bg-rose-500/5' : ''}`}>
                        <td className="p-4">
                          <img src={match.previewUrl} alt={match.extractedName} className="h-12 w-12 rounded-xl object-cover border border-border" />
                        </td>
                        <td className="p-4 font-mono text-xs">
                          {match.detectedClass || <span className="text-muted-foreground opacity-50">N/A</span>}
                        </td>
                        <td className="p-4 font-bold">
                          {match.extractedName}
                        </td>
                        <td className="p-4">
                          <select 
                            value={match.matchedStudentId} 
                            onChange={e => handleMatchChange(match.id, e.target.value)}
                            disabled={uploading || match.status === 'success'}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm"
                          >
                            <option value="">-- No Match Found, Select Manually --</option>
                            {/* Group students by class to make it easier to find */}
                            {Array.from(new Set(students.map(s => s.className))).sort().map(cls => (
                              <optgroup key={cls} label={`Class ${cls}`}>
                                {students.filter(s => s.className === cls).sort((a,b) => a.fullName.localeCompare(b.fullName)).map(s => (
                                  <option key={s.id} value={s.id}>{s.fullName} ({s.admissionNo})</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {match.confidence > 0 && match.confidence < 0.4 && match.matchedStudentId && (
                            <div className="text-[10px] text-amber-500 mt-1 uppercase font-bold tracking-wider">Low Confidence Match - Please Verify</div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {match.status === 'pending' && (
                            <button onClick={() => removeMatch(match.id)} disabled={uploading} className="p-2 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-500/10" title="Skip this photo">
                              <XCircle className="h-5 w-5 mx-auto" />
                            </button>
                          )}
                          {match.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />}
                          {match.status === 'success' && <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500" />}
                          {match.status === 'error' && <XCircle className="h-5 w-5 mx-auto text-rose-500" title="Upload failed" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
