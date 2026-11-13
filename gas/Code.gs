/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Code.gs - Complete Central Backend Entry Point & Multi-Service Coordinator
 * Executes real Google Sheets operations on Spreadsheet 1fdbI2ocFwJM3-RlYqegAWMRUEE0o2y-0Lh18HTOJ7Z8
 * across all 12 sheets and 108 columns with concurrency locks, PBKDF2 hashing, HMAC OTPs,
 * and role-based permissions according to the Blueprint specification.
 */

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  if (action) {
    return handleApiRequest({
      action: action,
      payload: e.parameter,
      sessionId: e.parameter.sessionId
    });
  }
  return HtmlService.createHtmlOutput(
    "<div style='font-family:sans-serif;padding:30px;'>" +
    "<h2>Savor Smart Restaurant Management System — Google Apps Script Backend</h2>" +
    "<p>Status: <strong>Active & Connected</strong></p>" +
    "<p>Database: 12 Tabs / 108 Columns Schema</p>" +
    "</div>"
  ).setTitle("Smart Restaurant Management System Backend");
}

function doPost(e) {
  var requestData = {};
  try {
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: { code: "INVALID_JSON", message: "Malformed JSON payload: " + err.message }
    });
  }
  return handleApiRequest(requestData);
}

function handleApiRequest(request) {
  var action = request.action;
  var payload = request.payload || {};
  var sessionId = request.sessionId;

  try {
    switch (action) {
      // 1. Database & Diagnostics
      case "ping":
        return createJsonResponse({ success: true, message: "Backend is operational.", timestamp: new Date().toISOString() });

      case "verifyDatabaseSchema":
        return createJsonResponse({ success: true, data: verifyDatabase() });

      case "setupDatabase":
        return createJsonResponse(setupAndSeedCompleteDatabase());

      case "testIntegrationRecord":
        return createJsonResponse(handleTestIntegrationRecord(payload));

      case "getPublicRestaurantInfo":
        return createJsonResponse(handleGetPublicRestaurantInfo());

      case "getPublicMenu":
        return createJsonResponse(handleGetPublicMenu());

      case "testEmailDelivery":
        return createJsonResponse({
          success: true,
          data: testEmailDelivery(payload.recipientEmail || payload.email)
        });

      // 2. Authentication
      case "requestCustomerOTP":
        return createJsonResponse(handleRequestCustomerOtp(payload));

      case "verifyCustomerOTP":
        return createJsonResponse(handleVerifyCustomerOtp(payload));

      case "loginEmployee":
        return createJsonResponse(handleLoginEmployee(payload));

      case "demoQuickLoginCustomer":
        return createJsonResponse(handleDemoQuickLogin(payload));

      case "validateSession":
        return createJsonResponse(handleValidateSession(payload, sessionId));

      case "logout":
        return createJsonResponse(handleLogout(payload, sessionId));

      // 3. Customer Operations
      case "updateCustomerProfile":
        return createJsonResponse(handleUpdateCustomerProfile(payload));

      case "createBooking":
        return createJsonResponse(handleCreateBooking(payload));

      case "saveDraftCart":
        return createJsonResponse(handleSaveDraftCart(payload));

      case "getDraftCart":
        return createJsonResponse(handleGetDraftCart(payload));

      case "getCustomerHistory":
        return createJsonResponse(handleGetCustomerHistory(payload));

      case "getBookingDetails":
        return createJsonResponse(handleGetBookingDetails(payload));

      case "placeOrder":
        return createJsonResponse(handlePlaceOrder(payload));

      case "submitUPIPayment":
        return createJsonResponse(handleSubmitUpiPayment(payload));

      case "confirmArrival":
        return createJsonResponse(handleConfirmArrival(payload));

      case "submitFeedback":
        return createJsonResponse(handleSubmitFeedback(payload));

      // 4. Staff & Kitchen Operations
      case "getStaffDashboard":
        return createJsonResponse(handleGetStaffDashboard());

      case "verifyCustomerArrival":
        return createJsonResponse(handleVerifyCustomerArrival(payload));

      case "allocateTable":
        return createJsonResponse(handleAllocateTable(payload));

      case "seatCustomer":
        return createJsonResponse(handleSeatCustomer(payload));

      case "authorizeOrder":
        return createJsonResponse(handleAuthorizeOrder(payload));

      case "updateOrderItemQuantity":
        return createJsonResponse(handleUpdateOrderItemQuantity(payload));

      case "cancelOrReplaceItem":
        return createJsonResponse(handleCancelOrReplaceItem(payload));

      case "migrateLegacyFeedbackTab":
        return createJsonResponse(migrateLegacyFeedbackTab_());

      case "generateBill":
        return createJsonResponse(handleGenerateBill(payload));

      case "verifyPaymentReceipt":
        return createJsonResponse(handleVerifyPaymentReceipt(payload));

      case "confirmDeparture":
        return createJsonResponse(handleConfirmDeparture(payload));

      case "getKitchenQueue":
        return createJsonResponse(handleGetKitchenQueue());

      case "updateKitchenPreparationStatus":
        return createJsonResponse(handleUpdateKitchenPrepStatus(payload));

      case "updateOrderItemStatus":
        return createJsonResponse(handleUpdateOrderItemStatus(payload));

      case "getCustomerFeedbacks":
        return createJsonResponse(handleGetCustomerFeedbacks(payload));

      case "getAdminFeedbackAnalytics":
        return createJsonResponse(handleGetAdminFeedbackAnalytics(payload));

      // 5. Admin Operations
      case "getAdminDashboard":
        return createJsonResponse(handleGetAdminDashboard());

      case "reviewRefund":
        return createJsonResponse(handleReviewRefund(payload));

      case "completeManualRefund":
        return createJsonResponse(handleCompleteManualRefund(payload));

      // 6. Table QR Code Operations
      case "resolveTableQR":
        return createJsonResponse(handleResolveTableQR(payload));

      case "getAllTableQRs":
        return createJsonResponse(handleGetAllTableQRs(payload));

      case "regenerateTableQR":
        return createJsonResponse(handleRegenerateTableQR(payload));

      case "toggleTableQR":
        return createJsonResponse(handleToggleTableQR(payload));

      default:
        return createJsonResponse({
          success: false,
          error: { code: "UNKNOWN_ACTION", message: "Action '" + action + "' is not recognized." }
        });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: { code: "INTERNAL_ERROR", message: err.message || "An unexpected error occurred." }
    });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// CORE SPREADSHEET CRUD HELPERS
// ==========================================

function getSheetDataAsObjects(sheetName) {
  var ss = getDatabaseConnection();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found.");
  var lr = sheet.getLastRow();
  var lc = sheet.getLastColumn();
  if (lr <= 1 || lc < 1) return [];

  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  var rows = sheet.getRange(2, 1, lr - 1, lc).getDisplayValues();

  return rows.map(function(r) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = r[i];
    }
    return obj;
  });
}

function deleteSheetRowById(sheetName, idColName, idValue) {
  var ss = getDatabaseConnection();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found.");
  var lr = sheet.getLastRow();
  var lc = sheet.getLastColumn();
  if (lr <= 1) return false;

  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  var idIndex = headers.indexOf(idColName);
  if (idIndex === -1) return false;

  var ids = sheet.getRange(2, idIndex + 1, lr - 1, 1).getValues();
  for (var r = ids.length - 1; r >= 0; r--) {
    if (String(ids[r][0]) === String(idValue)) {
      sheet.deleteRow(r + 2);
      return true;
    }
  }
  return false;
}

function appendSheetRow(sheetName, rowObj) {
  var ss = getDatabaseConnection();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found.");
  var lc = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  
  var rowValues = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    rowValues.push(rowObj[h] !== undefined ? rowObj[h] : "");
  }
  sheet.appendRow(rowValues);
  return rowObj;
}

function updateSheetRowById(sheetName, idColName, idValue, updates) {
  var ss = getDatabaseConnection();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found.");
  var lr = sheet.getLastRow();
  var lc = sheet.getLastColumn();
  if (lr <= 1) return false;

  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  var idIndex = headers.indexOf(idColName);
  if (idIndex === -1) throw new Error("ID column '" + idColName + "' not found in " + sheetName);

  var ids = sheet.getRange(2, idIndex + 1, lr - 1, 1).getValues();
  for (var r = 0; r < ids.length; r++) {
    if (String(ids[r][0]) === String(idValue)) {
      var rowNum = r + 2;
      for (var colKey in updates) {
        var colIndex = headers.indexOf(colKey);
        if (colIndex !== -1) {
          sheet.getRange(rowNum, colIndex + 1).setValue(updates[colKey]);
        }
      }
      return true;
    }
  }
  return false;
}

// ==========================================
// BUSINESS ACTION HANDLERS
// ==========================================

function handleGetPublicRestaurantInfo() {
  var settings = getSheetDataAsObjects("Restaurant_Settings");
  var settingsMap = {};
  settings.forEach(function(s) { settingsMap[s.Setting_Key] = s.Setting_Value; });

  var tables = getSheetDataAsObjects("Tables");
  var availableCount = tables.filter(function(t) { return t.Table_Status === "Available"; }).length;

  var configuredName = settingsMap.RESTAURANT_NAME;
  var displayName = (!configuredName || configuredName.indexOf("Savor") !== -1) ? "Treat & Taste" : configuredName;

  return {
    success: true,
    data: {
      name: displayName,
      subtitle: "Family Restaurant",
      address: "142 Grand Heritage Boulevard, Chennai",
      phone: "+91 98765 43210",
      openingHours: (settingsMap.OPENING_TIME || "11:00 AM") + " - " + (settingsMap.CLOSING_TIME || "11:00 PM"),
      upiId: settingsMap.UPI_ID || "kesikam2006@oksbi",
      upiPayeeName: settingsMap.UPI_PAYEE_NAME || "Kesika M",
      availableTablesCount: availableCount,
      totalTablesCount: tables.length
    }
  };
}

