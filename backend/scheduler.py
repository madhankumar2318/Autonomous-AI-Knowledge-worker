# backend/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
import time
import requests
import traceback

def generate_report_job():
    try:
        resp = requests.post("http://127.0.0.1:8000/report/generate_now", timeout=30)
        print("Scheduler: report job response:", resp.status_code, resp.text)
    except Exception as e:
        print("Scheduler: error running report job:", e)
        traceback.print_exc()

scheduler = None

def start_scheduler():
    global scheduler
    if scheduler:
        return
    scheduler = BackgroundScheduler()
    # daily at 09:00 local time
    scheduler.add_job(generate_report_job, 'cron', hour=9, minute=0, id='daily_report')
    # also add an hourly job for testing/dev (comment out for production)
    scheduler.add_job(generate_report_job, 'interval', hours=1, id='hourly_report')
    scheduler.start()
    print("Scheduler started")
