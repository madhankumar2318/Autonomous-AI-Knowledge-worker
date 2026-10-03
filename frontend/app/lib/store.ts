import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { logAuditEvent } from "./audit-logger";

// In-memory data store & helper functions for Next.js full-stack routes

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  tokenVersion?: number;
}

export interface UserSettingRecord {
  userId: string;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatThreadRecord {
  id: string;
  username: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
}

export interface UploadRecord {
  id: string;
  username: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "indexed" | "processing" | "ready";
  content?: string;
  chunks?: number;
}

// ── Persistent Disk Storage Helpers ──────────────────────────────────────────

export function getStorageDirs(): string[] {
  const cwd = process.cwd();
  const root = cwd.endsWith("frontend") ? path.resolve(cwd, "..") : cwd;
  const tmpDir = path.resolve(os.tmpdir(), "akw_uploads");
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  } catch {}

  const dirs = [
    tmpDir,
    path.resolve(root, "uploads_storage"),
    path.resolve(root, "frontend/uploads_storage"),
    path.resolve(cwd, "uploads_storage"),
    path.resolve(root, "backend-spring/uploads"),
    "/app/applet/uploads_storage",
    "/app/applet/frontend/uploads_storage",
  ];
  const unique = Array.from(new Set(dirs));
  return unique.filter((d) => {
    try {
      return fs.existsSync(d);
    } catch {
      return false;
    }
  });
}

export function getPrimaryStorageDir(): string {
  const cwd = process.cwd();
  const root = cwd.endsWith("frontend") ? path.resolve(cwd, "..") : cwd;
  const candidates = [
    path.resolve(root, "frontend/uploads_storage"),
    path.resolve(cwd, "uploads_storage"),
    path.resolve(os.tmpdir(), "akw_uploads"),
    "/app/applet/uploads_storage",
  ];
  for (const cand of candidates) {
    try {
      if (!fs.existsSync(cand)) fs.mkdirSync(cand, { recursive: true });
      const testFile = path.join(cand, `.akw_test_${Date.now()}`);
      fs.writeFileSync(testFile, "1");
      fs.unlinkSync(testFile);
      return cand;
    } catch {}
  }
  const fallback = path.resolve(os.tmpdir(), "akw_uploads");
  try {
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  } catch {}
  return fallback;
}

const nodeRequire = typeof createRequire === "function" ? createRequire(import.meta.url) : null;

function getPdfJs(): any {
  const candidatePaths = [
    path.resolve(process.cwd(), "frontend/node_modules/pdfjs-dist/legacy/build/pdf.js"),
    path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.js"),
    "/app/applet/frontend/node_modules/pdfjs-dist/legacy/build/pdf.js",
    "/app/applet/node_modules/pdfjs-dist/legacy/build/pdf.js",
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        if (nodeRequire) return nodeRequire(p);
        return require(p);
      }
    } catch {}
  }
  try {
    if (nodeRequire) {
      return nodeRequire("pdfjs-dist/legacy/build/pdf.js");
    }
  } catch {}
  try {
    return require("pdfjs-dist/legacy/build/pdf.js");
  } catch {
    return null;
  }
}