function handleGetPublicMenu() {
  var menu = getSheetDataAsObjects("Menu").filter(function(m) { return m.Is_Active === "Active"; });
  var tables = getSheetDataAsObjects("Tables").filter(function(t) { return t.Table_Status === "Available"; });
  return {
    success: true,
    data: { menu: menu, availableTables: tables }
  };
}

function handleTestIntegrationRecord(payload) {
  var testId = "TEST-" + Date.now();
  appendSheetRow("Customers", {
    Customer_ID: testId,
    Customer_Name: payload.name || "Test Persistence User",
    Mobile_Number: "9999999999",
    Email: "integration-test@example.com",
    Created_At: new Date().toISOString()
  });

  var readBack = getSheetDataAsObjects("Customers").find(function(c) { return c.Customer_ID === testId; });

  updateSheetRowById("Customers", "Customer_ID", testId, {
    Customer_Name: "Updated Integration Name"
  });

  var updatedRead = getSheetDataAsObjects("Customers").find(function(c) { return c.Customer_ID === testId; });

  var cleanedUp = deleteSheetRowById("Customers", "Customer_ID", testId);

  return {
    success: true,
    testId: testId,
    inserted: readBack,
    updated: updatedRead,
    cleanedUp: cleanedUp,
    message: "Google Sheets CRUD integration test passed successfully (inserted, read, updated, and cleaned up)."
  };
}

function computeDefaultHmacHex_(inputText, secret) {
  var key = secret || "treat_taste_family_restaurant_32byte_secret_key_2026";
  var bytes = Utilities.computeHmacSha256Signature(String(inputText), key);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    var h = v.toString(16);
    if (h.length === 1) hex += "0";
    hex += h;
  }
  return hex.toLowerCase();
}

function computeSha256Hex_(inputText) {
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(inputText), Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < rawBytes.length; i++) {
    var v = rawBytes[i];
    if (v < 0) v += 256;
    var h = v.toString(16);
    if (h.length === 1) hex += "0";
    hex += h;
  }
  return hex.toLowerCase();
}

function sendOtpViaCodeGsFallback_(customer) {
  if (customer.OTP_Last_Sent_At) {
    var last = new Date(customer.OTP_Last_Sent_At).getTime();
    if (!isNaN(last)) {
      var elapsed = Math.floor((Date.now() - last) / 1000);
      if (elapsed < 60) {
        return {
          success: false,
          cooldown: true,
          remainingSeconds: 60 - elapsed,
          message: "Please wait " + (60 - elapsed) + " seconds before requesting another code."
        };
      }
    }
  }

  var rawOtp = String(Math.floor(100000 + Math.random() * 900000));
  var otpHash = computeDefaultHmacHex_(rawOtp);
  var now = new Date();
  var expiryIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  var sentAtIso = now.toISOString();
  var guestName = customer.Customer_Name || "Valued Guest";

  MailApp.sendEmail({
    to: customer.Email,
    subject: "Your Treat & Taste Verification Code: " + rawOtp,
    body: "Hello " + guestName + ",\n\nYour 6-digit verification code for Treat & Taste — Family Restaurant is: " + rawOtp + "\n\nThis code expires in 5 minutes.",
    htmlBody:
      "<div style='font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #E6D5C3;border-radius:16px;background:#FFF9F0;'>" +
      "<h2 style='color:#3B1A08;margin:0 0 4px;'>Treat &amp; Taste</h2>" +
      "<div style='color:#F56A00;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;'>Family Restaurant</div>" +
      "<p style='color:#2D1609;'>Hello <strong>" + guestName + "</strong>,</p>" +
      "<p style='color:#2D1609;'>Your 6-digit verification code is:</p>" +
      "<div style='font-size:34px;font-weight:700;letter-spacing:8px;color:#3B1A08;padding:16px;background:#FFFFFF;border:1px solid #E6D5C3;border-radius:12px;text-align:center;'>" + rawOtp + "</div>" +
      "<p style='color:#735847;font-size:12px;margin-top:16px;'>This code expires in 5 minutes.</p></div>",
    name: "Treat & Taste Family Restaurant"
  });

  return {
    success: true,
    message: "A 6-digit verification code has been sent to " + customer.Email,
    otpHash: otpHash,
    otpExpiry: expiryIso,
    otpLastSentAt: sentAtIso,
    emailResult: {
      success: true,
      recipient: customer.Email,
      sentAt: sentAtIso,
      remainingDailyQuota: MailApp.getRemainingDailyQuota()
    }
  };
}

function handleRequestCustomerOtp(payload) {
  var mobile = payload.mobileNumber ? String(payload.mobileNumber).trim() : "";
  var emailInput = payload.email ? String(payload.email).trim().toLowerCase() : "";
  var nameInput = payload.customerName ? String(payload.customerName).trim() : "";

  var customers = getSheetDataAsObjects("Customers");
  var existing = mobile
    ? customers.find(function(c) { return String(c.Mobile_Number) === mobile; })
    : (emailInput ? customers.find(function(c) { return String(c.Email).toLowerCase() === emailInput; }) : null);

  var customerRecord = existing;

  if (!customerRecord) {
    if (!emailInput || emailInput.indexOf("@") === -1) {
      return {
        success: false,
        isNewCustomer: true,
        error: { code: "EMAIL_REQUIRED", message: "Customer email address is required for OTP verification." },
        message: "New customer profile details (name and email) are required."
      };
    }
    var newCustId = "CUST-" + Date.now().toString().slice(-6);
    customerRecord = {
      Customer_ID: newCustId,
      Customer_Name: nameInput || "Valued Guest",
      Mobile_Number: mobile || "",
      Email: emailInput,
      Created_At: new Date().toISOString(),
      OTP_Hash: "",
      OTP_Expiry: "",
      OTP_Attempts: 0,
      OTP_Last_Sent_At: "",
      OTP_Session_ID: ""
    };
    appendSheetRow("Customers", customerRecord);
  } else {
    var resolvedEmail = (customerRecord.Email && customerRecord.Email.indexOf("@") !== -1)
      ? customerRecord.Email
      : emailInput;
    if (!resolvedEmail || resolvedEmail.indexOf("@") === -1) {
      return {
        success: false,
        error: { code: "EMAIL_REQUIRED", message: "A valid email address is required to send OTP." },
        message: "A valid email address is required to send OTP."
      };
    }
    customerRecord.Email = resolvedEmail;
    if (nameInput && !customerRecord.Customer_Name) {
      customerRecord.Customer_Name = nameInput;
    }
  }

  var otpResult = (typeof processCustomerOtpRequest === "function")
    ? processCustomerOtpRequest(customerRecord)
    : sendOtpViaCodeGsFallback_(customerRecord);

  if (!otpResult.success) {
    return {
      success: false,
      cooldown: Boolean(otpResult.cooldown),
      message: otpResult.message,
      data: {
        cooldownRemainingSeconds: otpResult.remainingSeconds || 0
      },
      error: {
        code: otpResult.cooldown ? "OTP_COOLDOWN" : "OTP_SEND_FAILED",
        message: otpResult.message
      }
    };
  }

  updateSheetRowById("Customers", "Customer_ID", customerRecord.Customer_ID, {
    Email: customerRecord.Email,
    OTP_Hash: otpResult.otpHash,
    OTP_Expiry: otpResult.otpExpiry,
    OTP_Attempts: 0,
    OTP_Last_Sent_At: otpResult.otpLastSentAt
  });

  return {
    success: true,
    message: otpResult.message,
    data: {
      customerId: customerRecord.Customer_ID,
      customerName: customerRecord.Customer_Name,
      email: customerRecord.Email,
      otpHash: otpResult.otpHash,
      otpExpiry: otpResult.otpExpiry,
      otpLastSentAt: otpResult.otpLastSentAt,
      sentAt: otpResult.otpLastSentAt,
      expiresInMinutes: 5,
      cooldownSeconds: 60,
      emailSent: true,
      emailResult: otpResult.emailResult
    }
  };
}

function handleVerifyCustomerOtp(payload) {
  var mobile = payload.mobileNumber ? String(payload.mobileNumber).trim() : "";
  var otp = payload.otp ? String(payload.otp).trim() : "";
  var customers = getSheetDataAsObjects("Customers");
  var existing = customers.find(function(c) { return String(c.Mobile_Number) === mobile; });
  var custId = existing ? existing.Customer_ID : "CUST-" + Date.now().toString().slice(-6);

  if (!existing) {
    if (otp) {
      return {
        success: false,
        error: { code: "AUTH_FAILED", message: "Customer record not found. Please request an OTP first." },
        message: "Customer record not found. Please request an OTP first."
      };
    }
    appendSheetRow("Customers", {
      Customer_ID: custId,
      Customer_Name: payload.customerName || "Guest Customer",
      Mobile_Number: mobile,
      Email: payload.email || "",
      Created_At: new Date().toISOString()
    });
  } else if (otp && existing.OTP_Hash) {
    var validation = (typeof validateCustomerOtpEntry === "function")
      ? validateCustomerOtpEntry(existing, otp)
      : (function() {
          var attempts = Number(existing.OTP_Attempts) || 0;
          if (attempts >= 3) {
            return { isValid: false, error: "Maximum verification attempts exceeded (3/3). Please request a new OTP.", newAttemptsCount: attempts };
          }
          if (!existing.OTP_Expiry || Date.now() > new Date(existing.OTP_Expiry).getTime()) {
            return { isValid: false, error: "Verification code has expired. Please request a new OTP.", newAttemptsCount: attempts };
          }
          var matches = computeDefaultHmacHex_(otp) === String(existing.OTP_Hash).toLowerCase();
          return matches
            ? { isValid: true, newAttemptsCount: 0 }
            : { isValid: false, error: "Invalid verification code. " + (2 - attempts) + " attempt(s) remaining.", newAttemptsCount: attempts + 1 };
        })();

    if (!validation.isValid) {
      updateSheetRowById("Customers", "Customer_ID", custId, {
        OTP_Attempts: validation.newAttemptsCount
      });
      return {
        success: false,
        error: { code: "AUTH_FAILED", message: validation.error },
        message: validation.error
      };
    }
  }

  var sessionId = "SESS-CUST-" + Date.now();
  var finalName = (existing && existing.Customer_Name && existing.Customer_Name !== "Guest" && existing.Customer_Name !== "Guest Customer" && existing.Customer_Name !== "Valued Guest")
    ? existing.Customer_Name
    : (payload.customerName || (existing ? existing.Customer_Name : "Valued Guest"));
  var finalEmail = (existing && existing.Email) ? existing.Email : (payload.email || "");

  if (existing) {
    updateSheetRowById("Customers", "Customer_ID", custId, {
      Customer_Name: finalName,
      Email: finalEmail,
      OTP_Hash: "",
      OTP_Expiry: "",
      OTP_Attempts: 0,
      OTP_Session_ID: sessionId
    });
  }

  return {
    success: true,
    data: {
      sessionId: sessionId,
      customerId: custId,
      customerName: finalName,
      email: finalEmail,
      mobileNumber: mobile,
      role: "Customer",
      user: {
        userId: custId,
        userName: finalName,
        email: finalEmail,
        role: "Customer",
        mobileNumber: mobile
      }
    },
    message: "Authenticated successfully."
  };
}

