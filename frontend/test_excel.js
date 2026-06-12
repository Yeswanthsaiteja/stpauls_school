const XLSX = require('xlsx');
const workbook = XLSX.readFile('/Users/yeswanthsaitejasurada/Documents/stpauls_school/Library Data (Autosaved) (Autosaved) (Autosaved).xlsx');
const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('sheet')) || workbook.SheetNames[workbook.SheetNames.length - 1];
const worksheet = workbook.Sheets[targetSheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(jsonData.slice(0, 5));
