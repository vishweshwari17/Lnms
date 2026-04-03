import logging
from app.services.alarm_to_ticket import process_spic_alarms

def create_spicnms_tickets():
    """Redundant logic removed. Consolidated into alarm_to_ticket.py."""
    return process_spic_alarms()

def sync_manual_spicnms_tickets():
    """Placeholder for legacy sync_manual_spicnms_tickets."""
    return []