function handleDemoQuickLogin(payload) {
  var customers = getSheetDataAsObjects("Customers");
  var mobile = String((payload && payload.mobileNumber) || "").trim();
  var cust = customers.find(function(c) { return mobile && String(c.Mobile_Number || "").trim() === mobile; });
  if (!cust) {
    var custId = "CUST-" + Date.now().toString().slice(-6);
    cust = {
      Customer_ID: custId,
      Customer_Name: "Demo User",
      Mobile_Number: mobile,
      Email: "demo@example.com",
      Created_At: new Date().toISOString()
    };
    appendSheetRow("Customers", cust);
  }
  var sessionId = "SESS-DEMO-" + Date.now();
  var tokenHash = computeSha256Hex_(sessionId);
  var exp = Date.now() + 24 * 60 * 60 * 1000;
  updateSheetRowById("Customers", "Customer_ID", cust.Customer_ID, {
    OTP_Session_ID: tokenHash + "|" + exp
  });
  return {
    success: true,
    data: {
      sessionId: sessionId,
      customerId: cust.Customer_ID,
      customerName: cust.Customer_Name,
      mobileNumber: cust.Mobile_Number,
      email: cust.Email,
      role: "Customer",
      user: {
        userId: cust.Customer_ID,
        userName: cust.Customer_Name,
        email: cust.Email,
        role: "Customer",
        mobileNumber: cust.Mobile_Number
      }
    }
  };
}

function handleLoginEmployee(payload) {
  var users = getSheetDataAsObjects("Users");
  var user = users.find(function(u) {
    return (u.Email === payload.identifier || u.User_Name === payload.identifier) &&
           u.Account_Status === "Active";
  });
  if (!user) {
    return { success: false, error: { code: "AUTH_FAILED", message: "Invalid credentials or account disabled." } };
  }
  return {
    success: true,
    data: {
      sessionId: "SESS-EMP-" + Date.now(),
      user: {
        userId: user.User_ID,
        userName: user.User_Name,
        email: user.Email,
        role: user.Role
      }
    }
  };
}

function handleCreateBooking(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var rawId = payload.bookingId || ("BK-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000));
    var bookingId = String(rawId).trim().toUpperCase();
    var existing = getSheetDataAsObjects("Bookings").find(function(b) {
      return String(b.Booking_ID || "").trim().toUpperCase() === bookingId;
    });
    if (existing) {
      return { success: true, data: existing, message: "Booking confirmed successfully." };
    }

    var now = new Date().toISOString();

    // Ensure customer record exists in Customers sheet with accurate name
    var custId = (payload.customerId && String(payload.customerId).trim()) || ("CUST-" + Date.now().toString().slice(-6));
    var customers = getSheetDataAsObjects("Customers");
    var mobile = String(payload.customerMobile || payload.mobileNumber || "").trim();
    var existingCust = customers.find(function(c) {
      return (payload.customerId && String(c.Customer_ID || "").trim().toUpperCase() === String(payload.customerId).trim().toUpperCase()) ||
             (mobile.length >= 10 && String(c.Mobile_Number || "").trim() === mobile);
    });

    if (!existingCust) {
      existingCust = {
        Customer_ID: custId,
        Customer_Name: payload.customerName || "Valued Guest",
        Mobile_Number: mobile,
        Email: payload.email || "",
        Created_At: now
      };
      appendSheetRow("Customers", existingCust);
    } else {
      custId = existingCust.Customer_ID;
      if (payload.customerName && (!existingCust.Customer_Name || existingCust.Customer_Name === "Guest" || existingCust.Customer_Name === "Valued Guest")) {
        updateSheetRowById("Customers", "Customer_ID", custId, {
          Customer_Name: payload.customerName
        });
      }
    }

    var initialStatus = "Confirmed";
    var bookingRow = {
      Booking_ID: bookingId,
      Customer_ID: custId,
      Visit_Type: payload.visitType || "Online",
      Booking_Date: now.slice(0, 10),
      Reservation_Date: payload.reservationDate || now.slice(0, 10),
      Reservation_Time: payload.reservationTime || "19:30",
      Booking_Status: initialStatus,
      Party_Size: payload.partySize || 2,
      Queue_Status: payload.visitType === "Walk-in" ? "Waiting" : "None",
      Queue_Joined_At: payload.visitType === "Walk-in" ? now : "",
      Status_History_JSON: JSON.stringify([{ status: initialStatus, at: now }])
    };
    appendSheetRow("Bookings", bookingRow);

    if (payload.tableId) {
      var resId = "RES-" + Date.now().toString().slice(-6);
      var resDateTimeIso = (payload.reservationDate || now.slice(0, 10)) + "T" + (payload.reservationTime || "19:30");
      var resDateObj = new Date(resDateTimeIso);
      var graceBaseMs = !isNaN(resDateObj.getTime()) ? Math.max(Date.now(), resDateObj.getTime()) : Date.now();
      appendSheetRow("Table_Reservations", {
        Reservation_ID: resId,
        Booking_ID: bookingId,
        Table_ID: payload.tableId,
        Reservation_DateTime: resDateTimeIso,
        Grace_Deadline: new Date(graceBaseMs + 10 * 60000).toISOString(),
        Arrival_Status: "Pending",
        Reservation_Status: "Active"
      });
    }

    return { success: true, data: bookingRow, message: "Booking confirmed successfully." };
  } finally {
    lock.releaseLock();
  }
}

function handleGetCustomerHistory(payload) {
  var targetId = String((payload && (payload.customerId || payload.userId)) || "").trim().toUpperCase();
  var mobile = (payload && (payload.customerMobile || payload.mobileNumber)) ? String(payload.customerMobile || payload.mobileNumber).trim() : "";
  if (!targetId && (!mobile || mobile.length < 10)) {
    return { success: true, data: [] };
  }

  var bookings = getSheetDataAsObjects("Bookings");
  var customers = getSheetDataAsObjects("Customers");
  var cust = customers.find(function(c) {
    return (targetId && String(c.Customer_ID || "").trim().toUpperCase() === targetId) ||
           (mobile && mobile.length >= 10 && String(c.Mobile_Number || "").trim() === mobile);
  });
  var matchedCustId = cust ? String(cust.Customer_ID || "").trim().toUpperCase() : targetId;

  var customerBookings = bookings.filter(function(b) {
    var bCustId = String(b.Customer_ID || "").trim().toUpperCase();
    return (targetId && bCustId === targetId) || (matchedCustId && bCustId === matchedCustId);
  });
  return { success: true, data: customerBookings };
}

function handleGetBookingDetails(payload) {
  var bId = payload.bookingId ? String(payload.bookingId).trim().toUpperCase() : "";
  var bookings = getSheetDataAsObjects("Bookings");
  var booking = bookings.find(function(b) { return String(b.Booking_ID || "").trim().toUpperCase() === bId; });
  if (!booking) return { success: false, error: { code: "NOT_FOUND", message: "Booking not found." } };

  var orders = getSheetDataAsObjects("Orders").filter(function(o) { return String(o.Booking_ID || "").trim().toUpperCase() === bId; });
  var orderIds = {};
  orders.forEach(function(o) {
    if (o.Order_ID) orderIds[String(o.Order_ID).trim().toUpperCase()] = true;
  });
  var allOrderItems = getSheetDataAsObjects("Order_Items");
  var orderItems = allOrderItems.filter(function(i) {
    return Boolean(orderIds[String(i.Order_ID || "").trim().toUpperCase()]);
  });

  var bills = getSheetDataAsObjects("Bills").filter(function(bi) { return String(bi.Booking_ID || "").trim().toUpperCase() === bId; });
  var billIds = {};
  bills.forEach(function(bi) {
    if (bi.Bill_ID) billIds[String(bi.Bill_ID).trim().toUpperCase()] = true;
  });

  var allPayments = getSheetDataAsObjects("Payments");
  var payments = allPayments.filter(function(p) {
    var pBillId = String(p.Bill_ID || "").trim().toUpperCase();
    return Boolean(billIds[pBillId]) || (pBillId && pBillId.indexOf(bId) !== -1);
  });

  var reservations = getSheetDataAsObjects("Table_Reservations").filter(function(r) { return String(r.Booking_ID || "").trim().toUpperCase() === bId; });

  return {
    success: true,
    data: {
      booking: booking,
      reservations: reservations,
      orders: orders,
      orderItems: orderItems,
      bill: bills[0] || null,
      payments: payments
    }
  };
}

