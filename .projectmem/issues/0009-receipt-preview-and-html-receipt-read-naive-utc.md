# #0009 Receipt preview and HTML receipt read naive UTC server timestamps as local time and showed 0 Kč cash lines on refunds, so screen disagreed with paper

- 2026-11-17T11:48:11Z `issue`: Receipt preview and HTML receipt read naive UTC server timestamps as local time and showed 0 Kč cash lines on refunds, so screen disagreed with paper [src/components/receipt/ReceiptPreviewPaper.jsx]
- 2026-11-17T11:48:14Z `fix`: f55a1ab: parseSaleTimestamp in dateUtils reads zoneless date-time as UTC; ReceiptPreviewPaper and receiptHtmlGenerator use it and hide cash lines on refunds/no tendered. Test receipt_preview_time.test.jsx; live check showed 11:00:00 for a 10:00Z server sale. Ledger and ~11 other screens still wrong (follow-up). [src/utils/dateUtils.js]
