def calculate_priority(severity):

    mapping = {
        "Critical": "P1",
        "Major": "P2",
        "Minor": "P3",
        "Warning": "P4"
    }

    return mapping.get(severity, "P3")