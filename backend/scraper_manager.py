import asyncio
import os
import uuid
from datetime import datetime
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from models import ScraperRun

class ScraperManager:
    LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(LOGS_DIR, exist_ok=True)
    
    @staticmethod
    async def run_scraper(run_id: str, site_id: str, db: AsyncSession):
        """Runs the scraper pipeline in a subprocess."""
        log_file_path = os.path.join(LOGS_DIR, f"{run_id}.log")
        
        # Open log file to write stdout and stderr
        with open(log_file_path, "w", encoding="utf-8") as log_file:
            log_file.write(f"--- Starting Scraper Run {run_id} for {site_id} at {datetime.utcnow()} ---\n")
            
            import sys
            
            # The backend is in backend/ and scraper in scraper/, so we run from the parent dir
            parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            python_exec = os.getenv("SCRAPER_PYTHON_PATH", sys.executable)
                
            process = await asyncio.create_subprocess_exec(
                python_exec, "-m", "scraper.cli", "run", site_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=parent_dir
            )

            stdout_output = ""
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded_line = line.decode('utf-8', errors='replace')
                log_file.write(decoded_line)
                log_file.flush()
                stdout_output += decoded_line

            await process.wait()

            log_file.write(f"\n--- Scraper Run Finished with Exit Code {process.returncode} at {datetime.utcnow()} ---\n")

        # Parse output to find success or failure and event count
        status = "success" if process.returncode == 0 else "failed"
        events_found = 0
        error_message = None

        if status == "success":
            match = re.search(r"Found (\d+) events\.", stdout_output)
            if match:
                events_found = int(match.group(1))
        else:
            match = re.search(r"\[ERROR\] Scrape Failed: (.*)", stdout_output)
            if match:
                error_message = match.group(1).strip()
            else:
                error_message = f"Process exited with code {process.returncode}"

        # Update DB record
        await db.execute(
            update(ScraperRun)
            .where(ScraperRun.id == uuid.UUID(run_id))
            .values(
                status=status,
                end_time=datetime.utcnow(),
                events_found=events_found,
                error_message=error_message
            )
        )
        await db.commit()

    @staticmethod
    def get_logs(run_id: str) -> str:
        """Read logs from file for a given run ID."""
        log_file_path = os.path.join(LOGS_DIR, f"{run_id}.log")
        if not os.path.exists(log_file_path):
            return "Log file not found."
        
        with open(log_file_path, "r", encoding="utf-8") as f:
            return f.read()
