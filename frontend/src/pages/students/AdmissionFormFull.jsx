import React, { useState, useCallback, memo, useEffect } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Upload, Check, User, MapPin, Users, GraduationCap, HeartPulse, Bus, FileText, Loader2 } from 'lucide-react';
import { addStudent, getStudent, updateStudent } from '../../services/firebase/studentsService';
import { listClasses } from '../../services/firebase/academicService';
import { listRoutes, addAllocation as addTransportAllocation } from '../../services/firebase/transportService';
import { listRooms, allocateRoom } from '../../services/firebase/hostelService';
import { toast } from 'sonner';

// ─── STEPS ────────────────────────────────────────────────────────────────────
const STEPS = [
  { k: 'personal',   label: 'Personal',        icon: User },
  { k: 'contact',    label: 'Contact',          icon: MapPin },
  { k: 'parent',     label: 'Parent Info',      icon: Users },
  { k: 'admission',  label: 'Admission',        icon: GraduationCap },
  { k: 'health',     label: 'Health',           icon: HeartPulse },
  { k: 'transport',  label: 'Transport/Hostel', icon: Bus },
  { k: 'documents',  label: 'Documents',        icon: FileText },
];

// ─── STYLE CONSTANTS ─────────────────────────────────────────────────────────
const inputCls = 'mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card outline-none focus:border-primary text-sm transition-colors';
const selectCls = 'mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm transition-colors focus:border-primary';
const labelCls = 'label-eyebrow text-muted-foreground';

// ─── FIELD & SELECT — defined OUTSIDE component so React never re-creates them
// Using `name` prop + single onChange handler is the bulletproof way to avoid
// React unmounting inputs on every keystroke (focus-loss bug).

const Field = memo(function Field({ label, name, type = 'text', placeholder, full, required, value, onChange }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className={labelCls}>{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={onChange}
        required={required}
        autoComplete="off"
        className={inputCls}
        data-testid={`adm-${name}`}
      />
    </div>
  );
});

const Sel = memo(function Sel({ label, name, options, required, value, onChange }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <select name={name} value={value} onChange={onChange} required={required} className={selectCls} data-testid={`adm-${name}`}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
});

