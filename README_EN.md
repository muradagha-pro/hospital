# Hospital Call Request System — Complete User Guide

## System Overview

This is a comprehensive hospital management system that enables patients to request nursing assistance, allows nurses to manage requests efficiently, provides administrators with real-time analytics, and includes a cafeteria ordering system.

---

## Core Pages & Processes

### 1. **Patient Page** (`patient.html?room=XXX`)

**Purpose:** Patient room interface for requesting nurse assistance

**Process:**
- Patient scans a QR code that includes their room number (e.g., `patient.html?room=204`)
- Page displays:
  - Room number
  - Automatic department detection based on room number
  - **Large call button** to summon the nurse
  - Real-time status indicator showing whether the request has been received and assigned to a nurse
  - Link to feedback/suggestions form

**Department Assignment:**
Departments are automatically determined by room number ranges (configured in `departments.js`):
- Emergency: Rooms 101–199
- Internal Medicine: Rooms 201–299
- Surgery: Rooms 301–399
- Pediatrics: Rooms 401–499
- OB/GYN: Rooms 501–599
- ICU: Rooms 601–699

---

### 2. **Nurse Station Page** (`nurse.html?dept=XXX`)

**Purpose:** Dedicated interface for nursing staff to receive and manage requests

**Process:**
1. Nurse scans the QR code for their department (e.g., `nurse.html?dept=internal`)
2. Enters their name (simple entry, no authentication)
3. Sees only requests for their assigned department
4. Features:
   - **Incoming alerts:** Audible bell + vibration (repeats until acknowledged)
   - **Request list:** Shows pending requests in real-time
   - **Accept/Complete actions:** Mark requests as received and completed
   - **Today's log tab:** All requests handled during the shift with:
     - Request details
     - Time stamps
     - Add/edit notes for each request
   - **Optional browser notifications** for new requests

**Status Workflow:**
- **Sent:** Initial request from patient
- **Received:** Nurse acknowledges the request
- **Done:** Request is completed

---

### 3. **Feedback Page** (`feedback.html?room=XXX`)

**Purpose:** Allow patients to submit complaints or suggestions

**Process:**
1. Patient's room is auto-detected from URL parameter
2. Patient selects feedback type (complaint or suggestion)
3. Enters title and message
4. Submits directly to administration
5. Visible in admin dashboard for review

---

### 4. **Admin Dashboard** (`admin.html`)

**Purpose:** Real-time analytics and performance monitoring for hospital administrators

**Process:**
1. Access via fixed URL (no authentication required in current version)
2. View options:
   - Toggle between "Today" and "Last 7 Days"
3. Display metrics:
   - **Summary cards:**
     - Total calls received
     - Completed requests
     - Pending requests
     - Average response time (hospital-wide)
   - **Department breakdown:**
     - Call count per department
     - Average response time per department
   - **Nurse notes log:**
     - All notes from all departments
     - Sorted by most recent first
     - Includes request details and timestamps
   - **Feedback section:**
     - All patient complaints and suggestions
     - Organized and displayed for administrative review

**Security Note:** Currently open without login. Before production deployment on a real hospital network, implement Firebase Authentication to restrict access.

---

### 5. **Department Management Page** (`admin-technic.html`)

**Purpose:** Configure hospital departments and room assignments

**Process:**
1. Access via fixed URL
2. Administrative functions:
   - **View departments:** See all currently configured departments
   - **Add department:** Create new department with:
     - Department name
     - Department code/ID
     - Room number range (from/to)
   - **Edit department:** Modify room ranges
   - **Delete department:** Remove departments
3. Automatic fallback: If no custom departments are configured, the system uses default departments from `departments.js`

---

### 6. **Cafeteria Product Management** (`cafeteria-products.html`)

**Purpose:** Admin interface to manage cafeteria menu items

**Process:**
1. Access the page to manage the cafeteria inventory
2. Add new products with:
   - Product name
   - Price
   - Description/category
3. Edit existing products
4. Remove products from menu
5. Changes immediately available for patient ordering

---

### 7. **Patient Cafeteria Order** (`cafeteria-order.html?room=XXX`)

**Purpose:** Allow patients to order food/items from the cafeteria

**Process:**
1. Patient scans QR code with their room number (e.g., `cafeteria-order.html?room=201`)
2. Browse available cafeteria products
3. Select items and quantities
4. Review order with:
   - Item details
   - Price breakdown
   - Total cost
5. Submit order
6. Redirected to order status tracking page (`cafeteria-order-status.html`)

---

