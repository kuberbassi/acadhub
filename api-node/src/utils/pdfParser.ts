import pdf from 'pdf-parse';
import { GradeCalculator } from '../lib/calculations.js';

export interface ParsedSubject {
  semester: number;
  paper_code: string;
  subject_name: string;
  internal_theory: number | null;
  external_theory: number | null;
  internal_practical: number | null;
  external_practical: number | null;
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  grade_point: number;
  credits: number;
  exam_date: string;
  declared_date: string;
}

export interface ParsedStudentInfo {
  enrollment_number: string;
  student_name: string;
  institute: string;
  program: string;
  batch: string;
}

export interface ParseResult {
  studentInfo: ParsedStudentInfo;
  subjects: ParsedSubject[];
}

function parseMarks(str: string): { internal: number | null; external: number | null; total: number } {
  const trimmed = str.trim().replace(/\s+/g, ' ');
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    const parseVal = (val: string) => {
      const cleaned = val.replace(/[A-Za-z]/g, '0');
      if (cleaned === '-') return null;
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    };

    if (parts.length === 3) {
      const p1 = parseVal(parts[0]);
      const p2 = parseVal(parts[1]);
      const p3 = parseVal(parts[2]) ?? 0;
      return { internal: p1, external: p2, total: p3 };
    }
    if (parts.length === 2) {
      const p1 = parseVal(parts[0]);
      const p2 = parseVal(parts[1]) ?? 0;
      return { internal: p1, external: null, total: p2 };
    }
    if (parts.length === 1) {
      return { internal: 0, external: 0, total: parseVal(parts[0]) ?? 0 };
    }
  }

  const cleanStr = str.replace(/[A-Za-z]/g, '0');

  if (cleanStr.startsWith('-')) {
    const rest = cleanStr.slice(1);
    const half = Math.floor(rest.length / 2);
    const externalStr = rest.slice(0, half);
    const totalStr = rest.slice(half);
    const external = Number(externalStr);
    const total = Number(totalStr);
    if (!isNaN(external) && !isNaN(total) && external === total) {
      return { internal: null, external, total };
    }
    return { internal: null, external: Number(rest) || 0, total: Number(rest) || 0 };
  }

  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const p1 = Number(parts[0]);
      const p2 = Number(parts[1]);
      const p3 = Number(parts[2]);
      if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        return { internal: p1, external: p2, total: p3 };
      }
    }
    if (parts.length === 2) {
      const p1 = Number(parts[0]);
      const p2 = Number(parts[1]);
      if (!isNaN(p1) && !isNaN(p2)) {
        return { internal: p1, external: null, total: p2 };
      }
    }
  }

  const len = cleanStr.length;
  for (let i = 1; i <= len - 2; i++) {
    for (let j = i + 1; j <= len - 1; j++) {
      const part1 = cleanStr.substring(0, i);
      const part2 = cleanStr.substring(i, j);
      const part3 = cleanStr.substring(j);
      
      const val1 = Number(part1);
      const val2 = Number(part2);
      const val3 = Number(part3);
      
      if (!isNaN(val1) && !isNaN(val2) && !isNaN(val3)) {
        if (val1 + val2 === val3 && val1 <= 100 && val2 <= 100 && val3 <= 100) {
          return { internal: val1, external: val2, total: val3 };
        }
      }
    }
  }

  if (len >= 6) {
    const val1 = Number(cleanStr.substring(0, 2));
    const val2 = Number(cleanStr.substring(2, 4));
    const val3 = Number(cleanStr.substring(4));
    return { internal: val1, external: val2, total: val3 };
  }

  return { internal: 0, external: 0, total: Number(cleanStr) || 0 };
}

function getDefaultCredits(subjectName: string): number {
  const upper = subjectName.toUpperCase();
  
  // NUES / special electives (Human Values, Ethics, etc.) → 2 credits
  if (
    upper.includes('NUES') ||
    upper.includes('N.U.E.S.') ||
    upper.includes('SEMINAR') ||
    upper.includes('PROJECT') ||
    upper.includes('TRAINING') ||
    upper.includes('INTERNSHIP') ||
    upper.includes('HUMAN VALUE') ||
    upper.includes('VALUE') ||
    upper.includes('ETHICS') ||
    upper.includes('ENVIRONMENTAL') ||
    upper.includes('SOFT SKILL') ||
    upper.includes('PERSONALITY') ||
    upper.includes('TERM PAPER')
  ) {
    return 2;
  }

  // Lab / practical subjects → 1 credit (IPU standard)
  if (
    upper.includes('LAB') ||
    upper.includes('PRACTICAL') ||
    upper.includes('WORKSHOP') ||
    upper.includes('VIVA')
  ) {
    return 1;
  }

  // Standard theory / engineering graphics → 3 credits (IPU standard)
  return 3;
}

