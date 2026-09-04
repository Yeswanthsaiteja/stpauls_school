import React from 'react';

const ReportCardPDF = ({ id, student, examName, results, examSetup }) => {
  if (!student || !results || results.length === 0) return null;

  // Calculate totals
  let totalMax = 0;
  let totalMin = 0;
  let totalGained = 0;
  let allPassed = true;

  results.forEach(r => {
    let setupSubject = null;
    if (examSetup && examSetup.schedule && student.className && examSetup.schedule[student.className]) {
      setupSubject = examSetup.schedule[student.className].find(s => s.subjectName === (r.subject || r.subjectName));
    }
    if (!setupSubject?.isGradeOnly) {
      const max = setupSubject ? Number(setupSubject.totalMarks) : (Number(r.totalMarks) || 100);
      const min = setupSubject ? Number(setupSubject.minMarks) : (Number(r.minMarks) || 35);
      
      totalMax += max;
      totalMin += min;

      if (r.marks === 'AB') {
        allPassed = false;
      } else {
        const marks = Number(r.marks) || 0;
        totalGained += marks;
        if (marks < min) {
          allPassed = false;
        }
      }
    }
  });

  const percentage = totalMax > 0 ? ((totalGained / totalMax) * 100).toFixed(2) : 0;

  return (
    <div 
      id={id} 
      className="bg-white w-[794px] h-[1123px] p-6 text-black absolute top-[-9999px] left-[-9999px]"
      style={{ fontFamily: "'Times New Roman', serif" }}
    >
      {/* Inject Google Font for Old English style as fallback */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}
      </style>
      <div className="border-[10px] border-red-700 w-full h-full p-4 flex flex-col relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-[3px] border-black pb-2 mb-2">
           <img src="/school_logo.png" alt="Logo" className="w-[90px] h-[90px] object-contain ml-2" crossOrigin="anonymous" />
           <div className="text-center flex-1 px-4">
              <h1 className="text-[2.5rem] text-[#000080] font-bold mb-1 leading-tight tracking-wide">
                <span style={{ fontFamily: "'Old English Text MT', 'UnifrakturMaguntia', serif" }}>S</span><span style={{ fontFamily: "Arial, sans-serif" }}>T. </span>
                <span style={{ fontFamily: "'Old English Text MT', 'UnifrakturMaguntia', serif" }}>P</span><span style={{ fontFamily: "Arial, sans-serif" }}>AUL'S </span>
                <span style={{ fontFamily: "'Old English Text MT', 'UnifrakturMaguntia', serif" }}>H</span><span style={{ fontFamily: "Arial, sans-serif" }}>IGH </span>
                <span style={{ fontFamily: "'Old English Text MT', 'UnifrakturMaguntia', serif" }}>S</span><span style={{ fontFamily: "Arial, sans-serif" }}>CHOOL</span>
              </h1>
              <p className="text-[10px] font-bold text-[#000080] leading-snug">
                (Affiliated to CISCE New Delhi ( Affiliation No- 1209/AP111/CISCE/06-11-2024
              </p>
              <p className="text-[10px] font-bold text-[#000080] leading-snug">
                Head Post Office Road, Ring Road, Srikakulam-532001.AP
              </p>
              <p className="text-[10px] font-bold text-[#000080] leading-snug">
                Contact : 8978186701, E-Mail : saintpaul.sklm@gmail.com
              </p>
              <p className="text-[10px] font-bold text-[#000080] leading-snug">
                Website : www.stpaulshighschool.net
              </p>
           </div>
        </div>

        {/* Title */}
        <div className="text-center mb-1">
          <h2 className="text-[2rem] font-bold text-[#000080] tracking-wider mb-1">ACHIEVEMENT RECORD</h2>
          <div className="flex items-center justify-center">
            <div className="h-[2px] w-[150px] bg-[#000080]"></div>
            <span className="px-4 text-[#000080] font-bold text-xl">{student.academicYear || '2024-25'}</span>
            <div className="h-[2px] w-[150px] bg-[#000080]"></div>
          </div>
        </div>

        {/* STUDENT DETAILS section title */}
        <div className="flex w-full mb-2 ml-2">
          <div className="bg-black text-white px-4 py-1.5 font-bold tracking-widest text-sm">
            STUDENT DETAILS
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[1.1rem] font-bold text-[#000080] pl-2 mb-4">
          <div>Student Name: <span className="capitalize">{student.name || student.fullName}</span></div>
          <div>Class: {student.className}</div>
          <div>Section: {student.section}</div>
          <div>Father Name: <span className="capitalize">{student.fatherName || student.parentName || '-'}</span></div>
        </div>

        {/* Exam Name */}
        <div className="flex justify-center mb-2">
          <div className="bg-[#b31b1b] text-white px-10 py-1.5 text-2xl font-bold uppercase rounded shadow-sm tracking-wider">
            {examName}
          </div>
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-400 mb-1 text-center mt-1">
          <thead>
            <tr className={`border border-gray-400 ${results.length > 8 ? 'h-8' : 'h-12'}`}>
              <th className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-[11px]' : 'p-2 text-[13px]'} font-bold w-[25%]`}>SUBJECT :</th>
              <th className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-[11px]' : 'p-2 text-[13px]'} font-bold`}>MAX.MARKS</th>
              <th className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-[11px]' : 'p-2 text-[13px]'} font-bold`}>MIN.MARKS</th>
              <th className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-[11px]' : 'p-2 text-[13px]'} font-bold`}>MARKS GAINED</th>
              <th className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-[11px]' : 'p-2 text-[13px]'} font-bold w-[25%]`}>REMARKS ( PASS/FAIL)</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              let setupSubject = null;
              if (examSetup && examSetup.schedule && student.className && examSetup.schedule[student.className]) {
                setupSubject = examSetup.schedule[student.className].find(s => s.subjectName === (r.subject || r.subjectName));
              }

              const isGradeOnly = setupSubject?.isGradeOnly;

              if (isGradeOnly) {
                const isAbsent = r.grade === 'AB' || r.marks === 'AB';
                return (
                  <tr key={r.id || r.subject} className={`border border-gray-400 ${results.length > 10 ? 'h-6' : (results.length > 8 ? 'h-8' : 'h-10')}`}>
                    <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold text-left pl-4 uppercase`}>{r.subject || r.subjectName}</td>
                    <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-semibold`}>-</td>
                    <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-semibold`}>-</td>
                    <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold`}>{isAbsent ? 'AB' : (r.grade || '-')}</td>
                    <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold`}>-</td>
                  </tr>
                );
              }

              const max = setupSubject ? Number(setupSubject.totalMarks) : (Number(r.totalMarks) || 100);
              const min = setupSubject ? Number(setupSubject.minMarks) : (Number(r.minMarks) || 35);
              const isAbsent = r.marks === 'AB';
              const marks = isAbsent ? 0 : Number(r.marks) || 0;
              const isPass = !isAbsent && (marks >= min);
              
              return (
                <tr key={r.id || r.subject} className={`border border-gray-400 ${results.length > 10 ? 'h-6' : (results.length > 8 ? 'h-8' : 'h-10')}`}>
                  <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold text-left pl-4 uppercase`}>{r.subject || r.subjectName}</td>
                  <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-semibold`}>{max}</td>
                  <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-semibold`}>{min}</td>
                  <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold`}>{isAbsent ? 'AB' : marks}</td>
                  <td className={`border border-gray-400 ${results.length > 8 ? 'p-1 text-xs' : 'p-2 text-sm'} font-bold`}>{isPass ? 'PASS' : 'FAIL'}</td>
                </tr>
              );
            })}
            <tr className={`border border-gray-400 ${results.length > 8 ? 'h-8' : 'h-10'} font-bold ${results.length > 8 ? 'text-xs' : 'text-sm'}`}>
              <td className={`border border-gray-400 ${results.length > 8 ? 'p-1' : 'p-2'} text-left pl-4`}>TOTAL</td>
              <td className={`border border-gray-400 ${results.length > 8 ? 'p-1' : 'p-2'}`}>{totalMax}</td>
              <td className={`border border-gray-400 ${results.length > 8 ? 'p-1' : 'p-2'}`}></td>
              <td className={`border border-gray-400 ${results.length > 8 ? 'p-1' : 'p-2'}`}>{totalGained}</td>
              <td className={`border border-gray-400 ${results.length > 8 ? 'p-1' : 'p-2'}`}></td>
            </tr>
          </tbody>
        </table>

        {/* Footer (Percentage and Stamp) */}
        <div className="flex justify-between items-center px-6 mt-4 relative z-10">
          <div className="text-xl font-bold flex items-end gap-2">
            <span className="mb-1">Percentage :</span>
            <span className="border-b-2 border-black inline-block min-w-[120px] text-center pb-0.5">{percentage}%</span>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] z-0">
             {/* Stamp */}
             {allPassed ? (
               <div className="border-[5px] border-[#2e7d32] text-[#2e7d32] rounded-full w-[90px] h-[90px] flex items-center justify-center -rotate-12 font-black text-lg tracking-widest opacity-80 border-double bg-white">
                  PASSED
               </div>
             ) : (
               <div className="border-[5px] border-[#d32f2f] text-[#d32f2f] rounded-full w-[90px] h-[90px] flex items-center justify-center -rotate-12 font-black text-lg tracking-widest opacity-80 border-double bg-white">
                  FAILED
               </div>
             )}
          </div>
        </div>

        {/* Spacer to push signatures to bottom but above border */}
        <div className="flex-1 min-h-[5px]"></div>

        {/* Signatures */}
        <div className="flex justify-between items-end mt-1 mb-1 px-10 font-bold text-xl relative z-20">
          <div>Parent Signature</div>
          <div className="flex flex-col items-center">
            <img src="/principal_signature.jpg" alt="Principal Signature" className="h-16 mb-1 object-contain mix-blend-multiply" crossOrigin="anonymous" />
            <div>Principal Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardPDF;
