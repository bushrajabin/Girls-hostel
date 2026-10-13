# Girls Hostel Management System (React + Supabase)

Complaints, food feedback aur suggestions ko digital banane wala web app.

**Stack:** React (Vite) + React Router • Supabase (PostgreSQL + Login + Security + Live updates)

## Folder structure
```
schema.sql                 Database tables + security rules (Supabase me ek baar run karna hai)
.env.example               Supabase keys ka template
public/_redirects          Netlify routing (/admin ke liye zaroori)
vercel.json                Vercel routing
src/
  main.jsx, App.jsx        Entry + routes ( /  = student,  /admin = warden )
  supabaseClient.js        Supabase connection
  context/AuthContext.jsx  Login session + profile (role)
  constants.js, utils.js   Categories, date helpers, CSV export
  components/              Toast, shared UI
  components/student/      ComplaintForm, MyComplaints, FoodFeedback, Suggestions
  components/admin/        ComplaintsAdmin, FoodAdmin, SuggestionsAdmin
  pages/                   StudentApp.jsx, AdminApp.jsx
  styles.css               Design
```

## Setup

### 1. Supabase
1. https://supabase.com par free project banayein (region: Mumbai).
2. **SQL Editor -> New query** me `schema.sql` paste karke **Run** karein.
3. **Authentication -> Providers -> Email** me **"Confirm email"** OFF karein.
4. **Project Settings -> API** se *Project URL* aur *anon public key* copy karein.

### 2. Local run (Node.js 18+ chahiye)
```bash
npm install
cp .env.example .env      # phir .env me apni URL aur key daalein
npm run dev               # http://localhost:5173
```

### 3. Pehla Admin (Warden)
1. App me warden ke email se **New Registration** karein.
2. Supabase **SQL Editor** me chalayein:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'warden@example.com');
```
3. `/admin` par login karein. Caretaker ke liye bhi yahi process.

## Deploy (live karna)

### Option A: Netlify Drop (sabse aasaan)
```bash
npm run build             # dist/ folder banega (.env ki keys build me jud jaati hain)
```
https://app.netlify.com/drop par **`dist` folder** drag & drop karein. Link mil jayega:
student `https://xyz.netlify.app/`, admin `https://xyz.netlify.app/admin`.

### Option B: Vercel / Netlify with GitHub
1. Code GitHub par push karein (`.env` push nahi hota, `.gitignore` me hai).
2. Vercel/Netlify me repo import karein.
3. **Environment Variables** me `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` add karein.
4. Build command `npm run build`, output folder `dist`.

## Data safety
- Kisi table par **DELETE permission nahi** hai, isliye history permanent rehti hai.
- Students sirf apna data dekh sakti hain; sirf admin sab dekh sakta hai aur status badal sakta hai.
- Anon key public hoti hai, asli security database ke RLS rules se aati hai.
- Admin panel me har tab se **CSV export** hai; mahine ke end me backup le lein.

## Customize
- Complaint categories: `src/constants.js`
- Colors: `src/styles.css` ke upar `:root`
