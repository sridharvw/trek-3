const SHEET_NAME = "Registrations";
const PAYMENT_FOLDER_NAME = "NSS Trek Payment Screenshots";

function doGet() {
  return jsonResponse({ success: true, message: "Registration endpoint is online." });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lock.waitLock(30000);
    lockAcquired = true;

    if (!event || !event.postData || !event.postData.contents) {
      return jsonResponse({ success: false, message: "Registration data is missing." });
    }

    const data = JSON.parse(event.postData.contents);
    const mobile = normalizeMobile(data.mobile);

    if (mobile.length !== 10) {
      return jsonResponse({ success: false, message: "Enter a valid 10-digit mobile number." });
    }

    if (data.paymentMethod !== "Cash" && data.paymentMethod !== "Online") {
      return jsonResponse({ success: false, message: "Select a valid payment method." });
    }

    if (data.paymentMethod === "Online" && (!data.paymentProofData || !data.paymentProofName)) {
      return jsonResponse({ success: false, message: "Upload the online payment screenshot." });
    }

    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const duplicate = values.slice(1).some((row) => normalizeMobile(row[6]) === mobile);

    if (duplicate) {
      return jsonResponse({ success: false, message: "This mobile number is already registered." });
    }

    const registrationNumber = sheet.getLastRow();
    const proofUrl = savePaymentProof(data.paymentProofData, data.paymentProofName, data.paymentProofType, registrationNumber);
    sheet.appendRow([
      new Date(),
      data.name || "",
      data.year || "",
      data.section || "",
      data.course || "",
      data.regno || "",
      mobile,
      data.emergencyMobile || "",
      data.paymentMethod || "",
      "400",
      "Pending verification",
      proofUrl
    ]);

    return jsonResponse({
      success: true,
      name: data.name || "there",
      registrationNumber: registrationNumber
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: "Registration could not be saved: " + error.message
    });
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  const headers = [
    "Timestamp",
    "Name",
    "Year",
    "Section",
    "Course",
    "Registration Number",
    "Mobile",
    "Emergency Mobile",
    "Payment Method",
    "Payment Amount",
    "Payment Status",
    "Payment Screenshot"
  ];

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#e7ad4b")
    .setFontColor("#050608");
  sheet.autoResizeColumns(1, headers.length);

  return sheet;
}

function savePaymentProof(base64Data, fileName, mimeType, registrationNumber) {
  if (!base64Data || !fileName) {
    return "";
  }

  const folder = getPaymentFolder();
  const bytes = Utilities.base64Decode(base64Data);
  const file = folder.createFile(Utilities.newBlob(
    bytes,
    mimeType || MimeType.JPEG,
    "registration-" + registrationNumber + "-" + fileName
  ));
  return file.getUrl();
}

function getPaymentFolder() {
  const folders = DriveApp.getFoldersByName(PAYMENT_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PAYMENT_FOLDER_NAME);
}

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
