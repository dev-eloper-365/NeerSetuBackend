# How to Import Postman Collection

## Quick Import Steps

1. **Open Postman**
2. **Click "Import"** button (top left)
3. **Select "File"** tab
4. **Choose** `INGRES_API.postman_collection.json` from the `backend/` directory
5. **Click "Import"**

## Collection Contents

The collection includes 7 pre-configured requests:

### 1. **Chat Stream - Basic Query** ⭐ (Start here!)
   - Tests basic streaming functionality
   - Query: "What is the groundwater status in Karnataka?"
   - Just click "Send" to test!

### 2. **Chat Stream - Compare States**
   - Compares two states
   - Query: "Compare groundwater extraction rates between Gujarat and Rajasthan"

### 3. **Chat Stream - Top Locations**
   - Gets rankings
   - Query: "Which states have the highest groundwater extraction rates?"

### 4. **Chat Stream - With History**
   - Includes chat history context
   - Shows how to maintain conversation context

### 5. **Chat Stream - Hindi Language**
   - Tests multi-language support
   - Query in Hindi: "कर्नाटक में भूजल की स्थिति क्या है?"

### 6. **Chat - Non-Streaming**
   - Non-streaming endpoint (`/api/gw-chat`)
   - Returns complete response at once

### 7. **Health Check**
   - Simple GET request to verify server is running

## Testing Tips

### For Streaming Endpoints:
- The response will show multiple `data:` lines
- Each line contains a JSON object with different types:
  - `{"type":"token","content":"..."}` - Text tokens
  - `{"type":"tool_call",...}` - Tool invocations
  - `{"type":"chart",...}` - Visualizations
  - `{"type":"done"}` - Stream complete

### Viewing Stream Response:
1. In Postman, you'll see the response appear line by line
2. Scroll down to see all the data chunks
3. Look for the `{"type":"done"}` message at the end

### Common Issues:

**500 Error:**
- Check that `GROQ_API_KEY` is set in `.env` file
- Restart the backend server after adding the key

**Connection Refused:**
- Make sure backend server is running: `npm run dev` in `backend/` directory
- Verify server is on port 3004

**No Response:**
- Check server logs for errors
- Verify database is running and accessible

## Quick Test

1. Import the collection
2. Click on **"Chat Stream - Basic Query"**
3. Click **"Send"**
4. Watch the streaming response appear!

That's it! 🚀

