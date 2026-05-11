// Shared in-memory demo store so that the app feels alive without a real Firestore.
// Keeps recent admissions, transactions, attendance, announcements, tickets, etc.
import { generateAdmissionNo } from '../lib/utils';

const today = () => new Date().toISOString();

const seed = {
  students: [
    { id: 's1', tenantId: 'demo', admissionNo: 'ADM20253142', firstName: 'Aarav', lastName: 'Sharma', fullName: 'Aarav Sharma', className: 'X', section: 'A', rollNo: '12', status: 'ACTIVE', phoneNumber: '+919812345671', fatherName: 'Rahul Sharma', motherName: 'Anita Sharma', admissionDate: today(), photoURL: '' },
    { id: 's2', tenantId: 'demo', admissionNo: 'ADM20253143', firstName: 'Diya', lastName: 'Patel', fullName: 'Diya Patel', className: 'IX', section: 'B', rollNo: '08', status: 'ACTIVE', phoneNumber: '+919812345672', fatherName: 'Kunal Patel', motherName: 'Riya Patel', admissionDate: today(), photoURL: '' },
    { id: 's3', tenantId: 'demo', admissionNo: 'ADM20253144', firstName: 'Kabir', lastName: 'Singh', fullName: 'Kabir Singh', className: 'XII', section: 'A', rollNo: '03', status: 'ACTIVE', phoneNumber: '+919812345673', fatherName: 'Manjit Singh', motherName: 'Simran Kaur', admissionDate: today(), photoURL: '' },
    { id: 's4', tenantId: 'demo', admissionNo: 'ADM20253145', firstName: 'Ananya', lastName: 'Iyer', fullName: 'Ananya Iyer', className: 'VIII', section: 'C', rollNo: '17', status: 'ACTIVE', phoneNumber: '+919812345674', fatherName: 'Suresh Iyer', motherName: 'Lakshmi Iyer', admissionDate: today(), photoURL: '' },
    { id: 'demo-stu-1', tenantId: 'demo', admissionNo: 'ADM20253101', firstName: 'Aanya', lastName: 'Iyer', fullName: 'Aanya Iyer', className: 'VII', section: 'A', rollNo: '04', status: 'ACTIVE', phoneNumber: '+919812345675', fatherName: 'Rahul Iyer', motherName: 'Priya Iyer', admissionDate: today(), photoURL: '' },
  ],
  employees: [
    { id: 'e1', tenantId: 'demo', employeeId: 'EMP001', fullName: 'Meera Krishnan', role: 'TEACHER', department: 'Mathematics', designation: 'Senior Teacher', status: 'ACTIVE' },
    { id: 'e2', tenantId: 'demo', employeeId: 'EMP002', fullName: 'Arjun Desai', role: 'TEACHER', department: 'Science', designation: 'HOD', status: 'ACTIVE' },
    { id: 'e3', tenantId: 'demo', employeeId: 'EMP003', fullName: 'Pooja Rao', role: 'STAFF', department: 'Administration', designation: 'Coordinator', status: 'ACTIVE' },
  ],
  subjects: [
    { id: 'sub1', tenantId: 'demo', name: 'Mathematics', code: 'MATH', className: 'X' },
    { id: 'sub2', tenantId: 'demo', name: 'Science', code: 'SCI', className: 'X' },
    { id: 'sub3', tenantId: 'demo', name: 'English', code: 'ENG', className: 'X' },
    { id: 'sub4', tenantId: 'demo', name: 'Social Studies', code: 'SST', className: 'X' },
  ],
  topics: [
    { id: 't1', tenantId: 'demo', subjectId: 'sub1', subjectName: 'Mathematics', topicName: 'Algebra Basics', status: 'COMPLETED' },
    { id: 't2', tenantId: 'demo', subjectId: 'sub1', subjectName: 'Mathematics', topicName: 'Quadratic Equations', status: 'IN_PROGRESS' },
    { id: 't3', tenantId: 'demo', subjectId: 'sub1', subjectName: 'Mathematics', topicName: 'Trigonometry', status: 'NOT_STARTED' },
    { id: 't4', tenantId: 'demo', subjectId: 'sub2', subjectName: 'Science', topicName: 'Chemical Reactions', status: 'COMPLETED' },
    { id: 't5', tenantId: 'demo', subjectId: 'sub2', subjectName: 'Science', topicName: 'Electricity', status: 'IN_PROGRESS' },
  ],
  transactions: [
    { id: 'tx1', tenantId: 'demo', studentId: 's1', studentName: 'Aarav Sharma', feeName: 'Tuition Q2', amount: 18500, paymentDate: today(), paymentMethod: 'ONLINE', receiptNo: 'RCPT00211', status: 'PAID' },
    { id: 'tx2', tenantId: 'demo', studentId: 's2', studentName: 'Diya Patel', feeName: 'Transport', amount: 4200, paymentDate: today(), paymentMethod: 'CASH', receiptNo: 'RCPT00212', status: 'PAID' },
    { id: 'tx3', tenantId: 'demo', studentId: 's3', studentName: 'Kabir Singh', feeName: 'Tuition Q2', amount: 22000, paymentDate: today(), paymentMethod: 'ONLINE', receiptNo: 'RCPT00213', status: 'PENDING' },
    { id: 'tx4', tenantId: 'demo', studentId: 's4', studentName: 'Ananya Iyer', feeName: 'Hostel', amount: 12000, paymentDate: today(), paymentMethod: 'CHEQUE', receiptNo: 'RCPT00214', status: 'OVERDUE' },
    { id: 'tx5', tenantId: 'demo', studentId: 'demo-stu-1', studentName: 'Aanya Iyer', feeName: 'Tuition Q2', amount: 16500, paymentDate: today(), paymentMethod: 'ONLINE', receiptNo: 'RCPT00215', status: 'PAID' },
    { id: 'tx6', tenantId: 'demo', studentId: 'demo-stu-1', studentName: 'Aanya Iyer', feeName: 'Activity Fee', amount: 2500, paymentDate: today(), paymentMethod: 'PENDING', receiptNo: 'RCPT00216', status: 'PENDING' },
  ],
  announcements: [
    { id: 'a1', tenantId: 'demo', title: 'Annual Day on Dec 18', description: 'All parents invited at 5:00 PM in the school auditorium.', targetRole: 'ALL', date: today(), postedBy: 'Principal' },
    { id: 'a2', tenantId: 'demo', title: 'Mid-Term Results', description: 'Results published in parent portal.', targetRole: 'PARENT', date: today(), postedBy: 'Exam Cell' },
    { id: 'a3', tenantId: 'demo', title: 'Staff Meeting Friday', description: 'Faculty room, 4 PM.', targetRole: 'STAFF', date: today(), postedBy: 'Vice Principal' },
  ],
  tickets: [
    { id: 'tk1', tenantId: 'demo', ticketNo: 'TKT0019', title: 'Bus Route Change', message: 'Need new pickup point near Banjara Hills.', priority: 'HIGH', status: 'OPEN', category: 'Transport', createdByName: 'Priya Iyer', createdAt: today() },
    { id: 'tk2', tenantId: 'demo', ticketNo: 'TKT0018', title: 'Fee Receipt Missing', message: 'Receipt for September not generated.', priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Finance', createdByName: 'Rahul Iyer', createdAt: today() },
    { id: 'tk3', tenantId: 'demo', ticketNo: 'TKT0017', title: 'Lost ID Card', message: 'Class VII A — duplicate request.', priority: 'LOW', status: 'RESOLVED', category: 'Admin', createdByName: 'Anita Sharma', createdAt: today() },
  ],
  results: [
    { id: 'r1', tenantId: 'demo', studentId: 'demo-stu-1', subjectName: 'Mathematics', examName: 'Mid-Term', marks: 88, totalMarks: 100, grade: 'A' },
    { id: 'r2', tenantId: 'demo', studentId: 'demo-stu-1', subjectName: 'Science', examName: 'Mid-Term', marks: 92, totalMarks: 100, grade: 'A+' },
    { id: 'r3', tenantId: 'demo', studentId: 'demo-stu-1', subjectName: 'English', examName: 'Mid-Term', marks: 79, totalMarks: 100, grade: 'B' },
    { id: 'r4', tenantId: 'demo', studentId: 'demo-stu-1', subjectName: 'Social Studies', examName: 'Mid-Term', marks: 84, totalMarks: 100, grade: 'A' },
  ],
  holidays: [
    { id: 'h1', tenantId: 'demo', title: 'Diwali Break', date: '2025-11-12', type: 'NATIONAL', description: 'School closed' },
    { id: 'h2', tenantId: 'demo', title: 'Founders Day', date: '2025-12-04', type: 'SCHOOL', description: 'Cultural programmes' },
    { id: 'h3', tenantId: 'demo', title: 'Christmas', date: '2025-12-25', type: 'NATIONAL', description: '' },
  ],
  transportRoutes: [
    { id: 'tr1', tenantId: 'demo', code: 'R-01', bus: 'TS09-AB-1234', driver: 'Ramesh', riders: 42, status: 'ON ROUTE', stops: ['Banjara Hills', 'Jubilee Hills', 'Madhapur', 'School'] },
    { id: 'tr2', tenantId: 'demo', code: 'R-02', bus: 'TS09-AB-2456', driver: 'Suresh', riders: 38, status: 'ON ROUTE', stops: ['Kondapur', 'Gachibowli', 'Kothaguda', 'School'] },
    { id: 'tr3', tenantId: 'demo', code: 'R-03', bus: 'TS09-AB-3678', driver: 'Murali', riders: 51, status: 'ON ROUTE', stops: ['Begumpet', 'Ameerpet', 'Hi-Tech City', 'School'] },
    { id: 'tr4', tenantId: 'demo', code: 'R-04', bus: 'TS09-AB-4890', driver: 'Karthik', riders: 33, status: 'AT DEPOT', stops: ['Secunderabad', 'Paradise', 'Punjagutta', 'School'] },
  ],
  hostelRooms: Array.from({ length: 24 }, (_, i) => ({
    id: `hr${i + 1}`, tenantId: 'demo',
    number: 100 + i + 1,
    block: i < 12 ? 'A' : 'B',
    capacity: 4,
    occupied: i % 5 === 0 ? 0 : i % 3 === 0 ? 4 : 2 + (i % 2),
  })),
  exams: [
    {
      id: 'ex1', tenantId: 'demo', title: 'Mathematics Quick Quiz', subjectName: 'Mathematics', className: 'VII',
      duration: 10, totalMarks: 30, status: 'ACTIVE',
      questions: [
        { id: 'q1', question: 'What is 12 × 9?', options: ['108', '118', '98', '128'], correctAnswer: 0, marks: 10 },
        { id: 'q2', question: 'Solve: (3 + 4) × 2', options: ['10', '14', '12', '18'], correctAnswer: 1, marks: 10 },
        { id: 'q3', question: 'Square root of 144?', options: ['10', '11', '12', '13'], correctAnswer: 2, marks: 10 },
      ],
    },
    {
      id: 'ex2', tenantId: 'demo', title: 'Science Concepts', subjectName: 'Science', className: 'VII',
      duration: 12, totalMarks: 40, status: 'ACTIVE',
      questions: [
        { id: 'q1', question: 'Which gas do plants release during photosynthesis?', options: ['CO₂', 'O₂', 'N₂', 'H₂'], correctAnswer: 1, marks: 10 },
        { id: 'q2', question: 'Unit of electric current?', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], correctAnswer: 2, marks: 10 },
        { id: 'q3', question: 'Speed of light approx?', options: ['3×10⁵ km/s', '3×10⁸ m/s', '3×10⁶ m/s', '3×10⁷ m/s'], correctAnswer: 1, marks: 10 },
        { id: 'q4', question: 'Boiling point of water at sea level?', options: ['90°C', '95°C', '100°C', '110°C'], correctAnswer: 2, marks: 10 },
      ],
    },
  ],
  gallery: [
    { id: 'g1', tenantId: 'demo', eventName: 'Annual Day 2025', caption: 'Cultural Showcase', photoURL: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80' },
    { id: 'g2', tenantId: 'demo', eventName: 'Sports Meet', caption: 'Track & Field Champions', photoURL: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=900&q=80' },
    { id: 'g3', tenantId: 'demo', eventName: 'Science Expo', caption: 'Innovation Lab', photoURL: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=80' },
    { id: 'g4', tenantId: 'demo', eventName: 'Republic Day', caption: 'Flag Hoisting Ceremony', photoURL: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&q=80' },
    { id: 'g5', tenantId: 'demo', eventName: 'Art Festival', caption: 'Student Exhibition', photoURL: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&q=80' },
    { id: 'g6', tenantId: 'demo', eventName: 'Field Trip', caption: 'Botanical Gardens', photoURL: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&q=80' },
  ],
};

const STORAGE_KEY = 'benita_demo_store_v1';
let memory = null;

const load = () => {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memory = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(seed));
  } catch {
    memory = JSON.parse(JSON.stringify(seed));
  }
  return memory;
};
const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch {} };

export const demoStore = {
  list: (key) => [...(load()[key] || [])],
  add: (key, item) => {
    const m = load();
    const id = item.id || `${key}-${Date.now()}`;
    const row = { ...item, id, tenantId: item.tenantId || 'demo', createdAt: today() };
    m[key] = [row, ...(m[key] || [])];
    persist();
    return row;
  },
  update: (key, id, patch) => {
    const m = load();
    m[key] = (m[key] || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
    persist();
  },
  remove: (key, id) => {
    const m = load();
    m[key] = (m[key] || []).filter((r) => r.id !== id);
    persist();
  },
  reset: () => { memory = JSON.parse(JSON.stringify(seed)); persist(); },
};

export const newAdmissionNo = generateAdmissionNo;