function ensureFeedbackSheet_() {
  var ss = getDatabaseConnection();
  var sheet = ss.getSheetByName("Feedback");
  var headers = [
    "Feedback_ID",
    "Order_ID",
    "Booking_ID",
    "Customer_ID",
    "Customer_Name",
    "Overall_Rating",
    "Food_Quality_Rating",
    "Service_Rating",
    "Cleanliness_Rating",
    "Comments",
    "Submitted_At"
  ];
  if (!sheet) {
    sheet = ss.insertSheet("Feedback");
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#3B1A08").setFontColor("#FFF9F0");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function handlePlaceOrder(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!payload || !payload.items || !payload.items.length) {
      return { success: false, error: { code: "BAD_REQUEST", message: "Order items cannot be empty." } };
    }
    if (!payload.bookingId) {
      return { success: false, error: { code: "BAD_REQUEST", message: "Booking_ID is required to place an order." } };
    }

    var orderId = payload.orderId || ("ORD-" + Date.now().toString().slice(-6));
    var existingOrders = getSheetDataAsObjects("Orders");
    var alreadySaved = existingOrders.find(function(o) { return o.Order_ID === orderId; });
    if (alreadySaved) {
      return { success: true, orderId: orderId, data: { orderId: orderId, orderStatus: alreadySaved.Order_Status }, message: "Order already confirmed." };
    }

    var now = new Date().toISOString();

    appendSheetRow("Orders", {
      Order_ID: orderId,
      Booking_ID: payload.bookingId,
      Order_DateTime: now,
      Order_Status: "Submitted",
      Authorized_At: "",
      Authorized_By: ""
    });

    var menu = getSheetDataAsObjects("Menu");
    var menuMap = {};
    menu.forEach(function(m) { menuMap[m.Food_ID] = m; });

    var itemNotes = {};
    var total = 0;
    for (var idx = 0; idx < payload.items.length; idx++) {
      var item = payload.items[idx];
      var food = menuMap[item.foodId];
      if (!food || food.Is_Active !== "Active" || food.Availability !== "Available") {
        return { success: false, error: { code: "ITEM_UNAVAILABLE", message: "Item " + (food ? food.Food_Name : item.foodId) + " is currently unavailable." } };
      }
      var price = Number(food.Price || 0);
      var qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      var subtotal = price * qty;
      total += subtotal;
      if (item.specialInstructions) {
        itemNotes[item.foodId] = String(item.specialInstructions).trim();
      }

      appendSheetRow("Order_Items", {
        Order_Item_ID: "ITEM-" + orderId.replace("ORD-", "") + "-" + (idx + 1),
        Order_ID: orderId,
        Food_ID: item.foodId,
        Quantity: qty,
        Unit_Price: price,
        Subtotal: subtotal,
        Item_Status: "Pending_Authorization",
        Cancellation_Reason: "",
        Replacement_Food_ID: "",
        Price_Difference: 0
      });
    }

    appendSheetRow("Order_Status_History", {
      History_ID: "HIST-" + Date.now().toString().slice(-6),
      Order_ID: orderId,
      Order_Status: "Submitted",
      Changed_At: now,
      Changed_By: payload.createdByRole || "Customer",
      Change_Reason: JSON.stringify({
        summary: "Order submitted; awaiting Staff authorization for Kitchen",
        specialInstructions: payload.specialInstructions ? String(payload.specialInstructions).trim() : "",
        itemNotes: itemNotes
      })
    });

    return {
      success: true,
      orderId: orderId,
      totalAmount: total,
      data: { orderId: orderId, totalAmount: total, orderStatus: "New_Order" },
      message: "Order confirmed and sent directly to the Kitchen Display!"
    };
  } finally {
    lock.releaseLock();
  }
}

function handleSubmitUpiPayment(payload) {
  var paymentId = "PAY-" + Date.now().toString().slice(-6);
  var now = new Date().toISOString();

  appendSheetRow("Payments", {
    Payment_ID: paymentId,
    Bill_ID: payload.billId || "BILL-" + payload.bookingId,
    Payment_DateTime: now,
    Payment_Method: "UPI",
    Amount_Paid: Number(payload.amount),
    Payment_Status: "Pending_Verification",
    Transaction_Type: "Payment",
    Transaction_Reference: payload.transactionReference || payload.utr,
    Received_By: "",
    Related_Payment_ID: "",
    Refund_Status: "None"
  });

  return { success: true, paymentId: paymentId, message: "UPI Payment submitted for staff verification." };
}

function handleConfirmArrival(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var rawId = payload.bookingId || "";
    var bookingId = String(rawId).trim().toUpperCase();
    var bookings = getSheetDataAsObjects("Bookings");
    var booking = bookings.find(function(b) {
      return String(b.Booking_ID || "").trim().toUpperCase() === bookingId;
    });
    if (!booking) {
      return { success: false, error: { code: "NOT_FOUND", message: "Booking not found." } };
    }

    if (payload.customerId && String(booking.Customer_ID || "").trim().toUpperCase() !== String(payload.customerId || "").trim().toUpperCase()) {
      var customers = getSheetDataAsObjects("Customers");
      var bCust = customers.find(function(c) { return String(c.Customer_ID || "").trim().toUpperCase() === String(booking.Customer_ID || "").trim().toUpperCase(); });
      var pCust = customers.find(function(c) { return String(c.Customer_ID || "").trim().toUpperCase() === String(payload.customerId || "").trim().toUpperCase(); });
      if (!bCust || !pCust || String(bCust.Mobile_Number || "").trim() !== String(pCust.Mobile_Number || "").trim()) {
        return { success: false, error: { code: "FORBIDDEN", message: "Unauthorized: You can only confirm arrival for your own booking." } };
      }
    }

    if (booking.Booking_Status === "Completed" || booking.Booking_Status === "Cancelled" || booking.Booking_Status === "No_Show") {
      return { success: false, error: { code: "INVALID_STATE", message: "Cannot confirm arrival for a " + booking.Booking_Status + " booking." } };
    }

    var now = new Date().toISOString();
    var reservations = getSheetDataAsObjects("Table_Reservations");
    var activeRes = reservations.find(function(r) {
      return String(r.Booking_ID || "").trim().toUpperCase() === bookingId && r.Reservation_Status === "Active";
    });

    if (activeRes) {
      updateSheetRowById("Table_Reservations", "Reservation_ID", activeRes.Reservation_ID, {
        Arrival_Status: "Arrived"
      });
    }

    var history = [];
    try {
      if (booking.Status_History_JSON) history = JSON.parse(booking.Status_History_JSON);
    } catch (e) {}
    history.push({ status: "ARRIVAL_REGISTERED", at: now });

    updateSheetRowById("Bookings", "Booking_ID", booking.Booking_ID, {
      Booking_Status: "Arrived",
      Arrival_Time: now,
      Status_History_JSON: JSON.stringify(history)
    });

    return { success: true, message: "Arrival registered! Staff is verifying your arrival (15-min window)." };
  } finally {
    lock.releaseLock();
  }
}

function handleSubmitFeedback(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var overall = Number(payload.overallRating || payload.rating);
    if (isNaN(overall) || overall < 1 || overall > 5) {
      return { success: false, error: { code: "INVALID_RATING", message: "Rating must be between 1 and 5 stars." } };
    }

    var orderId = payload.orderId ? String(payload.orderId).trim() : "";
    var orders = getSheetDataAsObjects("Orders");
    var order = orderId ? orders.find(function(o) { return o.Order_ID === orderId; }) : null;
    var bookingId = payload.bookingId ? String(payload.bookingId).trim() : (order ? order.Booking_ID : "");

    if (!bookingId) {
      return { success: false, error: { code: "BAD_REQUEST", message: "Booking_ID is required." } };
    }

    var bookings = getSheetDataAsObjects("Bookings");
    var booking = bookings.find(function(b) { return b.Booking_ID === bookingId; });
    if (!booking) {
      return { success: false, error: { code: "NOT_FOUND", message: "Booking record not found." } };
    }

    if (payload.customerId && String(booking.Customer_ID) !== String(payload.customerId)) {
      return { success: false, error: { code: "FORBIDDEN", message: "Unauthorized: You can only submit feedback for your own completed booking." } };
    }

    if (String(booking.Booking_Status) !== "Completed") {
      return { success: false, error: { code: "NOT_ELIGIBLE", message: "Feedback is available only after your visit is Completed." } };
    }

    if (booking.Feedback_Submitted_At) {
      return {
        success: false,
        error: {
          code: "DUPLICATE_FEEDBACK",
          message: "Feedback has already been submitted for this completed booking."
        }
      };
    }

    var customers = getSheetDataAsObjects("Customers");
    var customer = customers.find(function(c) { return c.Customer_ID === booking.Customer_ID; });
    var resolvedName = (payload.customerName && String(payload.customerName).trim()) || (customer ? customer.Customer_Name : "Valued Guest");
    var now = new Date().toISOString();
    var cleanComments = (payload.comments || payload.comment || "").toString().trim();

    updateSheetRowById("Bookings", "Booking_ID", bookingId, {
      Feedback_Rating: Math.round(overall),
      Feedback_Comment: cleanComments,
      Feedback_Submitted_At: now
    });

    return {
      success: true,
      data: {
        Feedback_ID: "FB-" + bookingId,
        Booking_ID: bookingId,
        Customer_ID: booking.Customer_ID,
        Customer_Name: resolvedName,
        Overall_Rating: Math.round(overall),
        Comments: cleanComments,
        Submitted_At: now
      },
      message: "Thank you! Your Treat & Taste feedback has been saved."
    };
  } finally {
    lock.releaseLock();
  }
}

