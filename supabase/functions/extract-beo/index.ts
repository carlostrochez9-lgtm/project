import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import { createWorker } from "npm:tesseract.js@5.0.4";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractedBEOData {
  eventName: string;
  date: string;
  venue: string;
  guestCount: number;
  startTime: string;
  endTime: string;
}

function extractEventName(text: string): string {
  const patterns = [
    /event\s*name[:\s]+([^\n]{3,80})/i,
    /function[:\s]+([^\n]{3,80})/i,
    /occasion[:\s]+([^\n]{3,80})/i,
    /title[:\s]+([^\n]{3,80})/i,
    /event[:\s]+([^\n]{3,80})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractDate(text: string): string {
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,
    /date[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].includes('-') && match[0].match(/^\d{4}/)) {
        return match[0];
      }

      if (match[2] && match[3]) {
        let month = match[1];
        let day = match[2];
        let year = match[3];

        if (year.length === 2) {
          year = '20' + year;
        }

        if (month.length === 1) month = '0' + month;
        if (day.length === 1) day = '0' + day;

        return `${year}-${month}-${day}`;
      }
    }
  }

  return "";
}

function extractVenue(text: string): string {
  const patterns = [
    /venue[:\s]+([^\n]{3,60})/i,
    /location[:\s]+([^\n]{3,60})/i,
    /room[:\s]+([^\n]{3,60})/i,
    /ballroom[:\s]+([^\n]{3,60})/i,
    /(\w+\s+ballroom)/i,
    /(\w+\s+hall)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractGuestCount(text: string): number {
  const patterns = [
    /guest[s]?[:\s]+(\d+)/i,
    /attendance[:\s]+(\d+)/i,
    /expected[:\s]+(\d+)/i,
    /capacity[:\s]+(\d+)/i,
    /pax[:\s]+(\d+)/i,
    /(\d+)\s+guests/i,
    /(\d+)\s+people/i,
    /(\d+)\s+attendees/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const count = parseInt(match[1]);
      if (count > 0 && count < 10000) {
        return count;
      }
    }
  }

  return 0;
}

function extractTime(text: string, isStart: boolean): string {
  const label = isStart ? 'start' : 'end';
  const altLabel = isStart ? 'begin' : 'finish|close';

  const patterns = [
    new RegExp(`${label}\\s*time[:\\s]+(\\d{1,2})[:\\.]?(\\d{2})\\s*(am|pm)?`, 'i'),
    new RegExp(`${altLabel}[:\\s]+(\\d{1,2})[:\\.]?(\\d{2})\\s*(am|pm)?`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] || '00';
      const period = match[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }

      const hoursStr = hours.toString().padStart(2, '0');
      return `${hoursStr}:${minutes}`;
    }
  }

  const timePattern = /(\d{1,2})[:.]?(\d{2})\s*(am|pm)/gi;
  const times: string[] = [];
  let timeMatch;

  while ((timeMatch = timePattern.exec(text)) !== null) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] || '00';
    const period = timeMatch[3]?.toLowerCase();

    if (period === 'pm' && hours < 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }

    const hoursStr = hours.toString().padStart(2, '0');
    times.push(`${hoursStr}:${minutes}`);
  }

  if (times.length > 0) {
    return isStart ? times[0] : times[times.length - 1];
  }

  return "";
}

function extractBEOData(text: string): ExtractedBEOData {
  console.log("Extracting data from text...");
  console.log("Text preview:", text.substring(0, 500));

  const data: ExtractedBEOData = {
    eventName: extractEventName(text),
    date: extractDate(text),
    venue: extractVenue(text),
    guestCount: extractGuestCount(text),
    startTime: extractTime(text, true),
    endTime: extractTime(text, false),
  };

  console.log("Extracted data:", JSON.stringify(data));
  return data;
}

async function extractTextFromPDF(buffer: Uint8Array): Promise<string> {
  console.log("Extracting text from PDF...");

  try {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    console.log(`PDF has ${numPages} pages`);

    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + "\n";
    }

    console.log("Text extraction successful, length:", fullText.length);
    return fullText;
  } catch (error) {
    console.error("PDF text extraction error:", error);
    throw error;
  }
}

