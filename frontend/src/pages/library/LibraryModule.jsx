import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, Users, UserSquare } from 'lucide-react';
import AccessionRegister from './AccessionRegister';
import StudentIssue from './StudentIssue';
import StaffIssue from './StaffIssue';
import RackArrangement from './RackArrangement';

export default function LibraryModule() {
  const loc = useLocation();

  const tabs = [
    { name: 'Accession Register', path: 'accession', icon: BookOpen },
    { name: 'Rack Arrangement', path: 'racks', icon: BookOpen },
    { name: 'Student Issue', path: 'student', icon: Users },
    { name: 'Staff Issue', path: 'staff', icon: UserSquare },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase text-primary">Library Management</h1>
        <p className="label-eyebrow text-muted-foreground mt-1">Manage books, accession registers, and track student & staff issues.</p>
      </header>

      {/* TABS */}
      <div className="flex space-x-2 bg-muted/50 p-1.5 rounded-[2rem] w-fit">
        {tabs.map((tab) => {
          const isActive = loc.pathname.includes(`/library/${tab.path}`);
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={`/dashboard/library/${tab.path}`}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-[1.5rem] label-eyebrow transition-all ${
                isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </NavLink>
          );
        })}
      </div>

      <div className="glass-morphism rounded-[2rem] p-6">
        <Routes>
          <Route path="/" element={<Navigate to="accession" replace />} />
          <Route path="accession" element={<AccessionRegister />} />
          <Route path="racks" element={<RackArrangement />} />
          <Route path="student" element={<StudentIssue />} />
          <Route path="staff" element={<StaffIssue />} />
        </Routes>
      </div>
    </div>
  );
}