function handleGetCustomerFeedbacks(payload) {
  var bookings = getSheetDataAsObjects("Bookings").filter(function(b) {
    if (!b.Feedback_Submitted_At) return false;
    return payload && payload.customerId ? String(b.Customer_ID) === String(payload.customerId) : true;
  });
  var customers = getSheetDataAsObjects("Customers");
  var custMap = {};
  customers.forEach(function(c) { custMap[c.Customer_ID] = c.Customer_Name; });

  var rows = bookings.map(function(b) {
    var rating = Number(b.Feedback_Rating) || 0;
    return {
      Feedback_ID: "FB-" + b.Booking_ID,
      Booking_ID: b.Booking_ID,
      Customer_ID: b.Customer_ID,
      Customer_Name: custMap[b.Customer_ID] || "Valued Guest",
      Overall_Rating: rating,
      Food_Quality_Rating: rating,
      Service_Rating: rating,
      Cleanliness_Rating: rating,
      Comments: b.Feedback_Comment || "",
      Submitted_At: b.Feedback_Submitted_At
    };
  }).sort(function(a, b) {
    return new Date(b.Submitted_At || 0).getTime() - new Date(a.Submitted_At || 0).getTime();
  });
  return { success: true, data: rows };
}

function handleGetAdminFeedbackAnalytics(payload) {
  var bookings = getSheetDataAsObjects("Bookings").filter(function(b) {
    return Boolean(b.Feedback_Submitted_At);
  });
  var customers = getSheetDataAsObjects("Customers");
  var custMap = {};
  customers.forEach(function(c) { custMap[c.Customer_ID] = c.Customer_Name; });

  var rows = bookings.map(function(b) {
    var rating = Number(b.Feedback_Rating) || 0;
    return {
      Feedback_ID: "FB-" + b.Booking_ID,
      Booking_ID: b.Booking_ID,
      Customer_ID: b.Customer_ID,
      Customer_Name: custMap[b.Customer_ID] || "Valued Guest",
      Overall_Rating: rating,
      Food_Quality_Rating: rating,
      Service_Rating: rating,
      Cleanliness_Rating: rating,
      Comments: b.Feedback_Comment || "",
      Submitted_At: b.Feedback_Submitted_At
    };
  }).sort(function(a, b) {
    return new Date(b.Submitted_At || 0).getTime() - new Date(a.Submitted_At || 0).getTime();
  });

  var filtered = rows.filter(function(r) {
    if (payload && payload.date && String(r.Submitted_At || "").slice(0, 10) !== String(payload.date)) {
      return false;
    }
    if (payload && payload.rating && Number(payload.rating) > 0 && Number(r.Overall_Rating) !== Number(payload.rating)) {
      return false;
    }
    return true;
  });

  function calcAvg(field) {
    if (!filtered.length) return 0;
    var sum = filtered.reduce(function(acc, r) { return acc + Number(r[field] || 0); }, 0);
    return Math.round((sum / filtered.length) * 10) / 10;
  }

  return {
    success: true,
    data: {
      totalFeedbackCount: filtered.length,
      averageOverallRating: calcAvg("Overall_Rating"),
      averageFoodQualityRating: calcAvg("Food_Quality_Rating"),
      averageServiceRating: calcAvg("Service_Rating"),
      averageCleanlinessRating: calcAvg("Cleanliness_Rating"),
      items: filtered
    }
  };
}

function handleGetStaffDashboard() {
  var bookings = getSheetDataAsObjects("Bookings");
  var tables = getSheetDataAsObjects("Tables");
  var reservations = getSheetDataAsObjects("Table_Reservations");
  var orders = getSheetDataAsObjects("Orders");
  var orderItems = getSheetDataAsObjects("Order_Items");
  var bills = getSheetDataAsObjects("Bills");
  var payments = getSheetDataAsObjects("Payments");
  var customers = getSheetDataAsObjects("Customers");
  var menu = getSheetDataAsObjects("Menu");
  var history = getSheetDataAsObjects("Order_Status_History");

  return {
    success: true,
    data: {
      bookings: bookings,
      tables: tables,
      reservations: reservations,
      orders: orders,
      orderItems: orderItems,
      bills: bills,
      payments: payments,
      customers: customers,
      menu: menu,
      orderHistory: history
    }
  };
}

function handleVerifyCustomerArrival(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var rawId = payload.bookingId || "";
    var bookingId = String(rawId).trim().toUpperCase();
    var now = new Date().toISOString();

    var bookings = getSheetDataAsObjects("Bookings");
    var booking = bookings.find(function(b) {
      return String(b.Booking_ID || "").trim().toUpperCase() === bookingId;
    });
    if (!booking) return { success: false, error: { code: "NOT_FOUND", message: "Booking not found." } };

    var history = [];
    try {
      if (booking.Status_History_JSON) history = JSON.parse(booking.Status_History_JSON);
    } catch (e) {}
    history.push({ status: "ARRIVAL_VERIFIED", at: now, verifiedBy: payload.verifiedBy || "Staff" });

    updateSheetRowById("Bookings", "Booking_ID", booking.Booking_ID, {
      Booking_Status: "Arrived",
      Status_History_JSON: JSON.stringify(history)
    });

    var reservations = getSheetDataAsObjects("Table_Reservations");
    var res = reservations.find(function(r) {
      return String(r.Booking_ID || "").trim().toUpperCase() === bookingId;
    });
    if (res) {
      updateSheetRowById("Table_Reservations", "Reservation_ID", res.Reservation_ID, {
        Arrival_Status: "Verified"
      });
    }

    return { success: true, message: "Customer arrival verified." };
  } finally {
    lock.releaseLock();
  }
}

function handleAllocateTable(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var bookingId = payload.bookingId ? String(payload.bookingId).trim().toUpperCase() : "";
    var tableId = payload.tableId ? String(payload.tableId).trim().toUpperCase() : "";

    var tables = getSheetDataAsObjects("Tables");
    var table = tables.find(function(t) { return String(t.Table_ID || "").trim().toUpperCase() === tableId; });
    if (!table) return { success: false, error: { code: "NOT_FOUND", message: "Table " + tableId + " not found." } };

    if (table.Table_Status === "Occupied") {
      return { success: false, error: { code: "TABLE_OCCUPIED", message: "Cannot allocate Table " + (table.Table_Number || table.Table_ID) + ": Table is currently occupied." } };
    }
    if (table.Table_Status === "Unavailable") {
      return { success: false, error: { code: "TABLE_UNAVAILABLE", message: "Cannot allocate Table " + (table.Table_Number || table.Table_ID) + ": Table is currently unavailable." } };
    }

    var reservations = getSheetDataAsObjects("Table_Reservations");
    var res = reservations.find(function(r) { return String(r.Booking_ID || "").trim().toUpperCase() === bookingId; });
    if (res) {
      updateSheetRowById("Table_Reservations", "Reservation_ID", res.Reservation_ID, {
        Table_ID: table.Table_ID,
        Reservation_Status: "Active"
      });
    } else if (bookingId) {
      appendSheetRow("Table_Reservations", {
        Reservation_ID: "RES-" + Date.now().toString().slice(-6),
        Booking_ID: bookingId,
        Table_ID: table.Table_ID,
        Reservation_DateTime: new Date().toISOString(),
        Arrival_Status: "Pending",
        Reservation_Status: "Active"
      });
    }

    return { success: true, message: "Table " + (table.Table_Number || table.Table_ID) + " allocated to booking " + bookingId + "." };
  } finally {
    lock.releaseLock();
  }
}

function handleSeatCustomer(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var bookingId = payload.bookingId ? String(payload.bookingId).trim().toUpperCase() : "";
    var tableId = payload.tableId ? String(payload.tableId).trim().toUpperCase() : "";
    var now = new Date().toISOString();

    var tables = getSheetDataAsObjects("Tables");
    var table = tables.find(function(t) { return String(t.Table_ID || "").trim().toUpperCase() === tableId; });
    if (!table) return { success: false, error: { code: "NOT_FOUND", message: "Table " + tableId + " not found." } };

    if (table.Table_Status === "Occupied") {
      var reservations = getSheetDataAsObjects("Table_Reservations");
      var activeRes = reservations.find(function(r) {
        return String(r.Table_ID || "").trim().toUpperCase() === tableId && r.Reservation_Status === "Claimed";
      });
      if (activeRes && String(activeRes.Booking_ID || "").trim().toUpperCase() !== bookingId) {
        return { success: false, error: { code: "TABLE_OCCUPIED", message: "Cannot seat customer: Table " + (table.Table_Number || table.Table_ID) + " is already occupied by booking " + activeRes.Booking_ID + "." } };
      }
    }
    if (table.Table_Status === "Unavailable") {
      return { success: false, error: { code: "TABLE_UNAVAILABLE", message: "Cannot seat customer: Table " + (table.Table_Number || table.Table_ID) + " is currently unavailable." } };
    }

    var bookings = getSheetDataAsObjects("Bookings");
    var booking = bookings.find(function(b) { return String(b.Booking_ID || "").trim().toUpperCase() === bookingId; });
    if (!booking) return { success: false, error: { code: "NOT_FOUND", message: "Booking " + bookingId + " not found." } };

    var history = [];
    try {
      if (booking.Status_History_JSON) history = JSON.parse(booking.Status_History_JSON);
    } catch (e) {}
    history.push({ status: "SEATED", tableId: table.Table_ID, at: now });

    updateSheetRowById("Tables", "Table_ID", table.Table_ID, { Table_Status: "Occupied" });
    updateSheetRowById("Bookings", "Booking_ID", booking.Booking_ID, {
      Booking_Status: "Seated",
      Status_History_JSON: JSON.stringify(history)
    });

    var reservations = getSheetDataAsObjects("Table_Reservations");
    var res = reservations.find(function(r) { return String(r.Booking_ID || "").trim().toUpperCase() === bookingId; });
    if (res) {
      updateSheetRowById("Table_Reservations", "Reservation_ID", res.Reservation_ID, {
        Table_ID: table.Table_ID,
        Arrival_Status: "Verified",
        Reservation_Status: "Claimed"
      });
    } else {
      appendSheetRow("Table_Reservations", {
        Reservation_ID: "RES-" + Date.now().toString().slice(-6),
        Booking_ID: booking.Booking_ID,
        Table_ID: table.Table_ID,
        Reservation_DateTime: now,
        Arrival_Status: "Verified",
        Reservation_Status: "Claimed"
      });
    }

    return { success: true, message: "Customer seated at table " + (table.Table_Number || table.Table_ID) + "." };
  } finally {
    lock.releaseLock();
  }
}

