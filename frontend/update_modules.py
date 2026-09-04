import os
import re

files = [
    'src/pages/EmployeeAdd.jsx',
    'src/pages/EmployeesModule.jsx',
    'src/pages/employees/EmployeeDirectoryPage.jsx'
]

replacement = '''{ 
    key: 'students', label: 'Students', 
    submodules: [
      {key: 'students.directory', label: 'Directory'}, 
      {key: 'students.admission-full', label: 'Admission'}, 
      {key: 'students.removal', label: 'Removal'}, 
      {key: 'students.edit', label: 'Edit Student'}, 
      {key: 'students.certificates', label: 'Certificates'},
      {key: 'bulk-import', label: 'Import Data'},
      {key: 'students.houses', label: 'House Assignment'},
      {key: 'students.rejoin', label: 'Rejoin'}
    ] 
  },
  { 
    key: 'academic', label: 'Academic', 
    submodules: [
      {key: 'academic.classes', label: 'Classes & Sections'}, 
      {key: 'academic.subject-topics', label: 'Subject Topics'},
      {key: 'academic.timetable', label: 'Timetable'},
      {key: 'academic.marks-entry', label: 'Marks Entry'},
      {key: 'academic.results-sheet', label: 'Results Sheet'},
      {key: 'academic.exam-setup', label: 'Exam Scheduling'}, 
      {key: 'academic.result-scheduling', label: 'Result Scheduling'}, 
      {key: 'academic.lesson-planning', label: 'Lesson Planning'},
      {key: 'academic.year-end-promotion', label: 'Year-End Promotion'}
    ] 
  },'''

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    pattern = re.compile(r"\{\s*key:\s*'students'.*?\]\s*\},.*?\{\s*key:\s*'academic'.*?\]\s*\},", re.DOTALL)
    new_content = pattern.sub(replacement, content)
    
    with open(f, 'w') as file:
        file.write(new_content)
    print(f"Updated {f}")