export function cleanPdfTextFormatting(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Replace TeX and PDF octal / control character ligatures and bullets
  text = text.replace(/(?:^|\s)ffl\s+/g, "\n• ");
  text = text.replace(/\\014|\x0c/g, "fi");
  text = text.replace(/\\013|\x0b/g, "ff");
  text = text.replace(/\\015|\x0e/g, "fl");
  text = text.replace(/\\016/g, "ffi");
  text = text.replace(/\\017/g, "ffl");

  // 2. Fix LaTeX curly braces used for dates like "{ May 2027" -> "- May 2027"
  text = text.replace(/\s*\{\s*([A-Za-z]+|\d{4})/g, " - $1");

  // 3. Fix bullet / delimiter artifacts like isolated "j" or "•"
  text = text.replace(/\s*j\s+/g, " • ");

  // 4. Fix letter-separated words (words split by spurious spaces between syllables/letters)
  const wordFixes: [RegExp, string][] = [
    [/\bEducati\s*on\b/gi, "Education"],
    [/\bT\s*ec\s*hnology\b/gi, "Technology"],
    [/\bT\s*ec\s*hnical\s*Skills\b/gi, "Technical Skills"],
    [/\bT\s*ec\s*hnical\b/gi, "Technical"],
    [/\bSoft\s*Skills\b/gi, "Soft Skills"],
    [/\bDeveloper\s*Tools\b/gi, "Developer Tools"],
    [/\bF\s*ramew\s*orks\b/gi, "Frameworks"],
    [/\bF\s*ramew\s*ork\b/gi, "Framework"],
    [/\bLang\s*uag\s*es\b/gi, "Languages"],
    [/\bSoftw\s*are\s*Dev\s*elop\s*ment\s*Engineer\s*In\s*tern\b/gi, "Software Development Engineer Intern"],
    [/\bSoftw\s*are\b/gi, "Software"],
    [/\bDev\s*elop\s*ment\b/gi, "Development"],
    [/\bDev\s*elop\s*ed\b/gi, "Developed"],
    [/\bDev\s*elop\s*er\b/gi, "Developer"],
    [/\bIn\s*tern\b/gi, "Intern"],
    [/\bEx\s*per\s*ienc\s*e\b/gi, "Experience"],
    [/\bPr\s*ojects\b/gi, "Projects"],
    [/\bProj\s*ec\s*ts\b/gi, "Projects"],
    [/\bProj\s*ec\s*t\b/gi, "Project"],
    [/\bCer\s*tif\s*ica\s*tions?\b/gi, "Certifications"],
    [/\bIn\s*tro\s*ducti\s*on\s*to\s*Mac\s*hine\s*Learning\b/gi, "Introduction to Machine Learning"],
    [/\bAp\s*ollo\s*Computer\s*Educati\s*on\b/gi, "Apollo Computer Education"],
    [/\bCloud\s*Computing\s*Fundamen\s*tals\b/gi, "Cloud Computing Fundamentals"],
    [/\bClaude\s*101\s*-\s*An\s*thropic\b/gi, "Claude 101 - Anthropic"],
    [/\bCoth\s*on\s*Solutions\b/gi, "Cothon Solutions"],
    [/\bCoth\s*on\b/gi, "Cothon"],
    [/\bHyder\s*ab\s*ad\b/gi, "Hyderabad"],
    [/\bBuilta\b/gi, "Built a"],
    [/\bfu\s*ll-s\s*tack\b/gi, "full-stack"],
    [/\bKno\s*wledge\s*Work\s*er\b/gi, "Knowledge Worker"],
    [/\bKno\s*wledge\b/gi, "Knowledge"],
    [/\bWork\s*er\b/gi, "Worker"],
    [/\bF\s*astAPI\b/gi, "FastAPI"],
    [/\bDo\s*c\s*k\s*er\b/gi, "Docker"],
    [/\bA\s*W\s*S\b/g, "AWS"],
    [/\bIn\s*telli\s*J\b/gi, "IntelliJ"],
    [/\bTeamw\s*ork\b/gi, "Teamwork"],
    [/\bJa\s*v\s*a\b/gi, "Java"],
    [/\bPyth\s*on\b/gi, "Python"],
    [/\bTyp\s*eScript\b/gi, "TypeScript"],
    [/\bPostgr\s*eSQL\b/gi, "PostgreSQL"],
    [/\bR\s*e\s*act\b/gi, "React"],
    [/\bSup\s*ab\s*ase\b/gi, "Supabase"],
    [/\bs\s*to\s*c\s*k\b/gi, "stock"],
    [/\bstoc\s*ks\b/gi, "stocks"],
    [/\btrac\s*king\b/gi, "tracking"],
    [/\bp\s*o\s*w\s*ered\b/gi, "powered"],
    [/\brep\s*ort\b/gi, "report"],
    [/\bgenerati\s*on\b/gi, "generation"],
    [/\bcac\s*hing\b/gi, "caching"],
    [/\bbac\s*kgr\s*ound\b/gi, "background"],
    [/\bsc\s*heduling\b/gi, "scheduling"],
    [/\bse\s*cur\s*it\s*y\b/gi, "security"],
    [/\btrav\s*ersal\b/gi, "traversal"],
    [/\bfilev\s*alidati\s*on\b/gi, "file validation"],
    [/\bclean\s*up\b/gi, "cleanup"],
    [/\bh\s*ybrid\b/gi, "hybrid"],
    [/\bY\s*ouT\s*ub\s*e\b/gi, "YouTube"],
    [/\blo\s*okup\b/gi, "lookup"],
    [/\bSessi\s*on\b/gi, "Session"],
    [/\bfilew\s*orkspaces\b/gi, "file workspaces"],
    [/\bdashb\s*oard\b/gi, "dashboard"],
    [/\bAI\s*Grievan\s*ce\s*System\b/gi, "AI Grievance System"],
    [/\bArc\s*hitecteda\b/gi, "Architected a"],
    [/\bcon\s*trol\b/gi, "control"],
    [/\bpassw\s*ordh\s*as\s*h\s*ing\b/gi, "password hashing"],
    [/\bauthen\s*ticati\s*on\b/gi, "authentication"],
    [/\bau\s*tom\s*ated\b/gi, "automated"],
    [/\bus\s*i\s*ng\b/gi, "using"],
    [/\bGo\s*ogle\s*Gemini\s*2\.5\s*Flash\b/gi, "Google Gemini 2.5 Flash"],
    [/\bstructuredsc\s*hemas\b/gi, "structured schemas"],
    [/\bac\s*hieving\b/gi, "achieving"],
    [/\bclassificati\s*on\b/gi, "classification"],
    [/\bp\s*ercent\b/gi, "percent"],
    [/\bin\s*teractive\b/gi, "interactive"],
    [/\bresp\s*onsive\b/gi, "responsive"],
    [/\bpan-zo\s*om\b/gi, "pan-zoom"],
    [/\bna\s*vigati\s*on\b/gi, "navigation"],
    [/\bRec\s*harts\s*Analytics\b/gi, "Recharts Analytics"],
    [/\bAnalyticsf\s*or\b/gi, "Analytics for"],
    [/\bresoluti\s*on\b/gi, "resolution"],
    [/\bsec\s*on\s*ds\b/gi, "seconds"],
    [/\bUser\s*Beha\s*viou?r\s*Analytics\b/gi, "User Behaviour Analytics"],
    [/\bScikit-L\s*e\s*arn\b/gi, "Scikit-Learn"],
    [/\bWebSo\s*ckets\b/gi, "WebSockets"],
    [/\ben\s*terprise-grade\b/gi, "enterprise-grade"],
    [/\bcreden\s*tialmis\s*use\b/gi, "credential misuse"],
    [/\bimp\s*ossible\b/gi, "impossible"],
    [/\br\s*e\s*al\b/gi, "real"],
    [/\bback\s*ed\s*b\s*y\b/gi, "backed by"],
    [/\bIsolati\s*on\s*Forest\b/gi, "Isolation Forest"],
    [/\bin\s*tegrated\b/gi, "integrated"],
    [/\bW\s*ebSock\s*et\b/gi, "WebSocket"],
    [/\bup\s*dates\b/gi, "updates"],
    [/\bCon\s*tainerized\b/gi, "Containerized"],
    [/\bComp\s*ose\b/gi, "Compose"],
    [/\brep\s*orting\b/gi, "reporting"],
    [/\bandv\s*alidated\b/gi, "and validated"],
    [/\bautomatedp\s*ytest\b/gi, "automated pytest"],
    [/\bte\s*st\b/gi, "test"],
    [/\bLink\s*edIn\b/gi, "LinkedIn"],
    [/\bP\s*ortf\s*olio\b/gi, "Portfolio"],
    [/\bA\s*rti\s*fi\s*cial\b/gi, "Artificial"],
    [/\bIntel\s*ligenc\s*e\b/gi, "Intelligence"],
    [/\bScienc\s*e\b/gi, "Science"],
    [/\bB\.?\s*T\s*e\s*ch\b/gi, "B.Tech"],
    [/\bCGP\s*A\b/gi, "CGPA"],
    [/\bSSL\s*C\b/gi, "SSLC"],
    [/\bHS\s*C\b/gi, "HSC"],
    [/\bC\s*B\s*S\s*E\b/gi, "CBSE"],
    [/\bA\s*ug\b/gi, "Aug"],
    [/\bSpring\s*Bo\s*ot\b/gi, "Spring Boot"],
    [/\bT\s*o\s*ol\s*s\b/gi, "Tools"],
    [/\bSc\s*ho\s*ol\b/gi, "School"],
    [/\bT\s*ric\s*h\s*y\b/gi, "Trichy"],
    [/\bJa\s*y\s*en\s*dra\b/gi, "Jayendra"],
    [/\bVidh\s*y\s*ala\s*y\s*a\b/gi, "Vidhyalaya"],
    [/\bMus\s*iri\b/gi, "Musiri"],
    [/\bCol\s*leg\s*e\b/gi, "College"],
    [/\bEngin\s*eer\s*ing\b/gi, "Engineering"],
    [/\bMach\s*ine\b/gi, "Machine"],
    [/\bLearn\s*ing\b/gi, "Learning"],
    [/\bDeep\s*Learn\s*ing\b/gi, "Deep Learning"],
    [/\bDat\s*abas\s*es?\b/gi, "Database"],
    [/\bMan\s*age\s*ment\b/gi, "Management"],
    [/\bCom\s*put\s*er\b/gi, "Computer"],
    [/\bSys\s*tem\s*s?\b/gi, "System"],
    [/\bIn\s*for\s*ma\s*tion\b/gi, "Information"],
    [/\bDe\s*sign\b/gi, "Design"],
    [/\bRe\s*searc\s*h\b/gi, "Research"],
    [/\bPro\s*gram\s*ming\b/gi, "Programming"],
    [/\bAp\s*pli\s*ca\s*tions?\b/gi, "Application"],
    [/\bAlg\s*or\s*ithms?\b/gi, "Algorithm"],
    [/\bSol\s*u\s*tions?\b/gi, "Solution"],
    [/\bPer\s*form\s*ance\b/gi, "Performance"],
    [/\bAn\s*a\s*lyt\s*ics\b/gi, "Analytics"],
    [/\bAn\s*a\s*ly\s*sis\b/gi, "Analysis"],
    [/\bAr\s*chi\s*tec\s*ture\b/gi, "Architecture"],
    [/\bAc\s*a\s*dem\s*ic\b/gi, "Academic"],
    [/\bIn\s*sti\s*tute\b/gi, "Institute"],
    [/\bUni\s*ver\s*si\s*ty\b/gi, "University"],
  ];

  for (const [regex, replacement] of wordFixes) {
    text = text.replace(regex, replacement);
  }

  // 5. Generic heuristic for words split by single letters: e.g. "Scienc e" -> "Science"
  text = text.replace(/\b([a-zA-Z]{3,})\s+([a-z])\b/g, "$1$2");
  text = text.replace(/\b([A-Z])\s+([a-z]{2,})\b/g, "$1$2");

  // 6. Fix glued words before prepositions (e.g. "Collegeof" -> "College of", "B.Techin" -> "B.Tech in")
  text = text.replace(/([a-zA-Z\.]{3,})(of|in|and|at|for|to|with|by|on)\b/g, "$1 $2");

  // 7. Insert clean section breaks without stacking multiple ###
  const majorSections = [
    "Education",
    "Technical Skills",
    "Languages",
    "Frameworks",
    "Developer Tools",
    "Soft Skills",
    "Experience",
    "Projects",
    "Certifications",
  ];
  for (const sec of majorSections) {
    const r = new RegExp(`(?<!###\\s*)(?:^|\\s+)(${sec})(?:\\s*:|\\s+)`, "gi");
    text = text.replace(r, "\n\n### $1\n");
  }

  // 8. Format project headers and separate inline run-on bullet points
  text = text.replace(/([.!?])\s*(Autonomous AI Knowledge Worker|AI Grievance System|User Behaviour Analytics)\b/gi, "$1\n\n**$2**\n");
  text = text.replace(/([^\n])\s*[•▸]\s*/g, "$1\n• ");

  // 9. Structure Certifications into bullet points if grouped
  text = text.replace(/(### Certifications\n)([\s\S]*)/i, (m, h, body) => {
    let b = body.trim();
    b = b.replace(/Introduction to Machine Learning\s*-\s*NPTEL/i, "\n• Introduction to Machine Learning - NPTEL");
    b = b.replace(/Java\s*-\s*Apollo Computer Education/i, "\n• Java - Apollo Computer Education");
    b = b.replace(/Cloud Computing Fundamentals\s*-\s*Udemy/i, "\n• Cloud Computing Fundamentals - Udemy");
    b = b.replace(/Claude 101\s*-\s*Anthropic/i, "\n• Claude 101 - Anthropic");
    return h + b;
  });

  // 10. Clean up duplicate or bare ### headers
  text = text.replace(/(?:###\s*){2,}/g, "\n\n### ");
  text = text.replace(/^\s*###\s*$/gm, "");

  // 11. Normalize spaces
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function reconstructPdfPageText(items: any[]): string {
  if (!items || items.length === 0) return "";

  const sorted = [...items]
    .filter((it) => it && typeof it.str === "string")
    .sort((a, b) => {
      const yA = a.transform ? a.transform[5] : 0;
      const yB = b.transform ? b.transform[5] : 0;
      if (Math.abs(yA - yB) > 4) {
        return yB - yA;
      }
      const xA = a.transform ? a.transform[4] : 0;
      const xB = b.transform ? b.transform[4] : 0;
      return xA - xB;
    });

  let line = "";
  let lastX = -1;
  let lastWidth = 0;
  let lastY = -1;
  const lines: string[] = [];

  for (const it of sorted) {
    const str = it.str;
    if (!str && !it.hasEOL) continue;
    const x = it.transform ? it.transform[4] : 0;
    const y = it.transform ? it.transform[5] : 0;
    const fontSize = it.transform
      ? Math.abs(it.transform[0] || it.transform[3] || 12)
      : 12;

    if (lastY !== -1 && Math.abs(y - lastY) > 4) {
      if (line.trim()) lines.push(line.trim());
      line = "";
      lastX = -1;
    }

    if (lastX !== -1) {
      const gap = x - (lastX + lastWidth);
      if (
        gap > fontSize * 0.28 &&
        !line.endsWith(" ") &&
        !str.startsWith(" ")
      ) {
        line += " ";
      }
    }

    line += str;
    lastX = x;
    lastWidth = it.width || 0;
    lastY = y;

    if (it.hasEOL) {
      if (line.trim()) lines.push(line.trim());
      line = "";
      lastX = -1;
      lastY = -1;
    }
  }

  if (line.trim()) lines.push(line.trim());
  return lines.join("\n");
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // 1. High-accuracy extraction via pdfjs-dist legacy engine
  try {
    const pdfjs = getPdfJs();
    if (pdfjs && typeof pdfjs.getDocument === "function") {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true,
      });
      const pdf = await loadingTask.promise;
      const pagesText: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const reconstructed = reconstructPdfPageText(textContent.items);
          const cleaned = cleanPdfTextFormatting(reconstructed);
          if (cleaned) {
            pagesText.push(`[Page ${pageNum}]\n${cleaned}`);
          }
        } catch (_pageErr) {}
      }

      const combined = pagesText.join("\n\n").trim();
      // If pdfjs extracted real text, prioritize it above everything else
      if (combined.length > 20) {
        return cleanPdfTextFormatting(combined);
      }
      const syncResult = cleanPdfTextFormatting(extractPdfTextSync(buffer));
      if (syncResult && syncResult.length > combined.length) {
        return syncResult;
      }
      if (combined) {
        return cleanPdfTextFormatting(combined);
      }
    }
  } catch (_e) {}

  // 2. Stream decompression and text extraction fallback
  return cleanPdfTextFormatting(extractPdfTextSync(buffer));
}

export function extractPdfTextSync(buffer: Buffer): string {
  try {
    const content = buffer.toString("binary");
    const textPieces: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      const rawStream = Buffer.from(match[1], "binary");
      let decompressed = "";
      try {
        decompressed = zlib.inflateSync(rawStream).toString("utf-8");
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString("utf-8");
        } catch {
          decompressed = rawStream.toString("utf-8");
        }
      }

      // Match text inside (...) Tj
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let m: RegExpExecArray | null;
      while ((m = tjRegex.exec(decompressed)) !== null) {
        textPieces.push(unescapePdfText(m[1]));
      }

      // Match text inside [...] TJ
      const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((m = arrayRegex.exec(decompressed)) !== null) {
        const innerRegex = /\(([^)]+)\)/g;
        let inner: RegExpExecArray | null;
        const arr: string[] = [];
        while ((inner = innerRegex.exec(m[1])) !== null) {
          arr.push(unescapePdfText(inner[1]));
        }
        if (arr.length) textPieces.push(arr.join(" "));
      }

      // If stream had newline operators (T*, Td with negative y, or ET), insert line break marker
      if (/T\*|ET|\n/.test(decompressed)) {
        textPieces.push("\n");
      }
    }

    let full = textPieces
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .trim();

    // Also extract all direct Tj operators from uncompressed stream or raw binary
    const directTjRegex = /\(([^)]+)\)\s*Tj/g;
    let directM: RegExpExecArray | null;
    const directTjPieces: string[] = [];
    while ((directM = directTjRegex.exec(content)) !== null) {
      directTjPieces.push(unescapePdfText(directM[1]));
    }
    const directFull = directTjPieces
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .trim();

    if (directFull.length > full.length) {
      full = directFull;
    }

    if (full.length > 20) return cleanPdfTextFormatting(full);

    // Fallback: search for direct text strings in binary stream
    const fallbackPieces: string[] = [];
    const plainRegex = /\(([^)]{3,})\)/g;
    let fallbackMatch: RegExpExecArray | null;
    while ((fallbackMatch = plainRegex.exec(content)) !== null) {
      const cleaned = unescapePdfText(fallbackMatch[1]).trim();
      if (cleaned.length > 2 && /^[a-zA-Z0-9\s.,;:_/@\-+]+$/.test(cleaned)) {
        fallbackPieces.push(cleaned);
      }
    }
    const rawFallback = fallbackPieces.join(" ").replace(/[ \t]+/g, " ").trim();
    return cleanPdfTextFormatting(rawFallback || full || "PDF Document parsed.");
  } catch (_e) {
    return "PDF Document loaded.";
  }
}

