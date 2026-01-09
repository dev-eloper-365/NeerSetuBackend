# Postman Test Guide for `/api/gw-chat/stream`

## Setup

1. **Create `.env` file** in the `backend/` directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ingres
   PORT=3004
   ```

2. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

## Postman Configuration

### Request Setup

**Method:** `POST`  
**URL:** `http://localhost:3004/api/gw-chat/stream`

### Headers

```
Content-Type: application/json
```

### Body (raw JSON)

```json
{
  "query": "What is the groundwater status in Karnataka?",
  "language": "en",
  "chatHistory": []
}
```

### Example with Chat History

```json
{
  "query": "Tell me more about extraction rates",
  "language": "en",
  "chatHistory": [
    {
      "role": "user",
      "content": "What is the groundwater status in Karnataka?"
    },
    {
      "role": "assistant",
      "content": "Karnataka has..."
    }
  ]
}
```

## Expected Response

The endpoint returns **Server-Sent Events (SSE)** stream. In Postman:

1. **Send the request**
2. **View the response** - You'll see multiple `data:` lines like:
   ```
   data: {"type":"token","content":"Karnataka"}
   data: {"type":"token","content":" has"}
   data: {"type":"chart","title":"...","data":[...]}
   data: {"type":"done"}
   ```

## Response Types

- `{"type":"token","content":"..."}` - Streaming text tokens
- `{"type":"chart",...}` - Chart visualizations
- `{"type":"tool_call","tool":"...","args":{...}}` - Tool invocations
- `{"type":"tool_result","tool":"..."}` - Tool results
- `{"type":"suggestions","suggestions":[...]}` - Follow-up questions
- `{"type":"done"}` - Stream complete
- `{"type":"error","error":"..."}` - Error occurred

## Common Errors

### 500 Internal Server Error

**Cause:** Missing `GROQ_API_KEY` in `.env` file

**Solution:**
1. Create `.env` file in `backend/` directory
2. Add: `GROQ_API_KEY=your_actual_api_key`
3. Restart the server

### 400 Bad Request

**Cause:** Missing or invalid `query` field

**Solution:** Ensure request body has:
```json
{
  "query": "your question here"
}
```

## Testing with cURL

```bash
curl -X POST http://localhost:3004/api/gw-chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the groundwater status in Karnataka?",
    "language": "en",
    "chatHistory": []
  }'
```

## Testing with JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:3004/api/gw-chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What is the groundwater status in Karnataka?',
    language: 'en',
    chatHistory: []
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

