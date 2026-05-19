# Setup and Testing Guide: St. Paul's ERP

This document outlines how to clone, run, configure, and step-by-step test the entire St. Paul's School ERP application locally from scratch.

---

## 1. Cloning the Application
To clone the repository and navigate into the project root:
```bash
git clone <your-repository-url>
cd stpauls_school
```

---

## 2. Running Frontend Locally

### Prerequisites
*   **Node.js**: Version 18 or 20 is recommended.
*   **Package Manager**: npm or yarn.

### Setup Steps
1.  Navigate to the `frontend` folder:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your local environment. Check that `.env` exists with the following configuration keys pointing to the school's Firebase instance and local backend port:
    ```env
    REACT_APP_FIREBASE_API_KEY=AIzaSyCBJCjdqOff2pOqfdFkbXg5sz2XwI3DD_w
    REACT_APP_FIREBASE_AUTH_DOMAIN=stpauls-erp.firebaseapp.com
    REACT_APP_FIREBASE_DATABASE_URL=https://stpauls-erp-default-rtdb.asia-southeast1.firebasedatabase.app
    REACT_APP_FIREBASE_PROJECT_ID=stpauls-erp
    REACT_APP_FIREBASE_STORAGE_BUCKET=stpauls-erp.firebasestorage.app
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=470826389136
    REACT_APP_FIREBASE_APP_ID=1:470826389136:web:6cca0d941a2c95a6425215
    REACT_APP_FIREBASE_MEASUREMENT_ID=G-04JLN2TQ8V
    REACT_APP_FIRESTORE_DATABASE_ID=
    REACT_APP_BACKEND_URL=http://localhost:8001
    REACT_APP_TENANT_ID=stpauls
    ```
