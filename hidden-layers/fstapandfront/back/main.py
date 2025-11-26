from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware (Allow ALL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],       # Allow all HTTP methods: GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],       # Allow all headers
)

@app.get("/")
def return_name():
    return {"name": "Mohamed"}
