BEO Upload Template

This CSV file is a template you can open and edit in Excel (or any spreadsheet app). Save it as `.csv` or `.xlsx` and upload via the BEO Upload UI (`SmartUpload`).

Required columns (first row headers):
- `eventName` — Event title (string)
- `date` — Event date in `YYYY-MM-DD` format
- `venue` — Venue or room name (string)
- `guestCount` — Integer number of expected guests
- `startTime` — Event start time in `HH:MM` (24-hour)
- `endTime` — Event end time in `HH:MM` (24-hour)

Notes:
- The website currently accepts CSV and Excel files from the front-end, but the backend cloud function `extract-beo` only accepts PDF and image types. Uploading CSV/XLSX may currently fail unless the backend is updated to parse them.

Next steps if you want the site to accept this template directly:
1. I can update `supabase/functions/extract-beo/index.ts` to accept CSV/XLSX and parse the first row into the expected JSON structure.
2. Or we can add a separate endpoint to import CSV/XLSX files and create draft events.

Tell me which option you prefer and I'll implement it.