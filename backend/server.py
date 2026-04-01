from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Data directories
DATA_DIR = Path("/app/data")
OUTPUTS_DIR = DATA_DIR / "outputs"
LOGS_DIR = DATA_DIR / "logs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class SelectorConfig(BaseModel):
    name: str
    selector: str
    attribute: Optional[str] = None  # None means text content

class PaginationConfig(BaseModel):
    enabled: bool = False
    next_selector: Optional[str] = None
    max_pages: int = 5

class JobCreate(BaseModel):
    name: str
    urls: List[str]
    selectors: List[SelectorConfig]
    pagination: Optional[PaginationConfig] = None
    template_id: Optional[str] = None
    use_proxy: bool = False
    captcha_solver: Optional[str] = None  # "2captcha" or "nopecha"

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    urls: List[str]
    selectors: List[SelectorConfig]
    pagination: Optional[PaginationConfig] = None
    template_id: Optional[str] = None
    use_proxy: bool = False
    captcha_solver: Optional[str] = None
    status: str = "pending"  # pending, running, success, failed, partial
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    output_file: Optional[str] = None
    error: Optional[str] = None
    items_extracted: int = 0

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    selectors: List[SelectorConfig]
    pagination: Optional[PaginationConfig] = None
    default_captcha_solver: Optional[str] = None

class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    selectors: List[SelectorConfig]
    pagination: Optional[PaginationConfig] = None
    default_captcha_solver: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettingsUpdate(BaseModel):
    proxy_list: Optional[str] = None
    captcha_2captcha_key: Optional[str] = None
    captcha_nopecha_key: Optional[str] = None

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global_settings"
    proxy_list: str = ""
    captcha_2captcha_key: str = ""
    captcha_nopecha_key: str = ""

# ============ SCRAPER IMPORT ============
from scraper import run_scraping_job

# ============ JOB ENDPOINTS ============

@api_router.get("/")
async def root():
    return {"message": "Playwright Scraping Workbench API"}

@api_router.post("/jobs", response_model=Job)
async def create_job(job_input: JobCreate, background_tasks: BackgroundTasks):
    job = Job(**job_input.model_dump())
    doc = job.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc['completed_at']:
        doc['completed_at'] = doc['completed_at'].isoformat()
    await db.jobs.insert_one(doc)
    
    # Start scraping in background
    background_tasks.add_task(execute_job, job.id)
    
    return job

async def execute_job(job_id: str):
    """Execute a scraping job"""
    try:
        # Update status to running
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running"}}
        )
        
        # Fetch job and settings
        job_doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
        settings_doc = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
        
        if not job_doc:
            return
            
        settings = settings_doc or {}
        
        # Run the scraper
        result = await run_scraping_job(
            job_id=job_id,
            urls=job_doc['urls'],
            selectors=job_doc['selectors'],
            pagination=job_doc.get('pagination'),
            use_proxy=job_doc.get('use_proxy', False),
            proxy_list=settings.get('proxy_list', ''),
            captcha_solver=job_doc.get('captcha_solver'),
            captcha_keys={
                '2captcha': settings.get('captcha_2captcha_key', ''),
                'nopecha': settings.get('captcha_nopecha_key', '')
            }
        )
        
        # Update job with results
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": result['status'],
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "output_file": result.get('output_file'),
                "error": result.get('error'),
                "items_extracted": result.get('items_extracted', 0)
            }}
        )
        
    except Exception as e:
        logging.error(f"Job {job_id} failed: {e}")
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }}
        )

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(limit: int = 50, skip: int = 0):
    jobs = await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for job in jobs:
        if isinstance(job.get('created_at'), str):
            job['created_at'] = datetime.fromisoformat(job['created_at'])
        if isinstance(job.get('completed_at'), str):
            job['completed_at'] = datetime.fromisoformat(job['completed_at'])
    return jobs

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if isinstance(job.get('created_at'), str):
        job['created_at'] = datetime.fromisoformat(job['created_at'])
    if isinstance(job.get('completed_at'), str):
        job['completed_at'] = datetime.fromisoformat(job['completed_at'])
    return job

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    result = await db.jobs.delete_one({"id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    # Clean up output file
    output_path = OUTPUTS_DIR / f"{job_id}.txt"
    if output_path.exists():
        output_path.unlink()
    log_path = LOGS_DIR / f"{job_id}.log"
    if log_path.exists():
        log_path.unlink()
    return {"message": "Job deleted"}

@api_router.get("/jobs/{job_id}/output", response_class=PlainTextResponse)
async def get_job_output(job_id: str):
    output_path = OUTPUTS_DIR / f"{job_id}.txt"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    return output_path.read_text()

@api_router.get("/jobs/{job_id}/logs", response_class=PlainTextResponse)
async def get_job_logs(job_id: str):
    log_path = LOGS_DIR / f"{job_id}.log"
    if not log_path.exists():
        return "No logs available yet."
    return log_path.read_text()

# ============ TEMPLATE ENDPOINTS ============

@api_router.post("/templates", response_model=Template)
async def create_template(template_input: TemplateCreate):
    template = Template(**template_input.model_dump())
    doc = template.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.templates.insert_one(doc)
    return template

@api_router.get("/templates", response_model=List[Template])
async def get_templates():
    templates = await db.templates.find({}, {"_id": 0}).to_list(100)
    for t in templates:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if isinstance(t.get('updated_at'), str):
            t['updated_at'] = datetime.fromisoformat(t['updated_at'])
    return templates

@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if isinstance(template.get('created_at'), str):
        template['created_at'] = datetime.fromisoformat(template['created_at'])
    if isinstance(template.get('updated_at'), str):
        template['updated_at'] = datetime.fromisoformat(template['updated_at'])
    return template

@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, template_input: TemplateCreate):
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_input.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    updated = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return updated

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ============ SETTINGS ENDPOINTS ============

@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        return Settings()
    return settings

@api_router.put("/settings", response_model=Settings)
async def update_settings(settings_input: SettingsUpdate):
    update_data = {k: v for k, v in settings_input.model_dump().items() if v is not None}
    
    if update_data:
        await db.settings.update_one(
            {"id": "global_settings"},
            {"$set": update_data},
            upsert=True
        )
    
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        return Settings()
    return settings

# ============ STATS ENDPOINT ============

@api_router.get("/stats")
async def get_stats():
    total_jobs = await db.jobs.count_documents({})
    success_jobs = await db.jobs.count_documents({"status": "success"})
    failed_jobs = await db.jobs.count_documents({"status": "failed"})
    running_jobs = await db.jobs.count_documents({"status": "running"})
    total_templates = await db.templates.count_documents({})
    
    # Calculate total items extracted
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$items_extracted"}}}]
    result = await db.jobs.aggregate(pipeline).to_list(1)
    total_items = result[0]['total'] if result else 0
    
    return {
        "total_jobs": total_jobs,
        "success_jobs": success_jobs,
        "failed_jobs": failed_jobs,
        "running_jobs": running_jobs,
        "total_templates": total_templates,
        "total_items_extracted": total_items
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