export async function parseResultPdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdf(buffer);
  const text = data.text;
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
  
  let enrollment_number = '';
  let student_name = '';
  let institute = '';
  let program = '';
  let batch = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'ENROLLMENT NO.' && i + 1 < lines.length) {
      enrollment_number = lines[i + 1];
    } else if (line === 'STUDENT NAME' && i + 1 < lines.length) {
      student_name = lines[i + 1];
    } else if (line === 'INSTITUTE' && i + 1 < lines.length) {
      const instLines = [];
      let j = i + 1;
      while (j < lines.length && lines[j] !== 'PROGRAM') {
        instLines.push(lines[j]);
        j++;
      }
      institute = instLines.join(' ');
    } else if (line === 'PROGRAM' && i + 1 < lines.length) {
      const progLines = [];
      let j = i + 1;
      while (j < lines.length && lines[j] !== 'BATCH') {
        progLines.push(lines[j]);
        j++;
      }
      program = progLines.join(' ');
    } else if (line === 'BATCH' && i + 1 < lines.length) {
      batch = lines[i + 1];
    }
  }

  const subjects: ParsedSubject[] = [];

  const subjectStartRegex = /^([1-8])\s+([A-Za-z0-9\-]+)\s*(.*)$/;
  const marksDatesRegex = /((?:[0-9\-]+|A|AB|ABS|absent)(?:\s+(?:[0-9\-]+|A|AB|ABS|absent)){0,2})\s+(\d{1,2},\d{4})\s+(\d{4}-\d{2}-\d{2})\s*$/i;

  let currentSubject: {
    semester: number;
    paper_code: string;
    nameParts: string[];
  } | null = null;

  let i = 0;
  while (i < lines.length && 
         !lines[i].includes('INTERNAL MARKS') && 
         !lines[i].includes('SEMESTER/ANNUAL') && 
         !lines[i].includes('PAPER CODE') && 
         !lines[i].includes('SEM/')) {
    i++;
  }
  if (i >= lines.length) {
    i = 0;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const startMatch = line.match(subjectStartRegex);
    
    if (startMatch) {
      const semester = parseInt(startMatch[1], 10);
      const paper_code = startMatch[2];
      const remainder = startMatch[3] ? startMatch[3].trim() : '';
      
      currentSubject = {
        semester,
        paper_code,
        nameParts: remainder ? [remainder] : []
      };
      
      if (remainder) {
        const marksMatch = remainder.match(marksDatesRegex);
        if (marksMatch) {
          const matchIndex = marksMatch.index ?? 0;
          const prefix = remainder.substring(0, matchIndex).trim();
          currentSubject.nameParts = prefix ? [prefix] : [];
          
          const rawMarks = marksMatch[1];
          const exam_date = marksMatch[2];
          const declared_date = marksMatch[3];
          
          const { internal, external, total } = parseMarks(rawMarks);
          const subject_name = currentSubject.nameParts.join(' ').replace(/\s+/g, ' ').trim();
          
          const isLab = getDefaultCredits(subject_name) === 1;
          const subData = {
            internal_theory: isLab ? 0 : (internal ?? 0),
            external_theory: isLab ? 0 : (external ?? 0),
            internal_practical: isLab ? (internal ?? 0) : 0,
            external_practical: isLab ? (external ?? 0) : 0,
          };
          
          const calc = GradeCalculator.calculateSubjectResult({
            ...subData,
          });
          
          subjects.push({
            semester: currentSubject.semester,
            paper_code: currentSubject.paper_code,
            subject_name,
            ...subData,
            total_marks: calc.total_marks,
            max_marks: calc.max_marks,
            percentage: calc.percentage,
            grade: calc.grade,
            grade_point: calc.grade_point,
            credits: getDefaultCredits(subject_name),
            exam_date,
            declared_date,
          });
          
          currentSubject = null;
        }
      }
    } else if (currentSubject) {
      const marksMatch = line.match(marksDatesRegex);
      if (marksMatch) {
        const matchIndex = marksMatch.index ?? 0;
        const prefix = line.substring(0, matchIndex).trim();
        if (prefix) {
          currentSubject.nameParts.push(prefix);
        }
        
        const rawMarks = marksMatch[1];
        const exam_date = marksMatch[2];
        const declared_date = marksMatch[3];
        
        const { internal, external, total } = parseMarks(rawMarks);
        const subject_name = currentSubject.nameParts.join(' ').replace(/\s+/g, ' ').trim();
        
        const isLab = getDefaultCredits(subject_name) === 1;
        const subData = {
          internal_theory: isLab ? 0 : (internal ?? 0),
          external_theory: isLab ? 0 : (external ?? 0),
          internal_practical: isLab ? (internal ?? 0) : 0,
          external_practical: isLab ? (external ?? 0) : 0,
        };
        
        const calc = GradeCalculator.calculateSubjectResult({
          ...subData,
        });
        
        subjects.push({
          semester: currentSubject.semester,
          paper_code: currentSubject.paper_code,
          subject_name,
          ...subData,
          total_marks: calc.total_marks,
          max_marks: calc.max_marks,
          percentage: calc.percentage,
          grade: calc.grade,
          grade_point: calc.grade_point,
          credits: getDefaultCredits(subject_name),
          exam_date,
          declared_date,
        });
        
        currentSubject = null;
      } else {
        currentSubject.nameParts.push(line);
      }
    }
  }

  return {
    studentInfo: {
      enrollment_number,
      student_name,
      institute,
      program,
      batch
    },
    subjects
  };
}
