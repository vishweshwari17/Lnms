import logging

logger = logging.getLogger("lnms.ai_service")

def classify_ticket(title: str, description: str) -> str:
    """
    Categorizes tickets based on keywords in title and description.
    AI/NLP logic placeholder.
    """
    text = (f"{title} {description}").lower()
    
    if any(k in text for k in ["security", "firewall", "unauthorized", "breach"]):
        return "Security"
    if any(k in text for k in ["hardware", "disk", "cpu", "memory", "down", "fan"]):
        return "Hardware"
    if any(k in text for k in ["software", "application", "error", "bug", "process"]):
        return "Software"
    if any(k in text for k in ["network", "switch", "router", "link", "latency", "interface"]):
        return "Network"
        
    return "Other"

def predict_priority(device_criticality: str, alarm_severity: str) -> str:
    """
    Predicts ticket urgency based on device criticality and alarm severity.
    """
    # Simple rule-based prediction
    if alarm_severity == "Critical":
        return "P1"
    if alarm_severity == "Major":
        return "P2"
    if alarm_severity == "Minor":
        return "P3"
    return "P4"
