# AVIAN Reports Demo

The demo functionality has been integrated into the main reports page at `/reports`.

## Demo Features

### Integrated Demo Data
- The main reports page now uses demo data for testing and demonstration
- Realistic mock data showcasing executive presentation capabilities
- All report types (weekly, monthly, quarterly) supported

### PDF Export Demo
- **Endpoint**: `/api/reports/export/demo`
- **Functionality**: Generates actual PDF from presentation content using PDFGenerator service
- **Fallback**: Simple PDF if full generation fails
- **Features**: 
  - Landscape orientation
  - AVIAN branding
  - Executive-grade presentation
  - Proper slide structure

### Demo Data API
- **Endpoint**: `/api/reports/demo`
- **Parameters**: `?type=weekly|monthly|quarterly`
- **Returns**: Realistic report data with:
  - Executive summary
  - Key takeaways
  - Recommended actions
  - Security metrics
  - Vulnerability data
  - Update summaries

## Usage

1. Navigate to `/reports`
2. Select report type (Weekly/Monthly/Quarterly)
3. Click "Create Report" to generate demo data
4. Use "Export PDF" to download the presentation as PDF
5. View "History" for audit trail (demo functionality)

## Technical Implementation

- **Main Page**: `src/app/reports/page.tsx`
- **Demo API**: `src/app/api/reports/demo/route.ts`
- **PDF Export**: `src/app/api/reports/export/demo/route.ts`
- **PDF Generator**: Uses actual `PDFGenerator` service with Playwright
- **Components**: Integrated with existing `ReportPreview` and `PDFExportInterface`

## Benefits

- Single unified interface for both demo and production
- Real PDF generation testing
- Executive presentation validation
- Client-ready output verification
- Proper AVIAN branding consistency