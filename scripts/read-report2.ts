import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

const buffer = fs.readFileSync('tmp/comprehensive-report.docx');
mammoth.extractRawText({ buffer }).then(r => console.log(r.value.slice(0, 10000))).catch(console.error);