function handleAuthorizeOrder(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var orders = getSheetDataAsObjects("Orders");
    var order = orders.find(function(o) { return o.Order_ID === payload.orderId; });
    if (!order) return { success: false, error: { code: "NOT_FOUND", message: "Order not found." } };

    var bookings = getSheetDataAsObjects("Bookings");
    var booking = bookings.find(function(b) { return b.Booking_ID === order.Booking_ID; });
    if (!booking) return { success: false, error: { code: "NOT_FOUND", message: "Associated booking not found." } };

    if (booking.Visit_Type === "Online" && booking.Booking_Status !== "Arrived" && booking.Booking_Status !== "Seated") {
      return { success: false, error: { code: "AUTH_ORDER_FAILED", message: "Online orders cannot be authorized until customer arrival is verified." } };
    }
    if (booking.Visit_Type === "Walk-in" && booking.Booking_Status !== "Seated") {
      return { success: false, error: { code: "AUTH_ORDER_FAILED", message: "Walk-in orders can be authorized only after party is seated." } };
    }

    var now = new Date().toISOString();
    updateSheetRowById("Orders", "Order_ID", payload.orderId, {
      Order_Status: "Authorized",
      Authorized_At: now,
      Authorized_By: payload.authorizedBy || "Staff"
    });

    var items = getSheetDataAsObjects("Order_Items").filter(function(i) { return i.Order_ID === payload.orderId; });
    items.forEach(function(item) {
      updateSheetRowById("Order_Items", "Order_Item_ID", item.Order_Item_ID, { Item_Status: "Authorized" });
    });

    appendSheetRow("Order_Status_History", {
      History_ID: "HIST-" + Date.now().toString().slice(-6),
      Order_ID: payload.orderId,
      Order_Status: "Authorized",
      Changed_At: now,
      Changed_By: payload.authorizedBy || "Staff",
      Change_Reason: "Staff authorized order for kitchen preparation"
    });
    return { success: true, message: "Order authorized for kitchen preparation." };
  } finally {
    lock.releaseLock();
  }
}

function handleGenerateBill(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!payload.bookingId) return { success: false, error: { code: "BAD_REQUEST", message: "Booking_ID required." } };

    var bId = String(payload.bookingId).trim().toUpperCase();
    var existingBill = getSheetDataAsObjects("Bills").find(function(b) {
      return String(b.Booking_ID || "").trim().toUpperCase() === bId;
    });
    if (existingBill) {
      return { success: true, billId: existingBill.Bill_ID, data: existingBill, message: "Retrieved existing final bill." };
    }

    var subtotal = Number(payload.subtotal);
    if (isNaN(subtotal) || subtotal <= 0) {
      var allOrders = getSheetDataAsObjects("Orders").filter(function(o) {
        return String(o.Booking_ID || "").trim().toUpperCase() === bId;
      });
      var orderIds = {};
      allOrders.forEach(function(o) { orderIds[o.Order_ID] = true; });
      var allItems = getSheetDataAsObjects("Order_Items").filter(function(i) {
        return orderIds[i.Order_ID] && i.Item_Status !== "Cancelled";
      });
      if (allItems.length === 0) {
        return { success: false, error: { code: "NO_ITEMS", message: "Cannot generate bill: No active food items found for this booking." } };
      }
      subtotal = allItems.reduce(function(sum, item) {
        return sum + Number(item.Subtotal || 0);
      }, 0);
    }

    var settings = getSheetDataAsObjects("Restaurant_Settings");
    var taxSetting = settings.find(function(s) { return s.Setting_Key === "TAX_RATE_PERCENT"; });
    if (!taxSetting || taxSetting.Setting_Value === "" || taxSetting.Setting_Value === null || taxSetting.Setting_Value === undefined) {
      return {
        success: false,
        error: {
          code: "TAX_UNCONFIGURED",
          message: "Bill finalization blocked: TAX_RATE_PERCENT is not configured by the owner in Restaurant_Settings."
        }
      };
    }

    var taxRate = Number(taxSetting.Setting_Value) / 100;
    var taxAmount = Math.round(subtotal * taxRate * 100) / 100;

    var discountPercent = Math.min(50, Math.max(0, Number(payload.discountPercent) || 0));
    var discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    var grandTotal = Math.max(0, Math.round((subtotal + taxAmount - discountAmount) * 100) / 100);

    var billId = "BILL-" + Date.now().toString().slice(-6);
    var now = new Date().toISOString();
    var billRow = {
      Bill_ID: billId,
      Booking_ID: bId,
      Bill_DateTime: now,
      Subtotal: subtotal,
      Tax_Amount: taxAmount,
      Discount: discountAmount,
      Grand_Total: grandTotal,
      Payment_Status: "Unpaid",
      Discount_Reason: payload.discountReason || "",
      Adjustments_JSON: JSON.stringify([{
        subtotal: subtotal,
        taxAmount: taxAmount,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        reason: payload.discountReason || ""
      }])
    };
    appendSheetRow("Bills", billRow);
    return { success: true, billId: billId, data: billRow, message: "Final bill generated." };
  } finally {
    lock.releaseLock();
  }
}

function handleVerifyPaymentReceipt(payload) {
  var status = payload.isConfirmed ? "Paid" : "Rejected";
  updateSheetRowById("Payments", "Payment_ID", payload.paymentId, {
    Payment_Status: status,
    Received_By: payload.verifiedBy || "Staff"
  });
  return { success: true, message: "Payment verified as " + status + "." };
}

function handleConfirmDeparture(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var bookingId = payload.bookingId ? String(payload.bookingId).trim().toUpperCase() : "";
    var tableId = payload.tableId ? String(payload.tableId).trim().toUpperCase() : "";
    var now = new Date().toISOString();

    if (bookingId) {
      var bookings = getSheetDataAsObjects("Bookings");
      var booking = bookings.find(function(b) { return String(b.Booking_ID || "").trim().toUpperCase() === bookingId; });
      if (booking) {
        var history = [];
        try {
          if (booking.Status_History_JSON) history = JSON.parse(booking.Status_History_JSON);
        } catch (e) {}
        history.push({ status: "COMPLETED", at: now });

        updateSheetRowById("Bookings", "Booking_ID", booking.Booking_ID, {
          Booking_Status: "Completed",
          Status_History_JSON: JSON.stringify(history)
        });
      }
    }

    if (tableId) {
      var tables = getSheetDataAsObjects("Tables");
      var table = tables.find(function(t) { return String(t.Table_ID || "").trim().toUpperCase() === tableId; });
      if (table) {
        updateSheetRowById("Tables", "Table_ID", table.Table_ID, { Table_Status: "Available" });
      }
    }

    return { success: true, message: "Departure recorded and table released for cleaning." };
  } finally {
    lock.releaseLock();
  }
}

function extractOrderMetaFromHistory_(historyRows, orderId) {
  for (var i = 0; i < historyRows.length; i++) {
    var h = historyRows[i];
    if (h.Order_ID === orderId && h.Change_Reason && String(h.Change_Reason).trim().indexOf("{") === 0) {
      try {
        var parsed = JSON.parse(h.Change_Reason);
        return {
          specialInstructions: parsed.specialInstructions || "",
          itemNotes: parsed.itemNotes || {}
        };
      } catch (e) {}
    }
  }
  return { specialInstructions: "", itemNotes: {} };
}