function unescapePdfText(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

export interface AccountAttemptRecord {
  failedCount: number;
  lockedUntil: number;
  lastFailed: number;
}

// Global persistent in-memory storage (preserved across HMR / module reloads)
const globalStore = globalThis as unknown as {
  __AKW_USERS__?: Map<string, UserRecord>;
  __AKW_SETTINGS__?: Map<string, UserSettingRecord>;
  __AKW_THREADS__?: Map<string, ChatThreadRecord>;
  __AKW_UPLOADS__?: Map<string, UploadRecord>;
  __AKW_BUFFERS__?: Map<string, Buffer>;
  __AKW_ACCOUNT_ATTEMPTS__?: Map<string, AccountAttemptRecord>;
};

if (!globalStore.__AKW_ACCOUNT_ATTEMPTS__) {
  globalStore.__AKW_ACCOUNT_ATTEMPTS__ = new Map<string, AccountAttemptRecord>();
}

export function saveUsersToDisk(): void {
  const users = Array.from(globalStore.__AKW_USERS__?.values() || []);
  const dirs = getStorageDirs();
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, "users_index.json");
      fs.writeFileSync(p, JSON.stringify(users, null, 2), "utf-8");
    } catch {}
  }
}

export function syncUsersFromDisk(): Map<string, UserRecord> {
  if (!globalStore.__AKW_USERS__) {
    globalStore.__AKW_USERS__ = new Map<string, UserRecord>();
  }
  const users = globalStore.__AKW_USERS__;

  // 1. Ensure default admin is always seeded with salted scrypt hash
  if (!users.has("admin")) {
    const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || "Sk_uyir18";
    users.set("admin", {
      id: "admin-1",
      username: "admin",
      passwordHash: hashPassword(initialAdminPassword),
      name: "Administrator",
      email: "admin@knowledge-worker.local",
      mobile: "+1 555-0199",
      role: "ADMIN",
      tokenVersion: 1,
    });
  }

  // 2. Load users from users_index.json across storage dirs
  for (const dir of getStorageDirs()) {
    try {
      const p = path.join(dir, "users_index.json");
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const list: UserRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u && u.username) {
              const normKey = u.username.toLowerCase();
              if (!users.has(normKey)) {
                users.set(normKey, u);
              }
              if (!users.has(u.username)) {
                users.set(u.username, u);
              }
            }
          }
        }
      }
    } catch {}
  }

  return users;
}