4.  Start the development server:
    ```bash
    npm start
    ```
    This will serve the frontend at [http://localhost:3000](http://localhost:3000).

---

## 3. Running Backend Locally

### Prerequisites
*   **Python**: Version 3.10 or 3.11 is recommended.
*   **FastAPI / Uvicorn**: Runs the local API.

### Setup Steps
1.  Navigate to the `backend` folder:
    ```bash
    cd ../backend
    ```
2.  Create a Python virtual environment:
    ```bash
    python3 -m venv venv
    ```
3.  Activate the virtual environment:
    *   **macOS / Linux**:
        ```bash
        source venv/bin/activate
        ```
    *   **Windows**:
        ```cmd
        venv\Scripts\activate
        ```
5.  Install required packages:
    ```bash
    pip install -r requirements.txt
    ```
6.  Check your `.env` configuration file inside `backend/.env` for API keys (Fast2SMS, MSG91, Razorpay).
7.  Start the backend server:
    ```bash
    ./start_backend.sh
    ```
    *Or run manually via:*
    ```bash
    uvicorn server:app --reload --port 8001
    ```
    This will run the backend API server at [http://localhost:8001](http://localhost:8001) with interactive documentation available at [http://localhost:8001/docs](http://localhost:8001/docs).

---

## 4. Comprehensive Testing Plan (From Empty Database)

Since the database has been completely purged to 0 records, you must set up the baseline data in the following logical order to avoid validation errors:

### Step 1: Admin Log In
1.  Open the website at [http://localhost:3000](http://localhost:3000).
2.  Click **Login**, enter the Admin phone number: **`1234567890`**.
3.  Select role: **Admin** and click **Send OTP / Login** (In local dev mode, any 6-digit OTP will work).
4.  Verify you are redirected to the Admin Dashboard showing the "School Administrator" panel.

### Step 2: Set Up Academic Infrastructure (Prerequisites)
1.  In the Admin menu, go to **Academic** → **Classes & Subjects**.
2.  Click **Add Class** and enter `Class 10`.
3.  In the class details, add a subject (e.g. `Science`).
4.  *(Optional)* Go to **Hostel & Transport** → **Hostel Rooms** or **Transport Routes** and add a room (`303`, Floor 3, Block A) or route (`Route-10`, Fee ₹2000) for transport/hostel allocation checks.

### Step 3: Register a Staff Member
1.  In the Admin menu, go to **Employees** → **Add Employee**.
2.  Fill in the required information:
    *   **Full Name**: E.g. `Jane Doe`
    *   **Phone**: E.g. `9876543210` (must be unique and valid for SMS/Login)
    *   **Date of Birth**: E.g. `1990-05-15`
    *   **Address**: `123 School Lane`
    *   **Date of Joining**: `2026-05-19`
    *   **Employment Type**: `Permanent`
    *   **Role**: `Teacher`
    *   **Department**: `Science`
3.  Click **Save Employee**. 

### Step 4: Admit a Student
1.  In the Admin menu, go to **Students** → **Admission Form**.
2.  Verify the Step-by-Step validation works:
    *   **Step 1 (Personal)**: Try clicking Next without a name. It should fail. Fill out `John Smith`, DOB. Click Next.
    *   **Step 2 (Contact)**: Try clicking Next without a phone/address. It should fail. Fill out Address, Phone (`9998887776`). Click Next.
    *   **Step 3 (Parent)**: Fill out Father's name, phone, and Mother's name. Click Next.
    *   **Step 4 (Academic)**: Select the class you created (`Class 10`), section `A`, and select today's date for Admission Date. Click Next.
    *   **Step 5 (Boarding)**: Assign to the bus route or hostel room you created in Step 2.
3.  Submit the Admission Form. The student's admission number will be automatically generated (e.g., `STP1001`).

### Step 5: Staff Log In & Dashboard
1.  Log out of the Admin panel.
2.  Go to the Login page and enter the Staff phone number: **`9876543210`**.
3.  Select role: **Staff** and log in.
4.  Confirm the dashboard welcomes `Jane Doe` and loads the staff workspace.

### Step 6: Submit a Leave Request (Staff)
1.  In the Staff Dashboard, go to the **Leave** tab.
2.  Click **Apply for Leave**.
3.  Fill out the form (e.g. Leave Type: `Sick Leave`, Dates, Reason: `Medical Recovery`) and click **Submit**.
4.  The request should immediately show in the leave history as `PENDING`.

### Step 7: Admin Approval & Notifications (Real-Time check)
1.  Log out of the Staff panel and log back in as Admin (`1234567890`).
2.  Check the **Notification Bell** in the top right. You should see a notification: *"Leave Request: Jane Doe applied for Sick Leave..."*.
3.  Go to **Leave Management** in the Admin panel.
4.  Click **Approve** or **Reject** on Jane Doe's leave request.
5.  Without logging out, open a separate browser tab or window, log in as Staff (`9876543210`), and check the **Leave** tab. 
6.  Verify that the status of the leave has changed to **APPROVED** / **REJECTED** in real-time, and that a notification has arrived on the staff account.

### Step 8: Direct Messaging (Real-Time check)
1.  In the Admin tab, go to **Communication Center** → **Direct Messages**.
2.  Select `Jane Doe` from the staff list.
3.  Send a message: *"Hello Jane, your leave is approved."*.
4.  In the Staff tab, check the **Messages** panel.
5.  Verify the message appeared instantly without refreshing, and reply back: *"Thank you admin."*.
6.  Confirm the response updates instantly on the Admin panel.

### Step 9: Marks Entry & Validation (Staff)
1.  In the Staff tab, go to **Results** → **Marks Entry**.
2.  Select `Class 10` and the subject `Science`. (Note: Since the logged-in staff is assigned to the class and subject in the employee registry, they are authorized to manage these marks).
3.  The system should show the student `John Smith` you created in Step 4.
4.  Enter the marks (e.g. `85` out of `100`).
5.  Click **Save Marks**. Verify a success toast appears and the marks remain persistent upon reloading the page.
6.  *Boundary Check*: Try saving marks without selecting a subject. The application should block the save and display an error toast.

---

## 5. Testing Other Core ERP Modules

### 📚 Syllabus Tracker
1.  As Admin, go to **Academic** → **Syllabus Tracker**.
2.  Select `Class 10` and `Science`.
3.  Click **Add Topic** and enter:
    *   **Topic Name**: `Photosynthesis`
    *   **Description**: `Process of plants making food`
    *   **Target Date**: Select a future date
4.  Click **Save**.
5.  Log in as Staff (`9876543210`) and navigate to the **Syllabus** section.
6.  You should see `Photosynthesis` listed. Click the checkbox to mark it **Complete**.
7.  Check back in Admin. The topic should show as **Completed** in real-time with the completion date/timestamp correctly sorted.

### 📅 Timetable Management
1.  As Admin, go to **Academic** → **Timetable**.
2.  Select `Class 10`, Section `A`.
3.  Click **Edit Timetable**.
4.  For Monday, Period 1 (e.g. `09:00 - 09:45`), select `Science` from the dropdown and assign `Jane Doe` as the teacher.
5.  Click **Save Timetable**.
6.  Log in as Staff (`9876543210`) or Parent (`9998887776`), go to the **Timetable** tab, and confirm that the class schedule displays the correct slots.

### 💰 Fees & Financial Setup
1.  As Admin, go to **Finance** → **Fee Categories**.
2.  Click **Add Category** and create:
    *   `Tuition Fee` (Frequency: Monthly)
    *   `Term Fee` (Frequency: Termly)
3.  Go to **Class Fee Setup** and choose `Class 10`.
4.  Assign fee amounts to this class:
    *   `Tuition Fee`: `₹5,000`
    *   `Term Fee`: `₹2,500`
5.  Click **Save Fee Setup**.
6.  Go to **Collect Fees** and search for `John Smith` (`Class 10`).
7.  You should see the outstanding balance dynamically calculated as **₹7,500**.
8.  Click **Collect Payment**, select Payment Mode (e.g. `Cash` or `UPI`), enter amount `₹5,000`, and submit.
9.  Verify the balance decreases to **₹2,500** and a transaction receipt is generated in the transaction log.

### 📈 Expense Management
1.  As Admin, go to **Finance** → **Expenses**.
2.  Click **Add Expense** and enter:
    *   **Title**: `Science Lab Chemicals`
    *   **Category**: `Lab Maintenance`
    *   **Amount**: `₹1,200`
    *   **Date**: Select today
3.  Save the expense. Verify it updates the total expense statistics on the financial dashboard.

### 👥 Attendance Tracking
1.  As Staff (`9876543210`), go to the **Attendance** tab.
2.  Select `Class 10`, Section `A`, and today's date.
3.  The class list will display the student `John Smith`.
4.  Mark him **Present** or **Absent** and click **Submit Attendance**.
5.  Log in as Parent (`9998887776`), go to the **Attendance** tab, and verify that the student's attendance calendar reflects the status correctly.

### 🛏️ Hostel & Transport Allocation
1.  As Admin, go to **Hostel & Transport** → **Hostel Allocations**.
2.  Select `John Smith`, select Room `303` (Block A), and click **Allocate Room**.
3.  Go to **Hostel Rooms** and verify that Room `303` now shows `occupied: 1` out of `capacity: 4` (dynamically updated).

### 🧾 Staff Payroll
1.  As Admin, go to **Employees** → **Payroll**.
2.  Jane Doe should be listed. Click **Generate Salary Slip**.
3.  Specify base salary (e.g. `₹25,000`), allowances (e.g. `₹1,500`), deductions (e.g. `₹500`), and click **Issue Pay Slip**.
4.  Log in as Staff (`9876543210`), go to **Profile / Salary** tab, and verify that the pay slip is visible with the calculated net salary (`₹26,000`) and marked as **PAID**.
