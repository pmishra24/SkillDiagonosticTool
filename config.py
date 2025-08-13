# config.py
import logging

# Logging level
LOG_LEVEL = logging.INFO

# Thresholds and constants
MIN_LENGTH = 4
FUZZY_THRESHOLD = 90
BOX_CHARS = ['☐', '□', '☑', '◻', '◼']
GLYPH_RE = r'[\u25A0-\u25FF]'
