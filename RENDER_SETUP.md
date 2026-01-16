# Render Setup Instructions

## Current Issue
Your service is running but not using the `render.yaml` configuration. You need to either:
1. Delete the current service and redeploy using Blueprint (recommended)
2. Or manually update the existing service settings

## Option 1: Deploy with Blueprint (Recommended)

### Step 1: Delete Current Service
1. Go to your Render dashboard
2. Find the `groundwater-backend` service
3. Go to Settings → Delete Service

### Step 2: Create New Blueprint Deployment
1. Click "New +" → "Blueprint"
2. Connect your GitHub repository: `dev-eloper-365/NeerSetuBackend`
3. Render will automatically detect `render.yaml` and create:
   - PostgreSQL database (`groundwater-db`)
   - Web service (`groundwater-backend`)
   - All environment variables will be configured automatically

### Step 3: Add Secret Environment Variables
After deployment, go to the web service settings and add:
- `GROQ_API_KEY` = your_groq_api_key
- `GOOGLE_API_KEY` = your_google_api_key
- `LANGSMITH_API_KEY` = your_langsmith_api_key (optional)

### Step 4: Run Database Migrations
Once deployed, open the Shell for your web service and run:
```bash
node dist/index.js
# Wait for it to connect, then Ctrl+C
pnpm db:push
pnpm db:seed
```

---

## Option 2: Fix Existing Service Manually

If you want to keep the existing service, update these settings:

### In Web Service Settings:

**Build & Deploy:**
- Build Command: `pnpm install && pnpm build`
- Start Command: `node dist/index.js` (NOT `pnpm dev`)

**Environment Variables:**
You need to create a PostgreSQL database first, then add these:

1. Create PostgreSQL Database:
   - Click "New +" → "PostgreSQL"
   - Name: `groundwater-db`
   - Database Name: `ingres`
   - Plan: Free

2. After database is created, add these environment variables to your web service:
   ```
   NODE_ENV=production
   DATABASE_URL=[Copy from database Internal Connection String]
   POSTGRES_HOST=[Copy from database]
   POSTGRES_PORT=[Copy from database]
   POSTGRES_USER=[Copy from database]
   POSTGRES_PASSWORD=[Copy from database]
   POSTGRES_DB=ingres
   COLLECTION_NAME=ingres_groundwater
   CHROMA_URL=http://localhost:8000
   GROQ_API_KEY=[Your API key]
   GOOGLE_API_KEY=[Your API key]
   LANGSMITH_API_KEY=[Your API key - optional]
   LANGSMITH_TRACING=true
   LANGCHAIN_TRACING=true
   LANGCHAIN_TRACING_V2=true
   LANGSMITH_ENDPOINT=https://api.smith.langchain.com
   LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
   LANGSMITH_PROJECT=Workspace 1
   ```

3. Trigger a manual deploy

---

## Verification

After deployment, check:
1. Health endpoint: `https://your-service.onrender.com/api/health`
2. Logs should show:
   - "Server running on http://0.0.0.0:10000"
   - "Location search initialized successfully"
   - No connection errors

## Troubleshooting

**"ECONNREFUSED" errors:**
- Database isn't created or connected
- Check DATABASE_URL environment variable is set
- Verify database is in the same region as web service

**"pnpm dev" in logs:**
- Start command is wrong
- Should be: `node dist/index.js`
- NOT: `pnpm dev` or `pnpm start`

**Build fails:**
- Check that `pnpm build` works locally
- Verify all dependencies are in package.json
- Check build logs for TypeScript errors
