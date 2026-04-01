"""
Playwright Scraping Engine with Stealth, Proxy Rotation, and Captcha Handling
"""
import asyncio
import logging
import os
import random
import httpx
from pathlib import Path
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, BrowserContext, Page
from playwright_stealth import Stealth

# Set Playwright browsers path
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Directories
OUTPUTS_DIR = Path("/app/data/outputs")
LOGS_DIR = Path("/app/data/logs")

logger = logging.getLogger(__name__)


class JobLogger:
    """Logger that writes to both console and job-specific log file"""
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.log_path = LOGS_DIR / f"{job_id}.log"
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0
        log_line = f"[{level}] {message}\n"
        with open(self.log_path, "a") as f:
            f.write(log_line)
        if level == "ERROR":
            logger.error(f"[Job {self.job_id}] {message}")
        else:
            logger.info(f"[Job {self.job_id}] {message}")


class ProxyRotator:
    """Sequential proxy rotation from ip:port:user:password format"""
    def __init__(self, proxy_list: str):
        self.proxies = self._parse_proxies(proxy_list)
        self.current_index = 0
        
    def _parse_proxies(self, proxy_list: str) -> List[Dict[str, str]]:
        proxies = []
        if not proxy_list:
            return proxies
            
        for line in proxy_list.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            parts = line.split(':')
            if len(parts) >= 2:
                proxy = {
                    'server': f"http://{parts[0]}:{parts[1]}"
                }
                if len(parts) >= 4:
                    proxy['username'] = parts[2]
                    proxy['password'] = parts[3]
                proxies.append(proxy)
        return proxies
    
    def get_next(self) -> Optional[Dict[str, str]]:
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxies)
        return proxy
    
    def has_proxies(self) -> bool:
        return len(self.proxies) > 0


class CaptchaSolver:
    """Handle captcha solving via 2Captcha or NopeCHA"""
    def __init__(self, solver_type: str, api_key: str, job_logger: JobLogger):
        self.solver_type = solver_type
        self.api_key = api_key
        self.logger = job_logger
        
    async def solve_recaptcha_v2(self, site_key: str, page_url: str) -> Optional[str]:
        if not self.api_key:
            self.logger.log(f"No API key configured for {self.solver_type}", "ERROR")
            return None
            
        if self.solver_type == "2captcha":
            return await self._solve_2captcha(site_key, page_url)
        elif self.solver_type == "nopecha":
            return await self._solve_nopecha(site_key, page_url)
        return None
    
    async def _solve_2captcha(self, site_key: str, page_url: str) -> Optional[str]:
        try:
            self.logger.log("Sending captcha to 2Captcha...")
            async with httpx.AsyncClient() as client:
                # Submit captcha
                response = await client.post(
                    "http://2captcha.com/in.php",
                    data={
                        "key": self.api_key,
                        "method": "userrecaptcha",
                        "googlekey": site_key,
                        "pageurl": page_url,
                        "json": 1
                    }
                )
                result = response.json()
                if result.get("status") != 1:
                    self.logger.log(f"2Captcha submission failed: {result}", "ERROR")
                    return None
                    
                request_id = result["request"]
                self.logger.log(f"2Captcha request ID: {request_id}")
                
                # Poll for result
                for _ in range(30):  # Max 2.5 minutes
                    await asyncio.sleep(5)
                    response = await client.get(
                        f"http://2captcha.com/res.php?key={self.api_key}&action=get&id={request_id}&json=1"
                    )
                    result = response.json()
                    if result.get("status") == 1:
                        self.logger.log("Captcha solved successfully!")
                        return result["request"]
                    elif "CAPCHA_NOT_READY" not in str(result.get("request", "")):
                        self.logger.log(f"2Captcha error: {result}", "ERROR")
                        return None
                        
                self.logger.log("2Captcha timeout", "ERROR")
                return None
        except Exception as e:
            self.logger.log(f"2Captcha error: {e}", "ERROR")
            return None
    
    async def _solve_nopecha(self, site_key: str, page_url: str) -> Optional[str]:
        try:
            self.logger.log("Sending captcha to NopeCHA...")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.nopecha.com/",
                    json={
                        "key": self.api_key,
                        "type": "recaptcha2",
                        "sitekey": site_key,
                        "url": page_url
                    }
                )
                result = response.json()
                
                if "error" in result:
                    self.logger.log(f"NopeCHA error: {result['error']}", "ERROR")
                    return None
                    
                if "data" in result:
                    self.logger.log("Captcha solved successfully!")
                    return result["data"]
                    
                # Poll if we got a request ID
                if "id" in result:
                    request_id = result["id"]
                    for _ in range(30):
                        await asyncio.sleep(5)
                        response = await client.get(
                            f"https://api.nopecha.com/?key={self.api_key}&id={request_id}"
                        )
                        result = response.json()
                        if "data" in result:
                            self.logger.log("Captcha solved successfully!")
                            return result["data"]
                        elif "error" in result:
                            self.logger.log(f"NopeCHA error: {result['error']}", "ERROR")
                            return None
                            
                self.logger.log("NopeCHA timeout or unexpected response", "ERROR")
                return None
        except Exception as e:
            self.logger.log(f"NopeCHA error: {e}", "ERROR")
            return None