async function extractTextWithOCR(buffer: Uint8Array): Promise<string> {
  console.log("Attempting OCR extraction for scanned PDF...");

  try {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    console.log(`Processing ${numPages} pages with OCR...`);

    const worker = await createWorker('eng');
    let fullText = "";

    for (let pageNum = 1; pageNum <= Math.min(numPages, 5); pageNum++) {
      console.log(`Processing page ${pageNum}/${numPages} with OCR...`);

      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      if (!context) {
        console.error("Failed to get canvas context");
        continue;
      }

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageData = context.getImageData(0, 0, viewport.width, viewport.height);

      const { data: { text } } = await worker.recognize(imageData);
      fullText += text + "\n";

      console.log(`Page ${pageNum} OCR complete, extracted ${text.length} characters`);
    }

    await worker.terminate();

    console.log("OCR extraction complete, total text length:", fullText.length);
    return fullText;
  } catch (ocrError) {
    console.error("OCR extraction failed:", ocrError);
    throw new Error(`OCR processing failed: ${String(ocrError)}`);
  }
}

function parseExcelDate(excelDate: any): string {
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    const year = date.y;
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof excelDate === 'string') {
    const extracted = extractDate(excelDate);
    if (extracted) return extracted;
  }

  return "";
}

function parseExcelTime(excelTime: any): string {
  if (typeof excelTime === 'number') {
    const totalMinutes = Math.round(excelTime * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (typeof excelTime === 'string') {
    const extracted = extractTime(excelTime, true);
    if (extracted) return extracted;
  }

  return "";
}

async function extractTextFromExcel(buffer: Uint8Array): Promise<string> {
  console.log("Extracting text from Excel...");

  try {
    const workbook = XLSX.read(buffer, { type: 'array' });

    let allText = "";

    workbook.SheetNames.forEach(sheetName => {
      console.log(`Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

      jsonData.forEach((row: any) => {
        if (Array.isArray(row)) {
          const rowText = row.join(' ');
          allText += rowText + "\n";
        }
      });
    });

    console.log("Excel extraction successful, text length:", allText.length);
    return allText;
  } catch (error) {
    console.error("Excel extraction error:", error);
    throw new Error(`Failed to parse Excel file: ${String(error)}`);
  }
}

function extractFromExcelStructured(buffer: Uint8Array): ExtractedBEOData {
  console.log("Attempting structured Excel extraction...");

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    const data: ExtractedBEOData = {
      eventName: "",
      date: "",
      venue: "",
      guestCount: 0,
      startTime: "",
      endTime: "",
    };

    const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');

    for (let row = range.s.r; row <= Math.min(range.e.r, 100); row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = firstSheet[cellAddress];

        if (!cell || !cell.v) continue;

        const cellValue = String(cell.v).toLowerCase();
        const nextCol = col + 1;
        const nextCellAddress = XLSX.utils.encode_cell({ r: row, c: nextCol });
        const nextCell = firstSheet[nextCellAddress];

        if (cellValue.includes('event') && (cellValue.includes('name') || cellValue.includes('title'))) {
          if (nextCell && nextCell.v) {
            data.eventName = String(nextCell.v);
          }
        }

        if (cellValue.includes('date') && !cellValue.includes('update')) {
          if (nextCell) {
            if (nextCell.t === 'd' || nextCell.t === 'n') {
              data.date = parseExcelDate(nextCell.v);
            } else if (nextCell.v) {
              data.date = parseExcelDate(nextCell.v);
            }
          }
        }

        if ((cellValue.includes('venue') || cellValue.includes('location') || cellValue.includes('room')) && !cellValue.includes('contact')) {
          if (nextCell && nextCell.v) {
            data.venue = String(nextCell.v);
          }
        }

        if (cellValue.includes('guest') || cellValue.includes('attendance') || cellValue.includes('pax') || cellValue.includes('capacity')) {
          if (nextCell && nextCell.v) {
            const count = parseInt(String(nextCell.v).replace(/[^\d]/g, ''));
            if (!isNaN(count) && count > 0 && count < 10000) {
              data.guestCount = count;
            }
          }
        }

        if (cellValue.includes('start') && cellValue.includes('time')) {
          if (nextCell && nextCell.v) {
            data.startTime = parseExcelTime(nextCell.v);
          }
        }

        if (cellValue.includes('end') && cellValue.includes('time')) {
          if (nextCell && nextCell.v) {
            data.endTime = parseExcelTime(nextCell.v);
          }
        }
      }
    }

    console.log("Structured Excel extraction result:", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Structured Excel extraction failed:", error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - please log in again" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to verify user permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      console.error("No profile found for user:", user.id);
      return new Response(
        JSON.stringify({ error: "User profile not found. Please contact support." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Temporary relaxation: allow non-admin uploads when environment
    // variable ALLOW_BEO_UPLOAD_ANYONE is set to "true". This is useful
    // for testing but should NOT be enabled in production long-term.
    const allowNonAdminUploads = Deno.env.get("ALLOW_BEO_UPLOAD_ANYONE") === "true";
    if (!allowNonAdminUploads && profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can upload BEO documents" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isExcelFile = ['xlsx', 'xls', 'csv'].includes(fileExtension || '');

    if (!allowedTypes.includes(file.type) && !isExcelFile) {
      return new Response(
        JSON.stringify({ error: "Only PDF, Excel (.xlsx, .xls), and CSV files are supported." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing file:", file.name, "Type:", file.type);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    let extractedText = "";
    let extractionMethod = "text_extraction";
    let beoData: ExtractedBEOData;

    if (isExcelFile || file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === 'text/csv') {
      console.log("Processing as Excel file");

      try {
        beoData = extractFromExcelStructured(buffer);
        extractionMethod = "excel_structured";

        if (!beoData.eventName || !beoData.date) {
          console.log("Structured extraction incomplete, falling back to text extraction");
          extractedText = await extractTextFromExcel(buffer);
          const textBeoData = extractBEOData(extractedText);

          beoData = {
            eventName: beoData.eventName || textBeoData.eventName,
            date: beoData.date || textBeoData.date,
            venue: beoData.venue || textBeoData.venue,
            guestCount: beoData.guestCount || textBeoData.guestCount,
            startTime: beoData.startTime || textBeoData.startTime,
            endTime: beoData.endTime || textBeoData.endTime,
          };
          extractionMethod = "excel_hybrid";
        }
      } catch (excelError) {
        console.error("Excel extraction failed:", excelError);
        return new Response(
          JSON.stringify({
            error: "Failed to extract data from Excel file.",
            details: String(excelError),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("Processing as PDF file");

      try {
        extractedText = await extractTextFromPDF(buffer);
        console.log("PDF text extracted successfully, length:", extractedText.length);
      } catch (pdfError) {
        console.error("PDF text extraction failed:", pdfError);
        extractedText = "";
      }

      if (!extractedText || extractedText.trim().length < 50) {
        console.log("Insufficient text found, attempting OCR extraction...");
        try {
          extractedText = await extractTextWithOCR(buffer);
          extractionMethod = "ocr";

          if (!extractedText || extractedText.trim().length === 0) {
            return new Response(
              JSON.stringify({
                error: "No text could be extracted from the PDF. The file may be empty, corrupted, or unreadable.",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (ocrError) {
          console.error("OCR extraction error:", ocrError);
          return new Response(
            JSON.stringify({
              error: "Failed to extract text from the PDF using both standard extraction and OCR.",
              details: String(ocrError),
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      beoData = extractBEOData(extractedText);
    }

    const { data: draftEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        title: beoData.eventName || "Untitled Event",
        event_date: beoData.date || new Date().toISOString().split('T')[0],
        venue: beoData.venue || "TBD",
        start_time: beoData.startTime || "00:00",
        end_time: beoData.endTime || "00:00",
        open_shifts: Math.ceil(beoData.guestCount / 50) || 5,
        status: "draft",
        beo_source: file.name,
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to create draft event:", eventError);
      return new Response(
        JSON.stringify({ error: "Failed to create draft event", details: eventError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: beoData,
        draftEvent,
        method: extractionMethod,
        textLength: extractedText.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in extract-beo function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