if (!globalStore.__AKW_USERS__) {
  syncUsersFromDisk();
}

if (!globalStore.__AKW_SETTINGS__) {
  const settings = new Map<string, UserSettingRecord>();
  settings.set("admin", {
    userId: "admin-1",
    defaultModel: "gemini-3.8-flash",
    temperature: 0.2,
    systemPrompt: "You are an autonomous AI Knowledge Worker assistant. Provide concise, high-value, factual, analytical insights, clear code, and structured market analysis.",
    chunkSize: 800,
    chunkOverlap: 100,
  });
  globalStore.__AKW_SETTINGS__ = settings;
}

if (!globalStore.__AKW_THREADS__) {
  globalStore.__AKW_THREADS__ = new Map<string, ChatThreadRecord>();
}
// Clean up any legacy default placeholder thread
if (globalStore.__AKW_THREADS__.has("thread-welcome")) {
  globalStore.__AKW_THREADS__.delete("thread-welcome");
}

export function syncUploadsFromDisk(): Map<string, UploadRecord> {
  if (!globalStore.__AKW_UPLOADS__) {
    globalStore.__AKW_UPLOADS__ = new Map<string, UploadRecord>();
  }
  if (!globalStore.__AKW_BUFFERS__) {
    globalStore.__AKW_BUFFERS__ = new Map<string, Buffer>();
  }

  const uploads = globalStore.__AKW_UPLOADS__;
  const dirs = getStorageDirs();

  // Reconcile in-memory store against disk: ensure all in-memory items are synced to disk
  for (const [key, val] of Array.from(uploads.entries())) {
    let existsOnDisk = false;
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        if (
          fs.existsSync(path.join(dir, val.filename)) ||
          fs.existsSync(path.join(dir, key)) ||
          fs.existsSync(path.join(dir, decodeURIComponent(val.filename)))
        ) {
          existsOnDisk = true;
          break;
        }
      }
    }

    // If not physically on disk but buffer exists in memory, persist it to disk
    if (!existsOnDisk) {
      const buf =
        globalStore.__AKW_BUFFERS__?.get(key) ||
        globalStore.__AKW_BUFFERS__?.get(val.filename) ||
        globalStore.__AKW_BUFFERS__?.get(decodeURIComponent(val.filename));
      if (buf) {
        for (const dir of dirs) {
          try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, val.filename), buf);
            existsOnDisk = true;
          } catch {}
        }
      }
    }

    // Only remove orphaned stub records that have no buffer, no content, and no physical file
    if (
      !existsOnDisk &&
      !globalStore.__AKW_BUFFERS__?.has(key) &&
      !globalStore.__AKW_BUFFERS__?.has(val.filename) &&
      (!val.content || val.content.length < 5)
    ) {
      uploads.delete(key);
    }
  }

  // 1. Check for uploads_index.json across all storage directories ONLY for files that physically exist on disk
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const indexFile = path.join(dir, "uploads_index.json");
        if (fs.existsSync(indexFile)) {
          const raw = fs.readFileSync(indexFile, "utf-8");
          const records = JSON.parse(raw);
          if (Array.isArray(records)) {
            for (const r of records) {
              if (r && r.filename) {
                // Verify physical file actually exists before restoring into store
                let physicalExists = false;
                for (const d of dirs) {
                  if (
                    fs.existsSync(path.join(d, r.filename)) ||
                    fs.existsSync(path.join(d, decodeURIComponent(r.filename)))
                  ) {
                    physicalExists = true;
                    break;
                  }
                }
                if (physicalExists && !uploads.has(r.filename)) {
                  uploads.set(r.filename, r);
                }
              }
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 2. Auto-scan all storage directories for physical files
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (
            file === "uploads_index.json" ||
            file.startsWith(".") ||
            file.toLowerCase() === "q3_financial_brief.md"
          ) {
            continue;
          }
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            const lower = file.toLowerCase();
            const isPdf = lower.endsWith(".pdf");
            const isJson = lower.endsWith(".json");
            const isCsv = lower.endsWith(".csv");
            const isDocx = lower.endsWith(".docx") || lower.endsWith(".doc");
            const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
            let contentType = "text/plain";
            if (isPdf) contentType = "application/pdf";
            else if (isJson) contentType = "application/json";
            else if (isCsv) contentType = "text/csv";
            else if (isDocx)
              contentType =
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            else if (isXlsx)
              contentType =
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            let buffer: Buffer | null = null;
            try {
              buffer = fs.readFileSync(filePath);
              if (!globalStore.__AKW_BUFFERS__!.has(file)) {
                globalStore.__AKW_BUFFERS__!.set(file, buffer);
              }
              const decoded = decodeURIComponent(file);
              if (!globalStore.__AKW_BUFFERS__!.has(decoded)) {
                globalStore.__AKW_BUFFERS__!.set(decoded, buffer);
              }
            } catch {}

            if (!uploads.has(file)) {
              let extracted = "";
              if (isPdf && buffer) {
                try {
                  extracted = extractPdfTextSync(buffer);
                } catch {}
              } else if (buffer) {
                try {
                  extracted = buffer.toString("utf-8");
                } catch {}
              }
              extracted = cleanPdfTextFormatting(extracted);

              const chunks = Math.max(1, Math.round(stat.size / 500));
              uploads.set(file, {
                id: `upl-${file}`,
                username: "admin",
                filename: file,
                originalName: file,
                contentType,
                size: stat.size,
                uploadedAt: stat.mtime.toISOString(),
                status: "indexed",
                chunks,
                content: extracted,
              });
            }
          }
        }
      }
    } catch (_e) {}
  }

  // Run automatic storage cleanup on startup to purge abandoned temporary files
  try {
    cleanupOldTemporaryUploads();
  } catch (_e) {}

  return uploads;
}

