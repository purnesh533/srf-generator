# SRF Generator (MERN)

This project collects candidate details from a React form and generates:
- A PDF (Selection Recommendation Form style)
- An Excel file (same columns as provided sample)
- A master Excel file that is created once and appended for each new entry

## Backend setup

```bash
cd server
npm install
# Windows (PowerShell)
Copy-Item .env.example .env
# macOS/Linux
# cp .env.example .env
npm run dev
```

## Frontend setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

Data is stored in **MongoDB Atlas**. Set `MONGODB_URI` in `server/.env` (see `.env.example`).

Generated files are stored in:
- `server/generated/pdf` for individual PDFs
- `server/generated/excel` for individual Excels
- `server/generated/SRF_Master.xlsx` for cumulative records

All individual filenames use `employeeCode` as prefix, for example:
- `EMP001_SRF.pdf`
- `EMP001_SRF.xlsx`

`employeeCode` is treated as a unique key and duplicate entries are blocked.

## Deploy (Netlify + Render)

Both **local** and **production** must use the **same** `MONGODB_URI` or user/SRF counts will differ.

### Render (API)

In the Render dashboard → **Environment**, set:

| Variable | Value |
|----------|--------|
| `MONGODB_URI` | Same Atlas URI as local (`...mongodb.net/srf?...`) |
| `CLIENT_ORIGIN` | `https://srf-rsystems.netlify.app` |
| `APP_BASE_URL` | `https://srf-rsystems.netlify.app` |
| `JWT_SECRET` | Strong random string |
| `RESEND_API_KEY` / `RESEND_FROM` | Email settings |

Redeploy after saving.

### Netlify (frontend)

Set `VITE_API_URL` to your Render API URL, e.g. `https://srf-api.onrender.com/api`.

## API

- `POST /api/srf` create a candidate SRF record
- `GET /api/srf/:id/pdf` download SRF PDF
- `GET /api/srf/:id/excel` download SRF Excel
- `GET /api/srf/master-excel` download the master cumulative Excel