// ─── INITIAL FORM STATE ───────────────────────────────────────────────────────
const INIT = {
  // personal
  firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', bloodGroup: '', aadharNumber: '',
  nationality: 'Indian', religion: '', category: 'General', motherTongue: '', photoURL: '',
  // contact
  address: '', currentAddress: '', sameAsPermanent: true, city: '', state: '', pinCode: '',
  phoneNumber: '', email: '',
  // parent
  fatherName: '', fatherOccupation: '', fatherPhone: '', fatherEmail: '', fatherAadhar: '', fatherIncome: '',
  motherName: '', motherOccupation: '', motherPhone: '', motherEmail: '', motherAadhar: '', motherIncome: '',
  guardianName: '', guardianRelation: '', guardianPhone: '', annualIncome: '',
  // admission
  admissionDate: new Date().toISOString().slice(0, 10),
  className: '5th', section: 'A', academicYear: '2025-26',
  admissionType: 'New', previousSchool: '', lastGradePassed: '', tcNumber: '',
  mediumOfInstruction: 'English', house: 'Red', siblings: '',
  // health
  medicalConditions: '', allergies: '', emergencyName: '', emergencyContact: '', specialNeeds: '',
  // transport / hostel
  usesBus: false, busRoute: '', inHostel: false, hostelRoom: '',
  // documents (handled separately)
  docs: { birth: null, aadhar: null, tc: null, caste: null, passport: null, other: null },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdmissionFormFull() {
  const { id } = useParams();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(!!id);
  const [data, setData] = useState(INIT);
  const [classes, setClasses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [clsList, routesList, roomsList] = await Promise.all([listClasses(), listRoutes(), listRooms()]);
      setClasses(clsList);
      setRoutes(routesList);
      setRooms(roomsList);
      if (id) {
        const student = await getStudent(id);
        if (student) setData({ ...INIT, ...student });
        setLoadingData(false);
      }
    }
    load();
  }, [id]);

  // ── Single stable handler — NEVER recreated, no focus-loss ─────────────────
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setData((d) => ({ ...d, [name]: type === 'checkbox' ? checked : value }));
  }, []); // empty deps → function reference never changes

  const onPhoto = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setData((d) => ({ ...d, photoURL: String(ev.target.result || '') }));
    r.readAsDataURL(f);
  }, []);

  const onDoc = useCallback((key) => (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setData((d) => ({ ...d, docs: { ...d.docs, [key]: { name: f.name, dataURL: String(ev.target.result || '') } } }));
    r.readAsDataURL(f);
  }, []);

  const submit = useCallback(async () => {
    // Full validation on final submit
    if (!data.firstName.trim() || !data.lastName.trim()) { setStep(0); return toast.error('First and last name are required'); }
    if (!data.dateOfBirth)   { setStep(0); return toast.error('Date of birth is required'); }
    if (!data.phoneNumber)   { setStep(1); return toast.error('Phone number is required'); }
    if (!data.address.trim()) { setStep(1); return toast.error('Permanent address is required'); }
    if (!data.city.trim())   { setStep(1); return toast.error('City is required'); }
    if (!data.fatherName.trim()) { setStep(2); return toast.error("Father's name is required"); }
    if (!data.fatherPhone)   { setStep(2); return toast.error("Father's phone is required"); }
    if (!data.motherName.trim()) { setStep(2); return toast.error("Mother's name is required"); }
    if (!data.className)     { setStep(3); return toast.error('Class is required'); }
    if (!data.admissionDate) { setStep(3); return toast.error('Admission date is required'); }
    try {
      const payload = {
        ...data,
        fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
        status: data.status || 'ACTIVE',
      };
      let studentId = id;
      if (id) {
        await updateStudent(id, payload);
        toast.success(`Student updated: ${data.admissionNo || ''}`);
      } else {
        const student = await addStudent(payload);
        studentId = student?.id;
        toast.success(`Admission created: ${student?.admissionNo}`);
      }

      // Auto-create transport allocation if bus is selected
      if (data.usesBus && data.busRouteId && studentId) {
        const route = routes.find((r) => r.id === data.busRouteId);
        await addTransportAllocation({
          studentId, studentName: payload.fullName,
          routeId: data.busRouteId, routeName: route?.name || data.busRoute,
          stop: data.busStop || '',
        });
      }

      // Auto-create hostel allocation if hostel room is selected
      if (data.inHostel && data.hostelRoomId && studentId) {
        const room = rooms.find((r) => r.id === data.hostelRoomId);
        await allocateRoom({
          studentId, studentName: payload.fullName,
          roomId: data.hostelRoomId,
          block: room?.block, roomNumber: room?.number, type: room?.type,
          currentOccupied: room?.occupied || 0,
        });
      }

      navigate('/dashboard/students/directory');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [data, navigate, id]);

  const cur = STEPS[step];
  const classOpts = classes.map(c => c.name);
  const activeClassObj = classes.find(c => c.name === data.className);
  const sectionOpts = activeClassObj ? activeClassObj.sections : ['A', 'B', 'C', 'D'];

  // Per-step validation — called when clicking Next
  const validateAndNext = useCallback(() => {
    if (step === 0) { // Personal
      if (!data.firstName.trim()) return toast.error('First name is required');
      if (!data.lastName.trim())  return toast.error('Last name is required');
      if (!data.dateOfBirth)      return toast.error('Date of birth is required');
    }
    if (step === 1) { // Contact
      if (!data.address.trim())   return toast.error('Permanent address is required');
      if (!data.city.trim())      return toast.error('City is required');
      if (!data.state.trim())     return toast.error('State is required');
      if (!data.phoneNumber)      return toast.error('Phone number is required');
    }
    if (step === 2) { // Parent
      if (!data.fatherName.trim()) return toast.error("Father's name is required");
      if (!data.fatherPhone)       return toast.error("Father's phone number is required");
      if (!data.motherName.trim()) return toast.error("Mother's name is required");
    }
    if (step === 3) { // Admission
      if (!data.admissionDate)     return toast.error('Admission date is required');
      if (!data.className)         return toast.error('Class is required');
      if (!data.academicYear)      return toast.error('Academic year is required');
    }
    if (step === 5) { // Transport/Hostel
      if (data.usesBus && !data.busRouteId) return toast.error('Select a bus route');
      if (data.inHostel && !data.hostelRoomId) return toast.error('Select a hostel room');
    }
    setStep(s => s + 1);
  }, [step, data]);

  if (loadingData) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-5xl" data-testid="admission-form-full">
      <NavLink to=".." className="label-eyebrow text-primary">← Back to Students</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">{id ? 'Edit Student Details' : 'New Admission Form'}</h1>
      <p className="text-sm text-muted-foreground -mt-3">Fields marked <span className="text-rose-500 font-bold">*</span> are required</p>

      {/* ── Stepper ── */}
      <div className="flex gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <button key={s.k} onClick={() => setStep(i)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full label-eyebrow transition-colors ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
            data-testid={`step-${s.k}`}>
            {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}{s.label}
          </button>
        ))}
      </div>

      <div className="glass-morphism rounded-[2rem] p-6">

        {/* ── STEP 1: Personal ── */}
        {cur.k === 'personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="First Name"     name="firstName"   required value={data.firstName}   onChange={handleChange} placeholder="Aarav" />
            <Field label="Last Name"      name="lastName"    required value={data.lastName}    onChange={handleChange} placeholder="Sharma" />
            <Field label="Date of Birth"  name="dateOfBirth" required value={data.dateOfBirth} onChange={handleChange} type="date" />
            <Sel   label="Gender"         name="gender"      required value={data.gender}      onChange={handleChange} options={['Male','Female','Other']} />
            <Sel   label="Blood Group"    name="bloodGroup"           value={data.bloodGroup}   onChange={handleChange} options={['','A+','A-','B+','B-','O+','O-','AB+','AB-']} />
            <Field label="Aadhar Number"  name="aadharNumber"         value={data.aadharNumber} onChange={handleChange} placeholder="XXXX-XXXX-XXXX" />
            <Field label="Nationality"    name="nationality"          value={data.nationality}  onChange={handleChange} />
            <Field label="Religion"       name="religion"             value={data.religion}     onChange={handleChange} />
            <Sel   label="Category"       name="category"    required value={data.category}    onChange={handleChange} options={['General','OBC','SC','ST','EWS']} />
            <Field label="Mother Tongue"  name="motherTongue"         value={data.motherTongue} onChange={handleChange} />
            <div className="col-span-full">
              <label className={labelCls}>Student Photo</label>
              <label className="mt-1.5 block border-2 border-dashed border-border rounded-2xl p-4 text-center cursor-pointer hover:border-primary transition-colors">
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" data-testid="adm-photo" />
                {data.photoURL
                  ? <img src={data.photoURL} alt="student" className="h-24 w-24 object-cover mx-auto rounded-2xl" />
                  : <><Upload className="h-6 w-6 mx-auto text-muted-foreground" /><div className="label-eyebrow text-muted-foreground mt-1">Upload Photo (optional)</div></>
                }
              </label>
            </div>
          </div>
        )}

        {/* ── STEP 2: Contact ── */}
        {cur.k === 'contact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Permanent Address" name="address"     required full value={data.address}     onChange={handleChange} placeholder="House No, Street, Area" />
            <label className="col-span-full flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" name="sameAsPermanent" checked={data.sameAsPermanent} onChange={handleChange} className="accent-indigo-500 h-4 w-4" data-testid="adm-sameAddress" />
              Current address is same as permanent
            </label>
            {!data.sameAsPermanent && (
              <Field label="Current Address" name="currentAddress" full value={data.currentAddress} onChange={handleChange} placeholder="Current address if different" />
            )}
            <Field label="City"             name="city"         required value={data.city}         onChange={handleChange} />
            <Field label="State"            name="state"        required value={data.state}        onChange={handleChange} />
            <Field label="PIN Code"         name="pinCode"      required value={data.pinCode}      onChange={handleChange} placeholder="500001" />
            <Field label="Phone Number"     name="phoneNumber"  required value={data.phoneNumber}  onChange={handleChange} placeholder="+91 9876543210" />
            <Field label="Email"            name="email"                 value={data.email}        onChange={handleChange} type="email" placeholder="student@email.com" />
          </div>
        )}

        {/* ── STEP 3: Parent Info ── */}
        {cur.k === 'parent' && (
          <div className="space-y-6">
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" />Father's Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Father's Full Name"  name="fatherName"       required value={data.fatherName}       onChange={handleChange} />
                <Field label="Occupation"           name="fatherOccupation"          value={data.fatherOccupation} onChange={handleChange} />
                <Field label="Phone"                name="fatherPhone"      required value={data.fatherPhone}      onChange={handleChange} placeholder="+91…" />
                <Field label="Email"                name="fatherEmail"               value={data.fatherEmail}      onChange={handleChange} type="email" />
                <Field label="Aadhar Number"        name="fatherAadhar"              value={data.fatherAadhar}     onChange={handleChange} placeholder="XXXX-XXXX-XXXX" />
                <Field label="Annual Income (₹)"   name="fatherIncome"              value={data.fatherIncome}     onChange={handleChange} type="number" placeholder="500000" />
              </div>
            </div>
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" />Mother's Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Mother's Full Name"  name="motherName"       required value={data.motherName}       onChange={handleChange} />
                <Field label="Occupation"           name="motherOccupation"          value={data.motherOccupation} onChange={handleChange} />
                <Field label="Phone"                name="motherPhone"               value={data.motherPhone}      onChange={handleChange} placeholder="+91…" />
                <Field label="Email"                name="motherEmail"               value={data.motherEmail}      onChange={handleChange} type="email" />
                <Field label="Aadhar Number"        name="motherAadhar"              value={data.motherAadhar}     onChange={handleChange} placeholder="XXXX-XXXX-XXXX" />
                <Field label="Annual Income (₹)"   name="motherIncome"              value={data.motherIncome}     onChange={handleChange} type="number" placeholder="500000" />
              </div>
            </div>
            <div>
              <div className="label-eyebrow text-muted-foreground mb-3">Guardian (if different from parents)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Guardian Name"     name="guardianName"     value={data.guardianName}     onChange={handleChange} />
                <Field label="Relationship"      name="guardianRelation" value={data.guardianRelation} onChange={handleChange} placeholder="Uncle, Aunt, etc." />
                <Field label="Guardian Phone"    name="guardianPhone"    value={data.guardianPhone}    onChange={handleChange} placeholder="+91…" />
              </div>
            </div>
            <Field label="Combined Family Annual Income (₹)" name="annualIncome" value={data.annualIncome} onChange={handleChange} type="number" />
          </div>
        )}

        {/* ── STEP 4: Admission Details ── */}
        {cur.k === 'admission' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Admission Date"       name="admissionDate"       required value={data.admissionDate}       onChange={handleChange} type="date" />
            <Sel   label="Class"                name="className"           required value={data.className}           onChange={handleChange} options={classOpts} />
            <Sel   label="Section"              name="section"             required value={data.section}             onChange={handleChange} options={sectionOpts} />
            <Field label="Academic Year"        name="academicYear"        required value={data.academicYear}        onChange={handleChange} placeholder="2025-26" />
            <Sel   label="Admission Type"       name="admissionType"       required value={data.admissionType}       onChange={handleChange} options={['New','Transfer','Rejoining']} />
            <Field label="Previous School"      name="previousSchool"               value={data.previousSchool}      onChange={handleChange} />
            <Field label="Last Class Passed"    name="lastGradePassed"              value={data.lastGradePassed}     onChange={handleChange} placeholder="e.g. 9th Standard" />
            <Field label="TC Number (Transfer)" name="tcNumber"                     value={data.tcNumber}            onChange={handleChange} />
            <Sel   label="Medium of Instruction" name="mediumOfInstruction" required value={data.mediumOfInstruction} onChange={handleChange} options={['English','Hindi','Telugu','Urdu','Regional']} />
            <Sel   label="House"                name="house"                        value={data.house}               onChange={handleChange} options={['Red','Blue','Green','Yellow']} />
            <Field label="Sibling Admission No." name="siblings"                    value={data.siblings}            onChange={handleChange} placeholder="ADM20253142 (if any)" />
          </div>
        )}

        {/* ── STEP 5: Health ── */}
        {cur.k === 'health' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Medical Conditions"        name="medicalConditions" full value={data.medicalConditions} onChange={handleChange} placeholder="Diabetes, Asthma, etc. (or None)" />
            <Field label="Known Allergies"           name="allergies"         full value={data.allergies}         onChange={handleChange} placeholder="Peanuts, Dust, etc. (or None)" />
            <Field label="Emergency Contact Name"    name="emergencyName"          value={data.emergencyName}     onChange={handleChange} required />
            <Field label="Emergency Contact Phone"   name="emergencyContact"       value={data.emergencyContact}  onChange={handleChange} required placeholder="+91…" />
            <Field label="Special Needs / Disability" name="specialNeeds"     full value={data.specialNeeds}     onChange={handleChange} placeholder="Describe if any, or None" />
          </div>
        )}

        {/* ── STEP 6: Transport / Hostel ── */}
        {cur.k === 'transport' && (
          <div className="space-y-5">
            {/* Transport */}
            <div className="p-5 rounded-2xl border border-border space-y-4">
              <label className="flex items-center gap-3 font-bold cursor-pointer">
                <input type="checkbox" name="usesBus" checked={data.usesBus} onChange={handleChange} className="accent-indigo-500 h-4 w-4" data-testid="adm-usesBus" />
                <Bus className="h-4 w-4 text-primary" /> Student uses school bus
              </label>
              {data.usesBus && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Select Route <span className="text-rose-500">*</span></label>
                    <select name="busRouteId" value={data.busRouteId || ''} onChange={(e) => {
                      const route = routes.find((r) => r.id === e.target.value);
                      setData((d) => ({ ...d, busRouteId: e.target.value, busRoute: route?.name || '' }));
                    }} className={selectCls} data-testid="adm-busRouteId">
                      <option value="">— Select Route —</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                      ))}
                    </select>
                    {routes.length === 0 && <p className="text-xs text-amber-500 mt-1">No routes in database. Add routes in Transport module first.</p>}
                  </div>
                  {data.busRouteId && (
                    <div>
                      <label className={labelCls}>Boarding Stop</label>
                      <select name="busStop" value={data.busStop || ''} onChange={handleChange} className={selectCls} data-testid="adm-busStop">
                        <option value="">— Select Stop —</option>
                        {(routes.find((r) => r.id === data.busRouteId)?.stops || []).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Hostel */}
            <div className="p-5 rounded-2xl border border-border space-y-4">
              <label className="flex items-center gap-3 font-bold cursor-pointer">
                <input type="checkbox" name="inHostel" checked={data.inHostel} onChange={handleChange} className="accent-indigo-500 h-4 w-4" data-testid="adm-inHostel" />
                <Users className="h-4 w-4 text-primary" /> Student stays in hostel
              </label>
              {data.inHostel && (
                <div>
                  <label className={labelCls}>Select Room <span className="text-rose-500">*</span></label>
                  <select name="hostelRoomId" value={data.hostelRoomId || ''} onChange={(e) => {
                    const room = rooms.find((r) => r.id === e.target.value);
                    setData((d) => ({ ...d, hostelRoomId: e.target.value, hostelRoom: room ? `Block ${room.block} – Room ${room.number}` : '' }));
                  }} className={selectCls} data-testid="adm-hostelRoomId">
                    <option value="">— Select Room —</option>
                    {rooms.filter((r) => r.occupied < r.capacity).map((r) => (
                      <option key={r.id} value={r.id}>
                        Block {r.block} – Room {r.number} ({r.type}) · {r.occupied}/{r.capacity} occupied
                      </option>
                    ))}
                  </select>
                  {rooms.filter((r) => r.occupied < r.capacity).length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">No available rooms. Add rooms in Hostel module first.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 7: Documents ── */}
        {cur.k === 'documents' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload scanned copies of required documents. All documents are optional but recommended.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { k: 'birth',    label: 'Birth Certificate',    required: true },
                { k: 'aadhar',   label: 'Aadhar Card',          required: true },
                { k: 'tc',       label: 'Previous TC / SLC',    required: false },
                { k: 'caste',    label: 'Caste / Category Cert.',required: false },
                { k: 'passport', label: 'Passport Photo',        required: true },
                { k: 'other',    label: 'Other Document',        required: false },
              ].map((d) => (
                <label key={d.k} className="block border-2 border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary transition-colors">
                  <input type="file" onChange={onDoc(d.k)} className="hidden" data-testid={`doc-${d.k}`} />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center flex-shrink-0"><Upload className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{d.label}{d.required && <span className="text-rose-500 ml-0.5">*</span>}</div>
                      <div className="label-eyebrow text-muted-foreground truncate">{data.docs[d.k]?.name || 'Click to upload'}</div>
                    </div>
                    {data.docs[d.k] && <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex justify-between gap-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="h-11 px-5 rounded-2xl bg-muted label-eyebrow disabled:opacity-40 hover:bg-muted/80 transition-colors"
          data-testid="adm-back-btn">Back</button>

        {step < STEPS.length - 1 ? (
          <button onClick={validateAndNext}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow hover:opacity-90 transition-opacity"
            data-testid="adm-next-btn">Next →</button>
        ) : (
          <button onClick={submit} disabled={saving}
            className="h-11 px-6 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 disabled:opacity-60 hover:bg-emerald-600 transition-colors"
            data-testid="adm-submit-btn">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Submit Admission
          </button>
        )}
      </div>
    </div>
  );
}
