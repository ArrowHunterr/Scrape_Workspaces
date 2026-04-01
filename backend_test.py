#!/usr/bin/env python3
"""
Backend API Testing for Playwright Scraping Workbench
Tests all endpoints: stats, jobs, templates, settings
"""
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class PlaywrightWorkbenchTester:
    def __init__(self, base_url="https://extract-workbench.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_api_endpoint(self, method: str, endpoint: str, expected_status: int, 
                         data: Dict = None, description: str = "") -> tuple:
        """Test a single API endpoint"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json() if response.content else {}
                except:
                    response_data = {}
            else:
                response_data = {}
                
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            if not success and response.content:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(f"{method} {endpoint} - {description}", success, details)
            return success, response_data

        except Exception as e:
            self.log_test(f"{method} {endpoint} - {description}", False, f"Exception: {str(e)}")
            return False, {}

    def test_stats_endpoint(self):
        """Test GET /api/stats"""
        print("\n🔍 Testing Stats Endpoint...")
        success, data = self.test_api_endpoint(
            'GET', 'stats', 200, 
            description="Get dashboard statistics"
        )
        
        if success:
            required_fields = ['total_jobs', 'success_jobs', 'failed_jobs', 'running_jobs', 'total_templates', 'total_items_extracted']
            for field in required_fields:
                if field in data:
                    self.log_test(f"Stats contains {field}", True)
                else:
                    self.log_test(f"Stats contains {field}", False, f"Missing field: {field}")
        
        return success

    def test_templates_crud(self):
        """Test Templates CRUD operations"""
        print("\n🔍 Testing Templates CRUD...")
        
        # Test GET templates (empty initially)
        success, templates = self.test_api_endpoint(
            'GET', 'templates', 200,
            description="Get all templates"
        )
        
        # Test CREATE template
        template_data = {
            "name": "Test Template",
            "description": "A test template for scraping",
            "selectors": [
                {
                    "name": "title",
                    "selector": "h1",
                    "attribute": None
                },
                {
                    "name": "link",
                    "selector": "a",
                    "attribute": "href"
                }
            ],
            "pagination": {
                "enabled": True,
                "next_selector": ".next-page",
                "max_pages": 3
            },
            "default_captcha_solver": "2captcha"
        }
        
        success, created_template = self.test_api_endpoint(
            'POST', 'templates', 200,
            data=template_data,
            description="Create new template"
        )
        
        template_id = None
        if success and 'id' in created_template:
            template_id = created_template['id']
            self.log_test("Template created with ID", True, f"ID: {template_id}")
        else:
            self.log_test("Template created with ID", False, "No ID in response")
            return False
        
        # Test GET single template
        success, template = self.test_api_endpoint(
            'GET', f'templates/{template_id}', 200,
            description="Get single template"
        )
        
        if success:
            if template.get('name') == template_data['name']:
                self.log_test("Template data matches", True)
            else:
                self.log_test("Template data matches", False, f"Name mismatch: {template.get('name')}")
        
        # Test UPDATE template
        update_data = {
            "name": "Updated Test Template",
            "description": "Updated description",
            "selectors": [
                {
                    "name": "title",
                    "selector": "h1.main-title",
                    "attribute": None
                }
            ],
            "pagination": None,
            "default_captcha_solver": "nopecha"
        }
        
        success, updated_template = self.test_api_endpoint(
            'PUT', f'templates/{template_id}', 200,
            data=update_data,
            description="Update template"
        )
        
        if success and updated_template.get('name') == update_data['name']:
            self.log_test("Template updated successfully", True)
        else:
            self.log_test("Template updated successfully", False, "Update data mismatch")
        
        # Test DELETE template
        success, _ = self.test_api_endpoint(
            'DELETE', f'templates/{template_id}', 200,
            description="Delete template"
        )
        
        # Verify deletion
        success, _ = self.test_api_endpoint(
            'GET', f'templates/{template_id}', 404,
            description="Verify template deleted"
        )
        
        return True

    def test_jobs_crud(self):
        """Test Jobs CRUD operations"""
        print("\n🔍 Testing Jobs CRUD...")
        
        # Test GET jobs (empty initially)
        success, jobs = self.test_api_endpoint(
            'GET', 'jobs', 200,
            description="Get all jobs"
        )
        
        # Test CREATE job
        job_data = {
            "name": "Test Scraping Job",
            "urls": ["https://httpbin.org/html"],
            "selectors": [
                {
                    "name": "title",
                    "selector": "h1",
                    "attribute": None
                }
            ],
            "pagination": None,
            "use_proxy": False,
            "captcha_solver": None
        }
        
        success, created_job = self.test_api_endpoint(
            'POST', 'jobs', 200,
            data=job_data,
            description="Create new job"
        )
        
        job_id = None
        if success and 'id' in created_job:
            job_id = created_job['id']
            self.log_test("Job created with ID", True, f"ID: {job_id}")
            
            # Check initial status
            if created_job.get('status') == 'pending':
                self.log_test("Job initial status is pending", True)
            else:
                self.log_test("Job initial status is pending", False, f"Status: {created_job.get('status')}")
        else:
            self.log_test("Job created with ID", False, "No ID in response")
            return False
        
        # Test GET single job
        success, job = self.test_api_endpoint(
            'GET', f'jobs/{job_id}', 200,
            description="Get single job"
        )
        
        if success:
            if job.get('name') == job_data['name']:
                self.log_test("Job data matches", True)
            else:
                self.log_test("Job data matches", False, f"Name mismatch: {job.get('name')}")
        
        # Test job output endpoint (should be 404 initially)
        success, _ = self.test_api_endpoint(
            'GET', f'jobs/{job_id}/output', 404,
            description="Get job output (not ready yet)"
        )
        
        # Test job logs endpoint
        success, _ = self.test_api_endpoint(
            'GET', f'jobs/{job_id}/logs', 200,
            description="Get job logs"
        )
        
        # Test DELETE job
        success, _ = self.test_api_endpoint(
            'DELETE', f'jobs/{job_id}', 200,
            description="Delete job"
        )
        
        # Verify deletion
        success, _ = self.test_api_endpoint(
            'GET', f'jobs/{job_id}', 404,
            description="Verify job deleted"
        )
        
        return True

    def test_settings_crud(self):
        """Test Settings CRUD operations"""
        print("\n🔍 Testing Settings CRUD...")
        
        # Test GET settings (should return defaults)
        success, settings = self.test_api_endpoint(
            'GET', 'settings', 200,
            description="Get current settings"
        )
        
        if success:
            required_fields = ['proxy_list', 'captcha_2captcha_key', 'captcha_nopecha_key']
            for field in required_fields:
                if field in settings:
                    self.log_test(f"Settings contains {field}", True)
                else:
                    self.log_test(f"Settings contains {field}", False, f"Missing field: {field}")
        
        # Test UPDATE settings
        update_data = {
            "proxy_list": "127.0.0.1:8080:user:pass\n192.168.1.1:3128",
            "captcha_2captcha_key": "test_2captcha_key_123",
            "captcha_nopecha_key": "test_nopecha_key_456"
        }
        
        success, updated_settings = self.test_api_endpoint(
            'PUT', 'settings', 200,
            data=update_data,
            description="Update settings"
        )
        
        if success:
            if updated_settings.get('proxy_list') == update_data['proxy_list']:
                self.log_test("Settings proxy_list updated", True)
            else:
                self.log_test("Settings proxy_list updated", False, "Proxy list mismatch")
                
            if updated_settings.get('captcha_2captcha_key') == update_data['captcha_2captcha_key']:
                self.log_test("Settings 2captcha key updated", True)
            else:
                self.log_test("Settings 2captcha key updated", False, "2captcha key mismatch")
        
        # Test partial update
        partial_update = {
            "proxy_list": "new.proxy.com:8080"
        }
        
        success, _ = self.test_api_endpoint(
            'PUT', 'settings', 200,
            data=partial_update,
            description="Partial settings update"
        )
        
        return True

    def test_error_cases(self):
        """Test error handling"""
        print("\n🔍 Testing Error Cases...")
        
        # Test invalid job creation
        invalid_job = {
            "name": "",  # Empty name should fail
            "urls": [],  # Empty URLs should fail
            "selectors": []  # Empty selectors should fail
        }
        
        success, _ = self.test_api_endpoint(
            'POST', 'jobs', 422,  # Expecting validation error
            data=invalid_job,
            description="Create job with invalid data"
        )
        
        # Test non-existent job
        success, _ = self.test_api_endpoint(
            'GET', 'jobs/non-existent-id', 404,
            description="Get non-existent job"
        )
        
        # Test non-existent template
        success, _ = self.test_api_endpoint(
            'GET', 'templates/non-existent-id', 404,
            description="Get non-existent template"
        )
        
        return True

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Playwright Scraping Workbench Backend Tests")
        print(f"Testing API at: {self.base_url}")
        
        # Test basic connectivity
        success, _ = self.test_api_endpoint(
            'GET', '', 200,
            description="API root endpoint"
        )
        
        if not success:
            print("❌ Cannot connect to API. Stopping tests.")
            return False
        
        # Run all test suites
        self.test_stats_endpoint()
        self.test_templates_crud()
        self.test_jobs_crud()
        self.test_settings_crud()
        self.test_error_cases()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = PlaywrightWorkbenchTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())