### 8. **Cafeteria Order Status** (`cafeteria-order-status.html?room=XXX&orderId=XXX`)

**Purpose:** Real-time tracking of cafeteria orders for patients

**Process:**
1. Displays current order status with visual progress indicator
2. Shows status steps:
   - **Received:** Order registered in cafeteria system
   - **Preparing:** Kitchen is preparing the order
   - **Delivered:** Order ready/delivered to room
3. Displays:
   - Estimated preparation time
   - Time remaining for delivery
   - Order contents and breakdown
   - Total cost
4. Updates in real-time as cafeteria staff updates order status

---

### 9. **Cafeteria Management Page** (`cafeteria.html`)

**Purpose:** Cafeteria staff interface to manage and fulfill orders

**Process:**
1. Access dedicated URL for cafeteria staff
2. View incoming orders:
   - Patient room number
   - Order contents and details
   - Order placement timestamp
3. Update order status:
   - Mark as "Received" when order arrives in kitchen
   - Mark as "Preparing" while working on order
   - Mark as "Delivered" when ready/sent to room
4. Monitor order queue and fulfillment
5. Staff can prioritize and manage workflow efficiently

---

### 10. **Landing/Test Page** (`index.html`)

**Purpose:** Temporary landing page with test links (for development/testing only)

**Process:**
1. Displays links to test different pages:
   - Sample patient rooms (Internal Medicine)
   - Nurse station (Internal Medicine)
   - Cafeteria management
   - Admin dashboard
2. For production: Replace with direct QR code links or remove entirely

---

## How to Deploy & Use

### Step 1: Configure Firebase
- Set up Firebase project and Firestore database
- Add Firebase credentials to `firebase-config.js`
- Deploy hosting to Netlify or Firebase Hosting

### Step 2: Configure Departments
- Visit `admin-technic.html` to customize departments
- Or use default departments from `departments.js`:
  - Emergency: 101–199
  - Internal Medicine: 201–299
  - Surgery: 301–399
  - Pediatrics: 401–499
  - OB/GYN: 501–599
  - ICU: 601–699

### Step 3: Generate QR Codes

**For Patient Rooms:**
- Create QR codes for each room:
  ```
  https://your-site.netlify.app/patient.html?room=201
  https://your-site.netlify.app/patient.html?room=202
  ...etc
  ```

**For Nurse Stations:**
- One QR code per department:
  ```
  https://your-site.netlify.app/nurse.html?dept=emergency
  https://your-site.netlify.app/nurse.html?dept=internal
  https://your-site.netlify.app/nurse.html?dept=surgery
  https://your-site.netlify.app/nurse.html?dept=pediatrics
  https://your-site.netlify.app/nurse.html?dept=obgyn
  https://your-site.netlify.app/nurse.html?dept=icu
  ```

### Step 4: Cafeteria Setup
1. First, add products via `cafeteria-products.html`
2. Create QR codes for patients to order:
   ```
   https://your-site.netlify.app/cafeteria-order.html?room=201
   ```
3. Post `cafeteria.html` link at cafeteria station for order management

### Step 5: Secure Firestore Rules

Replace Firestore rules with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /callRequests/{requestId} {
      allow read: if true;
      allow create: if request.resource.data.status == "sent"
                    && request.resource.data.room is string
                    && request.resource.data.department is string;
      allow update: if request.resource.data.status in ["received", "done"]
                    || ("note" in request.resource.data);
      allow delete: if false;
    }
  }
}
```

### Step 6: Deploy Firestore Indexes

Use Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

Or follow Firebase's browser-provided link when you first load the pages.

---

## Security Recommendations

**Current Status:**
- Admin dashboard is currently open (no login required)
- This is acceptable for testing but NOT for production use

**Before Live Hospital Deployment:**
1. Implement Firebase Authentication for admin pages
2. Add role-based access control (restrict who can access admin features)
3. Enable HTTPS (automatic with Netlify/Firebase Hosting)
4. Review and test Firestore security rules
5. Implement audit logging for admin actions

---

## Future Enhancements

1. **Authentication:** Add Firebase Authentication to admin pages
2. **Role-based access:** Define permissions for different staff roles
3. **Auto-escalation:** Automatic alerts if requests aren't acknowledged within a set time
4. **Performance analytics:** Enhanced reporting and trends analysis
5. **Multi-language support:** Expand beyond Arabic and English

---

## Support

For questions about specific pages or functionality, refer to the individual page descriptions above. Each page has a clear process flow and purpose.

**Good luck with your hospital system deployment!** If you need additional features or modifications, let me know.