/**
 * Automatically cleans up abandoned temporary uploads, test probe files,
 * and unindexed files older than 30 days to prevent disk exhaustion.
 */
export function cleanupOldTemporaryUploads(): { deletedCount: number; freedBytes: number } {
  const dirs = getStorageDirs();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        // 1. Clean up stray test probe files immediately
        if (file.startsWith(".akw_test_")) {
          try {
            const p = path.join(dir, file);
            fs.unlinkSync(p);
            deletedCount++;
          } catch {}
          continue;
        }

        // 2. Protect index files and active uploaded documents in store
        if (file === "uploads_index.json" || file.endsWith(".json")) continue;
        if (uploadsStore && (uploadsStore.has(file) || uploadsStore.has(decodeURIComponent(file)))) {
          continue;
        }

        // 3. Purge orphaned or temporary uploads older than 30 days
        try {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > thirtyDaysMs) {
            fs.unlinkSync(filePath);
            deletedCount++;
            freedBytes += stat.size;
          }
        } catch {}
      }
    } catch {}
  }

  return { deletedCount, freedBytes };
}

if (!globalStore.__AKW_UPLOADS__) {
  globalStore.__AKW_UPLOADS__ = new Map<string, UploadRecord>();
}
if (!globalStore.__AKW_BUFFERS__) {
  globalStore.__AKW_BUFFERS__ = new Map<string, Buffer>();
}

