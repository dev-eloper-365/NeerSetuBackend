# Render Deployment Guide

## Prerequisites
- Render account
- GitHub repository connected to Render

## Deployment Steps

### 1. Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Blueprint"
3. Connect your GitHub repository: `dev-eloper-365/NeerSetuBackend`

### 2. Configure Environment Variables
After deployment, add these secret environment variables in the Render dashboard:

**Required:**
- `GROQ_API_KEY` - Your Groq API key
- `GOOGLE_API_KEY` - Your Google Gemini API key

**Optional (for LangSmith tracing):**
- `LANGSMITH_API_KEY` - Your LangSmith API key

### 3. Database Setup
The `render.yaml` includes a PostgreSQL database service that will be automatically created.

After first deployment, run migrations:
```bash
# In Render Shell
pnpm db:push
pnpm db:seed
```

### 4. Health Check
The service includes a health check endpoint at `/api/health`

### 5. Monitoring
- Check logs in Render dashboard
- Monitor health check status
- Set up alerts for failures

## Important Notes

1. **Free Tier Limitations:**
   - Services spin down after 15 minutes of inactivity
   - First request after spin-down will be slow (cold start)
   - Database has 1GB storage limit

2. **ChromaDB:**
   - Currently configured for local ChromaDB
   - For production, consider using a hosted vector database
   - Or deploy ChromaDB as a separate service

3. **Environment Variables:**
   - Never commit API keys to the repository
   - Use Render's environment variable management
   - Mark sensitive variables as "secret"

## Troubleshooting

### Build Failures
- Check that all dependencies are in `package.json`
- Verify TypeScript compiles locally: `pnpm build`
- Check build logs in Render dashboard

### Runtime Errors
- Verify all environment variables are set
- Check database connection
- Review application logs

### Database Issues
- Ensure migrations have run
- Check database connection string
- Verify PostgreSQL service is running

## Useful Commands

```bash
# Local development
pnpm dev

# Build for production
pnpm build

# Run production build locally
pnpm start

# Database operations
pnpm db:generate  # Generate migrations
pnpm db:push      # Push schema changes
pnpm db:seed      # Seed data
```