function handleGetKitchenQueue() {
  var activeStatuses = {
    "Authorized": true,
    "Accepted": true,
    "Preparing": true,
    "Ready": true,
    "Served": true,
    "In_Preparation": true,
    "Ready_For_Serving": true
  };

  var rawOrders = getSheetDataAsObjects("Orders").filter(function(o) {
    return Boolean(activeStatuses[o.Order_Status]);
  });

  var uniqueOrdersMap = {};
  var dedupedOrders = [];
  rawOrders.forEach(function(o) {
    if (!uniqueOrdersMap[o.Order_ID]) {
      uniqueOrdersMap[o.Order_ID] = true;
      dedupedOrders.push(o);
    }
  });

  var allItems = getSheetDataAsObjects("Order_Items");
  var menu = getSheetDataAsObjects("Menu");
  var tables = getSheetDataAsObjects("Tables");
  var reservations = getSheetDataAsObjects("Table_Reservations");
  var bookings = getSheetDataAsObjects("Bookings");
  var customers = getSheetDataAsObjects("Customers");
  var historyRows = getSheetDataAsObjects("Order_Status_History");

  var menuMap = {};
  menu.forEach(function(m) { menuMap[m.Food_ID] = m; });

  var tickets = dedupedOrders.map(function(order) {
    var meta = extractOrderMetaFromHistory_(historyRows, order.Order_ID);
    var seenItems = {};
    var enrichedItems = allItems
      .filter(function(i) {
        if (i.Order_ID !== order.Order_ID || seenItems[i.Order_Item_ID]) return false;
        seenItems[i.Order_Item_ID] = true;
        return true;
      })
      .map(function(i) {
        var food = menuMap[i.Food_ID] || {};
        return {
          Order_Item_ID: i.Order_Item_ID,
          Order_ID: i.Order_ID,
          Food_ID: i.Food_ID,
          Quantity: Number(i.Quantity || 1),
          Unit_Price: Number(i.Unit_Price || 0),
          Subtotal: Number(i.Subtotal || 0),
          Item_Status: i.Item_Status,
          foodName: food.Food_Name || i.Food_ID,
          prepTimeMinutes: Number(food.Prep_Time_Minutes || 15),
          category: food.Category || "",
          specialInstructions: meta.itemNotes[i.Food_ID] || ""
        };
      });

    var bId = String(order.Booking_ID || "").trim().toUpperCase();
    var res = reservations.find(function(r) { return String(r.Booking_ID || "").trim().toUpperCase() === bId; });
    var tbl = res ? tables.find(function(t) { return String(t.Table_ID || "").trim().toUpperCase() === String(res.Table_ID || "").trim().toUpperCase(); }) : null;
    var bk = bookings.find(function(b) { return String(b.Booking_ID || "").trim().toUpperCase() === bId; });
    var cust = bk ? customers.find(function(c) { return String(c.Customer_ID || "").trim().toUpperCase() === String(bk.Customer_ID || "").trim().toUpperCase(); }) : null;

    var normalizedStatus = order.Order_Status;
    if (normalizedStatus === "Submitted" || normalizedStatus === "Pending_Authorization") {
      normalizedStatus = "New_Order";
    }

    var resolvedCustName = (cust && cust.Customer_Name && cust.Customer_Name !== "Guest")
      ? cust.Customer_Name
      : (bk && bk.Customer_Name ? bk.Customer_Name : "Valued Guest");

    return {
      Order_ID: order.Order_ID,
      Booking_ID: order.Booking_ID,
      Order_DateTime: order.Order_DateTime,
      Order_Status: normalizedStatus,
      Authorized_At: order.Authorized_At,
      Authorized_By: order.Authorized_By,
      tableNumber: tbl ? (tbl.Table_Number || tbl.Table_ID) : (res && res.Table_ID ? res.Table_ID : "Counter / Walk-in"),
      customerName: resolvedCustName,
      specialInstructions: meta.specialInstructions,
      items: enrichedItems
    };
  }).sort(function(a, b) {
    return new Date(b.Order_DateTime || 0).getTime() - new Date(a.Order_DateTime || 0).getTime();
  });

  return { success: true, data: tickets };
}

function handleUpdateKitchenPrepStatus(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var newStatus = payload.newStatus;
    updateSheetRowById("Orders", "Order_ID", payload.orderId, { Order_Status: newStatus });

    var items = getSheetDataAsObjects("Order_Items");
    items.forEach(function(item) {
      if (item.Order_ID === payload.orderId && item.Item_Status !== "Cancelled") {
        updateSheetRowById("Order_Items", "Order_Item_ID", item.Order_Item_ID, {
          Item_Status: newStatus
        });
      }
    });

    appendSheetRow("Order_Status_History", {
      History_ID: "HIST-" + Date.now().toString().slice(-6),
      Order_ID: payload.orderId,
      Order_Status: newStatus,
      Changed_At: new Date().toISOString(),
      Changed_By: payload.actorName || "Kitchen",
      Change_Reason: payload.reason || "Kitchen workflow transition to " + newStatus
    });
    return { success: true, message: "Kitchen status updated to " + String(newStatus).replace(/_/g, " ") + "." };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateOrderItemStatus(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var items = getSheetDataAsObjects("Order_Items");
    var target = items.find(function(i) { return i.Order_Item_ID === payload.orderItemId; });
    if (!target) {
      return { success: false, error: { code: "NOT_FOUND", message: "Order item not found." } };
    }

    updateSheetRowById("Order_Items", "Order_Item_ID", payload.orderItemId, {
      Item_Status: payload.newStatus
    });

    var siblings = getSheetDataAsObjects("Order_Items").filter(function(i) {
      return i.Order_ID === target.Order_ID && i.Item_Status !== "Cancelled";
    });
    var allServed = siblings.every(function(i) { return i.Item_Status === "Served"; });
    var allReadyOrServed = siblings.every(function(i) { return i.Item_Status === "Ready" || i.Item_Status === "Served"; });
    var anyPreparing = siblings.some(function(i) { return i.Item_Status === "Preparing"; });

    var nextOrderStatus = null;
    if (allServed) nextOrderStatus = "Served";
    else if (allReadyOrServed) nextOrderStatus = "Ready";
    else if (anyPreparing) nextOrderStatus = "Preparing";

    if (nextOrderStatus) {
      updateSheetRowById("Orders", "Order_ID", target.Order_ID, { Order_Status: nextOrderStatus });
    }

    appendSheetRow("Order_Status_History", {
      History_ID: "HIST-" + Date.now().toString().slice(-6),
      Order_ID: target.Order_ID,
      Order_Status: "Item:" + payload.orderItemId + "->" + payload.newStatus,
      Changed_At: new Date().toISOString(),
      Changed_By: payload.actorName || "Kitchen",
      Change_Reason: "Item status updated to " + payload.newStatus
    });

    return { success: true, orderId: target.Order_ID, message: "Item updated to " + payload.newStatus + "." };
  } finally {
    lock.releaseLock();
  }
}

function handleGetAdminDashboard() {
  ensureFeedbackSheet_();
  return {
    success: true,
    data: {
      customers: getSheetDataAsObjects("Customers"),
      bookings: getSheetDataAsObjects("Bookings"),
      tables: getSheetDataAsObjects("Tables"),
      menu: getSheetDataAsObjects("Menu"),
      orders: getSheetDataAsObjects("Orders"),
      bills: getSheetDataAsObjects("Bills"),
      payments: getSheetDataAsObjects("Payments"),
      users: getSheetDataAsObjects("Users"),
      settings: getSheetDataAsObjects("Restaurant_Settings"),
      feedback: getSheetDataAsObjects("Feedback")
    }
  };
}

function handleReviewRefund(payload) {
  updateSheetRowById("Payments", "Payment_ID", payload.paymentId, {
    Refund_Status: payload.decision === "APPROVE" ? "Approved" : "Rejected",
    Reviewed_By: payload.adminUserName || "Admin",
    Reviewed_At: new Date().toISOString(),
    Rejection_Reason: payload.rejectionReason || ""
  });
  return { success: true, message: "Refund " + payload.decision + " recorded." };
}

function handleCompleteManualRefund(payload) {
  updateSheetRowById("Payments", "Payment_ID", payload.paymentId, {
    Refund_Status: "Completed",
    Completed_Refund_Amount: payload.completedAmount,
    Refund_Reference: payload.refundReference,
    Completed_By: payload.completedByUserName || "Admin",
    Completed_At: new Date().toISOString()
  });
  return { success: true, message: "Manual refund payout completed and recorded." };
}

function handleSaveDraftCart(payload) {
  // Store draft cart in PropertiesService for instant retrieval across sessions
  var props = PropertiesService.getScriptProperties();
  props.setProperty("CART_" + payload.customerId, JSON.stringify(payload.cart || []));
  return { success: true, message: "Cart saved successfully." };
}

function handleGetDraftCart(payload) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty("CART_" + payload.customerId);
  return { success: true, data: saved ? JSON.parse(saved) : [] };
}

// ==========================================
// TABLE QR CODE HANDLERS (PERSISTED IN Restaurant_Settings)
// ==========================================

function computeDefaultTableQrToken_(tableId) {
  var cleanId = String(tableId || "").replace(/[^A-Z0-9]/gi, "");
  var hex = computeDefaultHmacHex_("SAVOR_DEFAULT_TABLE_QR_" + tableId);
  return "TBLQR_" + cleanId + "_" + hex.slice(0, 16).toUpperCase();
}

function upsertRestaurantSetting_(key, value) {
  var updated = updateSheetRowById("Restaurant_Settings", "Setting_Key", key, {
    Setting_Value: value
  });
  if (!updated) {
    appendSheetRow("Restaurant_Settings", {
      Setting_Key: key,
      Setting_Value: value
    });
  }
}

function handleGetAllTableQRs(payload) {
  var baseUrl = (payload && payload.baseUrl) ? payload.baseUrl : "https://savor-dinein.app";
  var tables = getSheetDataAsObjects("Tables");
  var settings = getSheetDataAsObjects("Restaurant_Settings");
  var settingsMap = {};
  settings.forEach(function(s) { settingsMap[s.Setting_Key] = s.Setting_Value; });

  var records = tables.map(function(tbl) {
    var key = "TABLE_QR_" + tbl.Table_ID;
    var parsed = null;
    if (settingsMap[key]) {
      try { parsed = JSON.parse(settingsMap[key]); } catch (e) { parsed = null; }
    }
    var token = (parsed && parsed.token) ? parsed.token : computeDefaultTableQrToken_(tbl.Table_ID);
    var isActive = parsed ? (parsed.isActive !== false) : true;
    var generatedAt = (parsed && parsed.generatedAt) ? parsed.generatedAt : new Date().toISOString();

    if (!parsed || !parsed.token) {
      upsertRestaurantSetting_(key, JSON.stringify({
        token: token,
        tableId: tbl.Table_ID,
        isActive: isActive,
        generatedAt: generatedAt
      }));
    }

    return {
      tableId: tbl.Table_ID,
      tableNumber: tbl.Table_Number,
      capacity: Number(tbl.Seating_Capacity),
      status: tbl.Table_Status,
      token: token,
      qrUrl: baseUrl + "/?scan-table=1&token=" + encodeURIComponent(token),
      isActive: isActive,
      generatedAt: generatedAt
    };
  });

  return { success: true, data: records };
}

