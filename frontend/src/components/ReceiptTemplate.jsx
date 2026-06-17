import React from 'react';

// Number to words helper
function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
  return str;
}

export default function ReceiptTemplate({ receiptData, id = "receipt-preview" }) {
  if (!receiptData) return null;

  const dateStr = new Date(receiptData.paymentDate || receiptData.paidAt?.toDate() || Date.now()).toLocaleDateString('en-IN');
  const amountStr = Number(receiptData.amount || 0).toLocaleString('en-IN');
  const words = numberToWords(Number(receiptData.amount || 0));

  return (
    <div className="absolute left-[-9999px] top-[-9999px]">
      <div id={id} className="bg-[#fef9e6] text-blue-950 p-8 w-[800px] border-l-[20px] border-[#0a192f] shadow-xl font-serif">
        
        {/* Header */}
        <div className="flex items-center gap-6 border-b-[3px] border-[#0a192f] pb-4">
          <div className="w-24 h-24 rounded-full border-2 border-[#0a192f] p-1 flex-shrink-0">
            {/* SCHOOL LOGO PLACEHOLDER */}
            {/* Replace the 'src' below with your actual school logo path (e.g., '/images/school_logo.png') */}
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white">
              <img src="/school-logo.png" alt="School Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="flex-1 text-center">
            <h1 className="font-black text-4xl tracking-tight text-[#0a192f] whitespace-nowrap" style={{ fontFamily: 'Georgia, serif' }}>
              St. Paul's High School
            </h1>
            <p className="text-sm font-bold mt-2 text-[#0a192f]">Affiliated to CISCE - New Delhi, R.C.No.: 1209/AP111/CISCE/06-11-2024</p>
            <p className="text-xs mt-0.5 text-[#0a192f]">(Under St. Pauls Educational Society)</p>
            <p className="text-xs font-bold mt-0.5 text-[#0a192f]">(A Christian Minority Institution)</p>
            <p className="text-xs mt-0.5 font-semibold text-[#0a192f]">Mission Compound, Ring Road, Srikakulam - 532 001</p>
            <p className="text-xs font-bold mt-1 text-[#0a192f]">All Donations are Tax Exempt U/s. 80G/CIT-2/ VSKP / 11-12</p>
          </div>
          <div className="w-24 flex-shrink-0"></div> {/* Spacer for center alignment */}
        </div>

        {/* Receipt Title & Meta */}
        <div className="text-center mt-6">
          <h2 className="text-2xl font-bold tracking-[0.3em] text-[#0a192f]">RECEIPT</h2>
        </div>

        <div className="flex justify-between items-start mt-4 px-4">
          <div>
            <div className="text-4xl font-bold text-red-600 font-mono tracking-tighter drop-shadow-sm">
              {receiptData.receiptNo || '—'}
            </div>
            <div className="text-lg font-bold text-[#0a192f] mt-2">
              Academic Year : <span className="border-b-2 border-dotted border-[#0a192f]/50 inline-block min-w-[100px] text-center pb-0.5 font-normal">{receiptData.academicYear || '2026-27'}</span>
            </div>
          </div>
          <div className="text-lg font-bold text-[#0a192f] flex flex-col items-end">
            <div>
              Date : <span className="border-b-2 border-dotted border-[#0a192f]/50 inline-block min-w-[140px] text-center pb-0.5 font-normal">{dateStr}</span>
            </div>
          </div>
        </div>

        {/* Body content matching the classic styling */}
        <div className="mt-10 space-y-10 px-4 text-xl leading-relaxed text-[#0a192f]">
          <div className="flex items-end">
            <span className="whitespace-nowrap italic mr-4 font-bold text-xl">Received with thanks from</span>
            <span className="flex-1 border-b-2 border-dotted border-[#0a192f]/50 pb-0.5 font-bold font-sans text-2xl text-center">
              {receiptData.studentName || receiptData.student?.fullName || receiptData.student?.name || '—'} 
              <span className="text-sm font-normal ml-3 opacity-80 italic font-serif">
                (Adm No: {receiptData.admissionNo || receiptData.student?.admissionNo || '—'}, Class: {receiptData.className || receiptData.student?.className || '—'} {receiptData.section || receiptData.student?.section ? ` - ${receiptData.section || receiptData.student?.section}` : ''})
              </span>
            </span>
          </div>

          <div className="flex items-end flex-wrap gap-y-4">
            <span className="whitespace-nowrap italic mr-4 font-bold text-xl">the sum of Rupees (in words)</span>
            <span className="flex-1 border-b-2 border-dotted border-[#0a192f]/50 pb-0.5 font-bold font-sans text-center min-w-[200px]">
              {words}
            </span>
            <span className="whitespace-nowrap italic ml-4 mr-4 font-bold text-xl">by</span>
            <span className="border-b-2 border-dotted border-[#0a192f]/50 pb-0.5 font-bold font-sans text-center min-w-[100px] uppercase">
              {receiptData.paymentMethod || receiptData.mode || 'CASH'}
            </span>
          </div>

          <div className="flex items-end">
            <span className="whitespace-nowrap italic font-bold text-xl mr-4">towards </span>
            <span className="flex-1 border-b-2 border-dotted border-[#0a192f]/50 pb-0.5 text-center font-sans font-semibold text-2xl">
              {receiptData.feeName || 'School Fee'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 px-6 flex justify-between items-end mb-4">
          <div className="flex items-stretch border-2 border-[#0a192f] rounded-2xl overflow-hidden h-20 w-80 shadow-md">
            <div className="bg-[#0a192f] text-white flex items-center justify-center px-6 font-bold text-4xl">
              ₹
            </div>
            <div className="flex-1 flex items-center justify-center bg-white text-3xl font-bold tracking-wider font-mono text-[#0a192f]">
              {amountStr}/-
            </div>
          </div>
          
          <div className="text-center flex flex-col items-center">
            <div className="h-20 flex items-end justify-center w-full relative">
              <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-90">
                 <img src="/cashier_signature.png" alt="Signature" className="h-16 object-contain mix-blend-multiply" />
              </div>
            </div>
            <div className="border-t-[2px] border-[#0a192f] w-56 pt-2 font-bold italic text-lg text-[#0a192f]">
              Signature
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
