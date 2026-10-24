Girls Hostel Management System (React + Supabase)
A web application that digitizes complaints, food feedback, and suggestions in a girls' hostel.

Tech Stack: React (Vite) + React Router • Supabase (PostgreSQL + Authentication + Security + Real-time Updates)

## Folder structure
```
schema.sql                 Database tables + security rules
.env.example               Template for Supabase keys
public/_redirects          Netlify routing (/admin required)
vercel.json                Vercel routing configuration
src/
  main.jsx, App.jsx        Entry point + routes (/ = student, /admin = warden)
  supabaseClient.js        Supabase connection
  context/AuthContext.jsx  Login session + profile (role)
  constants.js, utils.js   Categories, date helpers, CSV export
  components/              Toast notifications, shared UI
  components/student/      ComplaintForm, MyComplaints, FoodFeedback, Suggestions
  components/admin/        ComplaintsAdmin, FoodAdmin, SuggestionsAdmin
  pages/                   StudentApp.jsx, AdminApp.jsx
  styles.css               Application design
```

## Setup

***Setup Instructions***
1. Set Up Supabase
1. Create a free project at Supabase. Select the Mumbai region.
2. Open SQL Editor → New Query, paste the contents of schema.sql, and click Run.
3. Go to Authentication → Providers → Email and turn off Confirm email.
4. Open Project Settings → API and copy your Project URL and anon public key.

### 2. Local run (Node.js 18+ chahiye)
```bash
npm install
cp .env.example .env     
npm run dev               # http://localhost:5173
```