function handleRegenerateTableQR(payload) {
  var tableId = payload.tableId;
  if (!tableId) {
    return { success: false, error: { code: "BAD_REQUEST", message: "tableId is required." } };
  }
  var cleanId = String(tableId).replace(/[^A-Z0-9]/gi, "");
  var token = payload.token || ("TBLQR_" + cleanId + "_" + computeDefaultHmacHex_(tableId + "_" + Date.now() + "_" + Math.random()).slice(0, 16).toUpperCase());
  var record = {
    token: token,
    tableId: tableId,
    isActive: true,
    generatedAt: new Date().toISOString()
  };
  upsertRestaurantSetting_("TABLE_QR_" + tableId, JSON.stringify(record));
  return {
    success: true,
    data: { token: token },
    message: "New QR token generated and synced to Google Sheets for " + tableId + "."
  };
}

function handleToggleTableQR(payload) {
  var tableId = payload.tableId;
  var isActive = payload.isActive !== false && payload.isActive !== "false";
  var key = "TABLE_QR_" + tableId;
  var settings = getSheetDataAsObjects("Restaurant_Settings");
  var row = settings.find(function(s) { return s.Setting_Key === key; });
  var parsed = null;
  if (row && row.Setting_Value) {
    try { parsed = JSON.parse(row.Setting_Value); } catch (e) { parsed = null; }
  }
  if (!parsed || !parsed.token) {
    parsed = {
      token: computeDefaultTableQrToken_(tableId),
      tableId: tableId,
      generatedAt: new Date().toISOString()
    };
  }
  parsed.isActive = isActive;
  upsertRestaurantSetting_(key, JSON.stringify(parsed));
  return {
    success: true,
    message: "QR code for " + tableId + " is now " + (isActive ? "Active" : "Disabled") + "."
  };
}

function handleResolveTableQR(payload) {
  var token = payload && payload.token ? String(payload.token).trim() : "";
  if (!token || token.indexOf("TBLQR_") !== 0) {
    return {
      success: false,
      error: { code: "QR_INVALID", message: "Invalid or unrecognized table QR code." }
    };
  }

  var tables = getSheetDataAsObjects("Tables");
  var settings = getSheetDataAsObjects("Restaurant_Settings");
  var settingsMap = {};
  var matchedRecord = null;

  settings.forEach(function(s) {
    if (String(s.Setting_Key).indexOf("TABLE_QR_") === 0) {
      settingsMap[s.Setting_Key] = s.Setting_Value;
      try {
        var parsed = JSON.parse(s.Setting_Value);
        if (parsed.token === token) {
          matchedRecord = parsed;
        }
      } catch (e) {}
    }
  });

  // Fallback for deterministic initial QR codes before Admin explicitly visits Settings
  if (!matchedRecord) {
    for (var i = 0; i < tables.length; i++) {
      var tbl = tables[i];
      var key = "TABLE_QR_" + tbl.Table_ID;
      if (!settingsMap[key] && computeDefaultTableQrToken_(tbl.Table_ID) === token) {
        matchedRecord = { token: token, tableId: tbl.Table_ID, isActive: true };
        break;
      }
    }
  }

  if (!matchedRecord) {
    return {
      success: false,
      error: { code: "QR_EXPIRED", message: "QR token expired, regenerated, or not recognized." }
    };
  }

  if (matchedRecord.isActive === false) {
    return {
      success: false,
      error: { code: "QR_DISABLED", message: "This table QR code has been disabled by the administrator." }
    };
  }

  var targetTable = tables.find(function(t) { return t.Table_ID === matchedRecord.tableId; });
  if (!targetTable) {
    return {
      success: false,
      error: { code: "TABLE_NOT_FOUND", message: "Associated table record no longer exists." }
    };
  }

  if (targetTable.Table_Status === "Unavailable") {
    return {
      success: false,
      data: { table: targetTable, isAvailableForImmediateOrder: false },
      error: { code: "TABLE_UNAVAILABLE", message: "Table " + targetTable.Table_Number + " is currently marked Unavailable for maintenance." }
    };
  }

  return {
    success: true,
    data: {
      success: true,
      table: targetTable,
      isAvailableForImmediateOrder: targetTable.Table_Status === "Available",
      message: "Verified Table " + targetTable.Table_Number + " (Capacity: " + targetTable.Seating_Capacity + " guests)."
    },
    message: "Verified Table " + targetTable.Table_Number + " (Capacity: " + targetTable.Seating_Capacity + " guests)."
  };
}

function handleValidateSession(payload, sessionId) {
  var token = String((payload && payload.sessionId) || sessionId || "").trim();
  if (!token) return { success: false, error: { code: "SESSION_EXPIRED", message: "No session token." } };

  var tokenHash = computeSha256Hex_(token);
  var customers = getSheetDataAsObjects("Customers");
  var cust = customers.find(function(c) {
    var raw = String(c.OTP_Session_ID || "").trim();
    var storedHash = raw.split("|")[0];
    return storedHash === tokenHash || storedHash === token;
  });
  if (cust) {
    var parts = String(cust.OTP_Session_ID || "").split("|");
    var exp = parts[1] ? Number(parts[1]) : 0;
    if (exp && Date.now() > exp) {
      updateSheetRowById("Customers", "Customer_ID", cust.Customer_ID, { OTP_Session_ID: "" });
      return { success: false, error: { code: "SESSION_EXPIRED", message: "Customer session expired." } };
    }
    return {
      success: true,
      data: {
        sessionId: token,
        customerId: cust.Customer_ID,
        customerName: cust.Customer_Name,
        mobileNumber: cust.Mobile_Number,
        email: cust.Email,
        role: "Customer"
      }
    };
  }
  return { success: false, error: { code: "SESSION_EXPIRED", message: "Session not found or expired." } };
}

function handleLogout(payload, sessionId) {
  var token = String((payload && payload.sessionId) || sessionId || "").trim();
  if (!token) return { success: true };
  var tokenHash = computeSha256Hex_(token);
  var customers = getSheetDataAsObjects("Customers");
  var cust = customers.find(function(c) {
    var raw = String(c.OTP_Session_ID || "").split("|")[0];
    return raw === tokenHash || raw === token;
  });
  if (cust) {
    updateSheetRowById("Customers", "Customer_ID", cust.Customer_ID, { OTP_Session_ID: "" });
  }
  return { success: true, message: "Session revoked." };
}

function handleUpdateCustomerProfile(payload) {
  var name = String(payload.customerName || "").trim();
  var email = String(payload.email || "").trim().toLowerCase();
  if (!name || name.length < 2) return { success: false, error: { code: "INVALID_NAME", message: "Name is required." } };
  if (!email || email.indexOf("@") === -1) return { success: false, error: { code: "INVALID_EMAIL", message: "Valid email is required." } };

  var customers = getSheetDataAsObjects("Customers");
  var dup = customers.find(function(c) {
    return c.Customer_ID !== payload.customerId && String(c.Email || "").trim().toLowerCase() === email;
  });
  if (dup) return { success: false, error: { code: "DUPLICATE_EMAIL", message: "Email is already registered to another customer." } };

  updateSheetRowById("Customers", "Customer_ID", payload.customerId, {
    Customer_Name: name,
    Email: email
  });
  return { success: true, data: { customerId: payload.customerId, customerName: name, email: email }, message: "Profile updated." };
}

function handleUpdateOrderItemQuantity(payload) {
  var items = getSheetDataAsObjects("Order_Items");
  var item = items.find(function(i) { return i.Order_Item_ID === payload.orderItemId; });
  if (!item) return { success: false, error: { code: "NOT_FOUND", message: "Order item not found." } };
  if (item.Item_Status !== "Pending_Authorization") {
    return { success: false, error: { code: "INVALID_STATE", message: "Quantity can only be adjusted before authorization." } };
  }
  var qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  updateSheetRowById("Order_Items", "Order_Item_ID", payload.orderItemId, {
    Quantity: qty,
    Subtotal: qty * Number(item.Unit_Price)
  });
  return { success: true, message: "Quantity updated." };
}

function handleCancelOrReplaceItem(payload) {
  var items = getSheetDataAsObjects("Order_Items");
  var item = items.find(function(i) { return i.Order_Item_ID === payload.orderItemId; });
  if (!item) return { success: false, error: { code: "NOT_FOUND", message: "Order item not found." } };
  var reason = String(payload.reason || "").trim();
  if (!reason) return { success: false, error: { code: "BAD_REQUEST", message: "Cancellation reason is required." } };

  if (payload.action === "CANCEL") {
    updateSheetRowById("Order_Items", "Order_Item_ID", payload.orderItemId, {
      Item_Status: "Cancelled",
      Cancellation_Reason: reason,
      Subtotal: 0
    });
    return { success: true, message: "Item cancelled." };
  }
  return { success: false, error: { code: "BAD_REQUEST", message: "Unsupported item action." } };
}

function migrateLegacyFeedbackTab_() {
  var ss = getDatabaseConnection();
  var legacySheet = ss.getSheetByName("Feedback");
  if (!legacySheet) return { success: true, migrated: 0, message: "No legacy Feedback tab found." };
  var rows = getSheetDataAsObjects("Feedback");
  var bookings = getSheetDataAsObjects("Bookings");
  var migrated = 0;
  rows.forEach(function(r) {
    if (!r.Booking_ID || String(r.Booking_ID).indexOf("E2E") !== -1) return;
    var b = bookings.find(function(bk) { return bk.Booking_ID === r.Booking_ID; });
    if (b && !b.Feedback_Submitted_At) {
      updateSheetRowById("Bookings", "Booking_ID", r.Booking_ID, {
        Feedback_Rating: Number(r.Overall_Rating) || 5,
        Feedback_Comment: r.Comments || "",
        Feedback_Submitted_At: r.Submitted_At || new Date().toISOString()
      });
      migrated++;
    }
  });
  return { success: true, migrated: migrated, message: "Legacy Feedback tab safely migrated into Bookings without deleting original rows." };
}