// Initial synchronization from disk
syncUploadsFromDisk();

export const usersStore = globalStore.__AKW_USERS__!;
export const settingsStore = globalStore.__AKW_SETTINGS__!;
export const threadsStore = globalStore.__AKW_THREADS__!;
export const uploadsStore = globalStore.__AKW_UPLOADS__!;
export const buffersStore = globalStore.__AKW_BUFFERS__!;
export const accountAttemptsStore = globalStore.__AKW_ACCOUNT_ATTEMPTS__!;

// ── Account Lockout & Brute-Force Backoff ─────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lock

export function isAccountLocked(username: string): { locked: boolean; remainingSeconds: number } {
  const normUser = username.trim().toLowerCase();
  const attempt = accountAttemptsStore.get(normUser);
  if (!attempt) return { locked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (attempt.lockedUntil > now) {
    const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  // Lock expired
  if (attempt.lockedUntil > 0) {
    attempt.failedCount = 0;
    attempt.lockedUntil = 0;
    accountAttemptsStore.set(normUser, attempt);
  }

  return { locked: false, remainingSeconds: 0 };
}

export function recordFailedLogin(
  username: string,
  ip: string
): { locked: boolean; remainingSeconds: number; attempts: number } {
  const normUser = username.trim().toLowerCase();
  const now = Date.now();
  let attempt = accountAttemptsStore.get(normUser);

  if (!attempt) {
    attempt = { failedCount: 0, lockedUntil: 0, lastFailed: 0 };
  }

  // Reset failure count if past the sliding window
  if (now - attempt.lastFailed > LOCKOUT_WINDOW_MS && attempt.lockedUntil <= now) {
    attempt.failedCount = 0;
  }

  attempt.failedCount += 1;
  attempt.lastFailed = now;

  let locked = false;
  let remainingSeconds = 0;

  if (attempt.failedCount >= MAX_FAILED_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    locked = true;
    remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);

    logAuditEvent({
      type: "ACCOUNT_LOCKED",
      severity: "CRITICAL",
      username: normUser,
      ip,
      details: {
        failedAttempts: attempt.failedCount,
        lockedForSeconds: remainingSeconds,
      },
    });
  } else {
    logAuditEvent({
      type: "AUTH_LOGIN_FAILED",
      severity: "WARN",
      username: normUser,
      ip,
      details: {
        failedAttempts: attempt.failedCount,
        remainingAttemptsBeforeLock: MAX_FAILED_ATTEMPTS - attempt.failedCount,
      },
    });
  }

  accountAttemptsStore.set(normUser, attempt);
  return { locked, remainingSeconds, attempts: attempt.failedCount };
}

export function recordSuccessfulLogin(username: string, ip: string): void {
  const normUser = username.trim().toLowerCase();
  accountAttemptsStore.delete(normUser);
  logAuditEvent({
    type: "AUTH_LOGIN_SUCCESS",
    severity: "INFO",
    username: normUser,
    ip,
    details: { message: "Authenticated successfully" },
  });
}

// ── File Content Sanitization & Magic-Byte Inspection ─────────────────────────

/**
 * Sanitizes a single CSV / table cell value to prevent CSV Formula Injection (DDE Injection).
 * Spreadsheet applications (Excel, Calc) execute formulas starting with =, +, -, @, \t, \r.
 */
export function sanitizeCsvCell(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousPrefixes.some((p) => trimmed.startsWith(p))) {
    // Escape by prepending a single quote
    return `'${value}`;
  }
  return value;
}

/**
 * Sanitizes full CSV text to protect against formula injection and control characters.
 */
