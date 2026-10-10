import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

const buffer = fs.readFileSync('tmp/ecosystem-report.docx');
mammoth.extractRawText({ buffer }).then(r => {
  // Check for all required sections
  const required = [
    'YC Leadership',
    'Recent YC AI Startups',
    'Global vs India',
    'Personal Direction',
    'Capital Flow',
    'What investors say',
    'YC Batch Analysis'
  ];
  required.forEach(s => {
    const found = r.value.includes(s);
    console.log(`${found ? '✅' : '❌'} ${s}`);
  });
  console.log('\n--- Full report length:', r.value.length, 'chars');
}).catch(console.error);