async def human_like_delay(min_ms: int = 500, max_ms: int = 2000):
    """Random delay to simulate human behavior"""
    delay = random.uniform(min_ms, max_ms) / 1000
    await asyncio.sleep(delay)


async def human_like_mouse_move(page: Page):
    """Simulate human-like mouse movements"""
    try:
        viewport = page.viewport_size
        if viewport:
            for _ in range(random.randint(2, 5)):
                x = random.randint(100, viewport['width'] - 100)
                y = random.randint(100, viewport['height'] - 100)
                await page.mouse.move(x, y)
                await human_like_delay(100, 300)
    except:
        pass


async def check_for_cloudflare(page: Page) -> bool:
    """Detect Cloudflare challenge page"""
    try:
        content = await page.content()
        indicators = [
            "cf-browser-verification",
            "cf-challenge-running",
            "cf_chl_prog",
            "Checking your browser",
            "ray ID"
        ]
        return any(ind.lower() in content.lower() for ind in indicators)
    except:
        return False


async def wait_for_cloudflare(page: Page, job_logger: JobLogger, timeout: int = 30):
    """Wait for Cloudflare challenge to complete"""
    start = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start < timeout:
        if not await check_for_cloudflare(page):
            job_logger.log("Cloudflare challenge passed")
            return True
        job_logger.log("Waiting for Cloudflare challenge...")
        await human_like_delay(2000, 3000)
        await human_like_mouse_move(page)
    return False


async def extract_data(page: Page, selectors: List[Dict], job_logger: JobLogger) -> List[str]:
    """Extract data using provided selectors"""
    extracted = []
    
    for selector_config in selectors:
        selector = selector_config['selector']
        name = selector_config['name']
        attribute = selector_config.get('attribute')
        
        try:
            elements = await page.query_selector_all(selector)
            job_logger.log(f"Found {len(elements)} elements for selector: {name}")
            
            for el in elements:
                try:
                    if attribute:
                        value = await el.get_attribute(attribute)
                    else:
                        value = await el.text_content()
                    
                    if value:
                        value = value.strip()
                        if value:
                            extracted.append(f"{name}: {value}")
                except Exception as e:
                    job_logger.log(f"Error extracting element: {e}", "ERROR")
                    
        except Exception as e:
            job_logger.log(f"Error with selector {name}: {e}", "ERROR")
    
    return extracted


