# Data Synchronization Rules

## Critical: models.csv ↔ providers.csv Sync

**WHENEVER models.csv is modified:**
1. Extract unique providers from models.csv
2. Update providers.csv with any new providers
3. Ensure both files stay synchronized

**Process:**
```python
# Read models.csv
# Extract unique providers from 'provider' column
# Compare with existing providers.csv
# Add any missing providers to providers.csv
# Save updated providers.csv
```

**Files:**
- Source: `data/models.csv` (provider column)
- Target: `data/providers.csv` (list of unique providers)

**Trigger:** Any change to data/models.csv requires provider list update
