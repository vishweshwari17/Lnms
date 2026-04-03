import logging
from app.services.alarm_to_ticket import process_lnms_alarms

def create_lnms_tickets():
    """Redundant logic removed. Consolidated into alarm_to_ticket.py."""
    return process_lnms_alarms()