async def scrape_url(
    context: BrowserContext,
    url: str,
    selectors: List[Dict],
    pagination: Optional[Dict],
    job_logger: JobLogger,
    captcha_solver: Optional[CaptchaSolver]
) -> List[str]:
    """Scrape a single URL with pagination support"""
    all_data = []
    current_url = url
    page_num = 1
    max_pages = pagination.get('max_pages', 5) if pagination and pagination.get('enabled') else 1
    
    page = await context.new_page()
    # Apply stealth mode
    stealth_config = Stealth()
    await stealth_config.apply_stealth_async(page)
    
    try:
        while page_num <= max_pages:
            job_logger.log(f"Scraping page {page_num}: {current_url}")
            
            # Navigate with retry
            for attempt in range(3):
                try:
                    await page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                    break
                except Exception as e:
                    job_logger.log(f"Navigation attempt {attempt + 1} failed: {e}", "ERROR")
                    if attempt == 2:
                        raise
                    await human_like_delay(2000, 4000)
            
            # Human-like behavior
            await human_like_delay(1000, 2000)
            await human_like_mouse_move(page)
            
            # Check for Cloudflare
            if await check_for_cloudflare(page):
                job_logger.log("Cloudflare detected, attempting to wait...")
                if not await wait_for_cloudflare(page, job_logger):
                    job_logger.log("Could not bypass Cloudflare", "ERROR")
                    break
            
            # Wait for content to load
            await human_like_delay(1500, 3000)
            
            # Scroll to trigger lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            await human_like_delay(500, 1000)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await human_like_delay(500, 1000)
            
            # Extract data
            data = await extract_data(page, selectors, job_logger)
            all_data.extend(data)
            job_logger.log(f"Extracted {len(data)} items from page {page_num}")
            
            # Check for pagination
            if pagination and pagination.get('enabled') and page_num < max_pages:
                next_selector = pagination.get('next_selector')
                if next_selector:
                    try:
                        next_button = await page.query_selector(next_selector)
                        if next_button:
                            is_disabled = await next_button.get_attribute('disabled')
                            if is_disabled:
                                job_logger.log("Next button is disabled, stopping pagination")
                                break
                            
                            await human_like_delay(500, 1000)
                            await next_button.click()
                            await human_like_delay(2000, 4000)
                            current_url = page.url
                            page_num += 1
                        else:
                            job_logger.log("No next button found, stopping pagination")
                            break
                    except Exception as e:
                        job_logger.log(f"Pagination error: {e}", "ERROR")
                        break
                else:
                    break
            else:
                break
                
    except Exception as e:
        job_logger.log(f"Error scraping {url}: {e}", "ERROR")
    finally:
        await page.close()
    
    return all_data


async def run_scraping_job(
    job_id: str,
    urls: List[str],
    selectors: List[Dict],
    pagination: Optional[Dict],
    use_proxy: bool,
    proxy_list: str,
    captcha_solver: Optional[str],
    captcha_keys: Dict[str, str]
) -> Dict[str, Any]:
    """Main scraping job executor"""
    job_logger = JobLogger(job_id)
    job_logger.log(f"Starting job with {len(urls)} URLs")
    
    proxy_rotator = ProxyRotator(proxy_list) if use_proxy else None
    solver = None
    if captcha_solver and captcha_keys.get(captcha_solver):
        solver = CaptchaSolver(captcha_solver, captcha_keys[captcha_solver], job_logger)
    
    all_extracted = []
    errors = []
    
    try:
        async with async_playwright() as p:
            browser_args = [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
            
            browser = await p.chromium.launch(
                headless=True,
                args=browser_args
            )
            
            job_logger.log("Browser launched successfully")
            
            # Process URLs concurrently (max 3 at a time)
            semaphore = asyncio.Semaphore(3)
            
            async def process_url(url: str) -> List[str]:
                async with semaphore:
                    # Create context with optional proxy
                    context_options = {
                        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'viewport': {'width': 1920, 'height': 1080},
                        'locale': 'en-US',
                        'timezone_id': 'America/New_York'
                    }
                    
                    if proxy_rotator and proxy_rotator.has_proxies():
                        proxy = proxy_rotator.get_next()
                        job_logger.log(f"Using proxy: {proxy['server']}")
                        context_options['proxy'] = proxy
                    
                    context = await browser.new_context(**context_options)
                    
                    try:
                        return await scrape_url(context, url, selectors, pagination, job_logger, solver)
                    finally:
                        await context.close()
            
            # Run all URLs
            tasks = [process_url(url) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    errors.append(f"URL {urls[i]}: {str(result)}")
                    job_logger.log(f"URL {urls[i]} failed: {result}", "ERROR")
                else:
                    all_extracted.extend(result)
            
            await browser.close()
            
    except Exception as e:
        job_logger.log(f"Browser error: {e}", "ERROR")
        errors.append(str(e))
    
    # Save output
    output_path = OUTPUTS_DIR / f"{job_id}.txt"
    with open(output_path, 'w') as f:
        for item in all_extracted:
            f.write(f"{item}\n")
    
    job_logger.log(f"Job complete. Extracted {len(all_extracted)} items total")
    
    # Determine status
    if errors and not all_extracted:
        status = "failed"
    elif errors:
        status = "partial"
    else:
        status = "success"
    
    return {
        'status': status,
        'output_file': f"{job_id}.txt",
        'items_extracted': len(all_extracted),
        'error': '; '.join(errors) if errors else None
    }
