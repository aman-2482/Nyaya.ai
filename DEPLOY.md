# 🚀 Deployment Guide for NyayaAI

This project is split into two parts:
1. **Backend** (FastAPI) → Deploy to **Render**
2. **Frontend** (React + Vite) → Deploy to **Vercel**

---

## ✅ Phase 1: Prepare & Push to GitHub

1. Ensure your project is initialized as a Git repository.
2. Create a `.gitignore` if you haven't (ignore `venv`, `node_modules`, `.env`, `__pycache__`).
3. Commit and push your code to a generic GitHub repository.
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

---

## 🛠 Phase 2: Deploy Backend to Render

1. **Sign Up / Login** to [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. **Connect your GitHub repository**.
4. Render will automatically detect the `render.yaml` file in your backend folder.
   - If it doesn't, choose **"Build and deploy from a Git repository"** manually.
5. **Configure Settings** (if asking manually):
   - **Name**: `nyayaai-backend`
   - **Root Directory**: `backend` (Important!)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. **Environment Variables**:
   Under the **Environment** tab, add:
   - `OPENROUTER_API_KEY`: `your_actual_api_key_here`
   - `PYTHON_VERSION`: `3.11.0` (Recommended)
7. Click **Create Web Service**.
8. **Wait for deployment**. Once live, copy your **Backend URL** (e.g., `https://nyayaai-backend.onrender.com`).

---

## 🎨 Phase 3: Deploy Frontend to Vercel

1. **Sign Up / Login** to [Vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. **Import your GitHub repository**.
4. **Configure Project**:
   - **Framework Preset**: Vite (should be auto-detected)
   - **Root Directory**: Click "Edit" and select `frontend`.
5. **Build & Output Settings** (Auto-detected):
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. **Environment Variables**:
   Expand the "Environment Variables" section and add:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render Backend URL **(without trailing slash)**
     - Example: `https://nyayaai-backend.onrender.com`
     - *Note: Do NOT add `/api` at the end.*
7. Click **Deploy**.

---

## 🔍 Phase 4: Verify & Launch

1. Once Vercel finishes, click on the **Domain** link provided (e.g., `https://nyayaai.vercel.app`).
2. The app should load.
3. Try asking a question.
   - If it works: 🎉 Success!
   - If it fails (network error):
     - Check the **Console** (F12) for CORS errors.
     - Ensure your `VITE_API_URL` in Vercel is correct (no slash at end).
     - Ensure Backend is active on Render (free tier spins down after inactivity, so the first request might take 50s).

### 💡 Troubleshooting
- **Backend sleeping?** Render Free Tier spins down after 15 mins. The first request will take ~50 seconds to wake it up. This is normal.
- **CORS Error?** The backend is configured to allow `*` (all origins). If you see CORS issues, ensure you are using `VITE_API_URL` correctly so requests go to the full HTTPS URL.