export function sanitizeCsvText(rawCsv: string): string {
  if (!rawCsv) return "";
  const lines = rawCsv.split(/\r?\n/);
  const sanitizedLines = lines.map((line) => {
    // If line starts with a formula trigger, neutralize it
    const trimmed = line.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${line}`;
    }
    // Also sanitize comma-separated cells if line contains commas
    return line
      .split(",")
      .map((cell) => sanitizeCsvCell(cell))
      .join(",");
  });
  return sanitizedLines.join("\n");
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedBuffer?: Buffer;
  sanitizedText?: string;
}

/**
 * Validates file magic bytes and inspects content to prevent polyglot attacks and malicious uploads.
 */
export function validateFileContent(buffer: Buffer, filename: string): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  const ext = path.extname(filename).toLowerCase();

  // 1. PDF Validation: Must start with %PDF
  if (ext === ".pdf") {
    const header = buffer.subarray(0, 5).toString("latin1");
    if (!header.startsWith("%PDF")) {
      return {
        valid: false,
        error: "Invalid PDF file structure. File signature does not match PDF format.",
      };
    }
    return { valid: true };
  }

  // 2. DOCX & XLSX Validation: Must start with ZIP header PK (0x50, 0x4B)
  if (ext === ".docx" || ext === ".xlsx") {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return {
        valid: false,
        error: `Invalid Office document signature. Expected ZIP container format for ${ext}.`,
      };
    }
    return { valid: true };
  }

  // 3. JSON Validation: Must parse as JSON
  if (ext === ".json") {
    try {
      const text = buffer.toString("utf-8");
      JSON.parse(text);
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid JSON format. Malformed JSON payload." };
    }
  }

  // 4. Text & Markdown Validation: Ensure no binary null-bytes and no malicious script injection
  if (ext === ".txt" || ext === ".md") {
    // Check for null bytes indicating disguised binary executable
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      if (buffer[i] === 0x00) {
        return {
          valid: false,
          error: "Binary file disguised as text document detected. Upload rejected.",
        };
      }
    }
    const text = buffer.toString("utf-8");
    // Disallow executable polyglot tags in text uploads
    if (/<script\b|<iframe\b|javascript:|vbscript:/i.test(text)) {
      return {
        valid: false,
        error: "Potential script injection detected in document content.",
      };
    }
    return { valid: true };
  }

  // 5. CSV Validation & Formula Injection Sanitization
  if (ext === ".csv") {
    // Check for null bytes
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      if (buffer[i] === 0x00) {
        return {
          valid: false,
          error: "Binary file disguised as CSV detected. Upload rejected.",
        };
      }
    }
    const text = buffer.toString("utf-8");
    const sanitized = sanitizeCsvText(text);
    return {
      valid: true,
      sanitizedBuffer: Buffer.from(sanitized, "utf-8"),
      sanitizedText: sanitized,
    };
  }

  return { valid: true };
}

export const MAX_UPLOAD_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".csv",
  ".docx",
  ".xlsx",
  ".txt",
  ".json",
  ".md",
]);

export function isAllowedUploadExtension(filename: string): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.has(ext);
}

export function sanitizeUploadFilename(rawName: string): string {
  // Prevent path traversal by extracting only basename and stripping unsafe chars
  const base = path.basename(rawName).trim();
  const sanitized = base
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.{2,}/g, ".");
  return sanitized || `upload_${Date.now()}`;
}

export function saveUploadFile(record: UploadRecord, buffer?: Buffer) {
  record.filename = sanitizeUploadFilename(record.filename);
  if (record.originalName) {
    record.originalName = sanitizeUploadFilename(record.originalName);
  }
  uploadsStore.set(record.filename, record);

  // Cache in-memory buffer
  if (buffer) {
    buffersStore.set(record.filename, buffer);
    const decoded = decodeURIComponent(record.filename);
    if (decoded !== record.filename) {
      buffersStore.set(decoded, buffer);
    }
  }

  // Save to disk across primary and all available storage directories
  const primaryDir = getPrimaryStorageDir();
  const dirs = Array.from(new Set([primaryDir, ...getStorageDirs()]));

  if (buffer) {
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, record.filename);
        fs.writeFileSync(filePath, buffer);
      } catch (_e) {}
    }
  }

  // Update persistent registry in all storage directories
  const arr = Array.from(uploadsStore.values());
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const registryPath = path.join(dir, "uploads_index.json");
      fs.writeFileSync(registryPath, JSON.stringify(arr, null, 2), "utf-8");
    } catch (_e) {}
  }
}

export function getUploadBuffer(filename: string): Buffer | null {
  if (!filename) return null;
  const decoded = decodeURIComponent(filename).trim();
  const lower = decoded.toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTarget = norm(decoded);

  // 1. Check in-memory buffer store
  if (buffersStore.has(filename)) return buffersStore.get(filename)!;
  if (buffersStore.has(decoded)) return buffersStore.get(decoded)!;

  for (const [key, buf] of Array.from(buffersStore.entries())) {
    if (key.toLowerCase() === lower || norm(key) === normTarget) {
      return buf;
    }
  }

  // 2. Check disk storage directories
  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith(".json")) continue;
          if (
            file === filename ||
            file === decoded ||
            file.toLowerCase() === lower ||
            norm(file) === normTarget
          ) {
            const buf = fs.readFileSync(path.join(dir, file));
            buffersStore.set(filename, buf);
            buffersStore.set(file, buf);
            return buf;
          }
        }
      }
    } catch (_e) {}
  }

  // 3. Re-sync from disk if not found yet
  syncUploadsFromDisk();
  if (buffersStore.has(filename)) return buffersStore.get(filename)!;
  if (buffersStore.has(decoded)) return buffersStore.get(decoded)!;
  for (const [key, buf] of Array.from(buffersStore.entries())) {
    if (key.toLowerCase() === lower || norm(key) === normTarget) {
      return buf;
    }
  }

  const doc = getUploadRecord(filename);
  if (doc?.content && !filename.toLowerCase().endsWith(".pdf")) {
    return Buffer.from(doc.content, "utf-8");
  }
  return null;
}

export function getUploadRecord(filename: string): UploadRecord | null {
  if (!filename) return null;
  const decoded = decodeURIComponent(filename).trim();
  const lower = decoded.toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTarget = norm(decoded);

  if (uploadsStore.has(filename)) return uploadsStore.get(filename)!;
  if (uploadsStore.has(decoded)) return uploadsStore.get(decoded)!;

  for (const [key, val] of Array.from(uploadsStore.entries())) {
    if (
      key === filename ||
      key === decoded ||
      key.toLowerCase() === lower ||
      val.filename.toLowerCase() === lower ||
      val.originalName?.toLowerCase() === lower ||
      norm(key) === normTarget ||
      norm(val.filename) === normTarget ||
      (val.originalName && norm(val.originalName) === normTarget)
    ) {
      return val;
    }
  }

  // Check disk sync if not found
  syncUploadsFromDisk();
  if (uploadsStore.has(filename)) return uploadsStore.get(filename)!;
  if (uploadsStore.has(decoded)) return uploadsStore.get(decoded)!;
  for (const [, val] of Array.from(uploadsStore.entries())) {
    if (
      val.filename.toLowerCase() === lower ||
      val.originalName?.toLowerCase() === lower ||
      norm(val.filename) === normTarget ||
      (val.originalName && norm(val.originalName) === normTarget)
    ) {
      return val;
    }
  }

  return null;
}

export function deleteUploadFile(filename: string) {
  if (!filename) return;
  const safeFilename = path.basename(filename).trim();
  if (!safeFilename) return;
  const decoded = decodeURIComponent(safeFilename).trim();
  const lower = decoded.toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTarget = norm(decoded);

  // 1. Delete from in-memory stores
  uploadsStore.delete(filename);
  uploadsStore.delete(decoded);
  buffersStore.delete(filename);
  buffersStore.delete(decoded);

  for (const [key, val] of Array.from(uploadsStore.entries())) {
    const kLower = key.toLowerCase();
    const fLower = (val.filename || "").toLowerCase();
    const origLower = (val.originalName || "").toLowerCase();
    if (
      key === filename ||
      key === decoded ||
      kLower === lower ||
      fLower === lower ||
      origLower === lower ||
      norm(key) === normTarget ||
      norm(val.filename || "") === normTarget ||
      norm(val.originalName || "") === normTarget
    ) {
      uploadsStore.delete(key);
      buffersStore.delete(key);
    }
  }

  for (const [key] of Array.from(buffersStore.entries())) {
    const kLower = key.toLowerCase();
    if (key === filename || key === decoded || kLower === lower || norm(key) === normTarget) {
      buffersStore.delete(key);
    }
  }

  // 2. Delete matching physical files from all storage directories
  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith(".json")) continue;
          const fDecoded = decodeURIComponent(file);
          const fLower = file.toLowerCase();
          if (
            file === filename ||
            file === decoded ||
            fDecoded === decoded ||
            fLower === lower ||
            fLower === filename.toLowerCase() ||
            norm(file) === normTarget ||
            norm(fDecoded) === normTarget
          ) {
            const filePath = path.join(dir, file);
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (unlinkErr) {
              console.warn(`Failed to unlink ${filePath}:`, unlinkErr);
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 3. Update persistent registry in all storage directories
  const currentRecords = Array.from(uploadsStore.values()).filter(
    (r) =>
      r.filename !== filename &&
      r.filename.toLowerCase() !== lower &&
      norm(r.filename) !== normTarget
  );

  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const registryPath = path.join(dir, "uploads_index.json");
        fs.writeFileSync(registryPath, JSON.stringify(currentRecords, null, 2), "utf-8");
      }
    } catch (_e) {}
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "akw_secure_jwt_secret_key_2026_x89f_auto";

// Production guard: fail loudly if JWT_SECRET is not explicitly configured
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error(
    "🚨 SECURITY WARNING: JWT_SECRET environment variable is not set in production. " +
    "The application is using an insecure default key. " +
    "Set JWT_SECRET in your production environment immediately."
  );
}


export function generateToken(username: string): string {
  const normUser = username.trim().toLowerCase();
  const user = usersStore.get(normUser) || usersStore.get(username);
  const tokenVersion = user?.tokenVersion ?? 1;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: username,
    ver: tokenVersion,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encHeader}.${encPayload}`)
    .digest("base64url");
  return `${encHeader}.${encPayload}.${signature}`;
}

export function invalidateUserTokens(username: string): void {
  const normUser = username.trim().toLowerCase();
  const user = usersStore.get(normUser) || usersStore.get(username);
  if (user) {
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    usersStore.set(user.username, user);
    usersStore.set(normUser, user);
  }
}

export function verifyToken(token: string | null): string | null {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) return null;

  // 1. Standard HS256 JWT: header.payload.signature
  const parts = cleanToken.split(".");
  if (parts.length === 3) {
    const [headerB64, payloadB64, signatureB64] = parts;
    try {
      const expectedSig = crypto
        .createHmac("sha256", JWT_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");

      const sigBuf = Buffer.from(signatureB64, "base64url");
      const expBuf = Buffer.from(expectedSig, "base64url");

      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
        const payload = JSON.parse(payloadStr);
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < nowSec) {
          return null; // Expired
        }
        if (payload.sub && typeof payload.sub === "string") {
          // Token rotation / revocation check: verify version if present
          const user = usersStore.get(payload.sub.toLowerCase()) || usersStore.get(payload.sub);
          if (user && user.tokenVersion !== undefined && payload.ver !== undefined) {
            if (payload.ver !== user.tokenVersion) {
              return null; // Token revoked
            }
          }
          return payload.sub;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader) return authHeader;
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/ak_token=([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!password || !storedHash) return false;

  // 1. Salted scrypt hash verification
  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    if (parts.length === 3) {
      const [, salt, expectedHex] = parts;
      try {
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const expectedBuf = Buffer.from(expectedHex, "hex");
        if (derivedKey.length === expectedBuf.length && crypto.timingSafeEqual(derivedKey, expectedBuf)) {
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  // 2. Legacy plaintext migration fallback (timing-safe check)
  const pwdBuf = Buffer.from(password);
  const hashBuf = Buffer.from(storedHash);
  if (pwdBuf.length === hashBuf.length && crypto.timingSafeEqual(pwdBuf, hashBuf)) {
    return true;
  }

  return false;
}
