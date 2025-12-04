# Sample Transaction Data

This directory contains sample CSV files for testing transaction import functionality.

## Files

### transactions-sample.csv

Sample transactions for January 2024 covering common expense categories:

- **Income**: Monthly salary
- **Housing**: Rent
- **Groceries**: Multiple grocery store visits
- **Transportation**: Gas station purchases
- **Utilities**: Electric, water, internet, cell phone
- **Dining Out**: Restaurants and coffee shops
- **Entertainment**: Streaming services, movies, books
- **Healthcare**: Pharmacy, doctor visits
- **Insurance**: Car insurance
- **Shopping**: Various retail purchases
- **Debt Payment**: Credit card payment
- **Savings**: Savings transfer

**Total Transactions**: 31
**Net Cash Flow**: +$381.24

### transactions-february.csv

Sample transactions for February 2024 with similar categories plus Valentine's Day spending.

**Total Transactions**: 29
**Net Cash Flow**: +$298.74

## CSV Format

All CSV files follow this format:

```csv
Date,Description,Amount,Category
2024-01-01,Monthly Salary Deposit,3500.00,Income
2024-01-02,Rent Payment,-1200.00,Housing
```

- **Date**: YYYY-MM-DD format
- **Description**: Transaction description
- **Amount**: Positive for income, negative for expenses
- **Category**: Transaction category (optional for import)

## Usage

### Import via API

```bash
curl -X POST http://localhost:4000/v1/import-transactions \
  -H "Content-Type: application/json" \
  -d '{
    "csvData": "<CSV content>",
    "accountId": "checking"
  }'
```

### Import via Web UI

1. Navigate to `/transactions/import` (when implemented)
2. Upload CSV file
3. Map columns (Date → Date, Description → Description, etc.)
4. Review and import

### Testing with Core Package

```typescript
import { csvToTransactions, parseCSV } from '@budget-copilot/core/csv-parser';
import fs from 'fs';

const csvContent = fs.readFileSync(
  'data/samples/transactions-sample.csv',
  'utf-8'
);

const transactions = csvToTransactions(
  csvContent,
  {
    mapping: {
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      amountColumn: 'Amount',
    },
    delimiter: ',',
  },
  'checking'
);

console.log(`Imported ${transactions.length} transactions`);
```

## Adding Custom Samples

To create your own sample data:

1. Use the same CSV format
2. Follow the date format: YYYY-MM-DD
3. Use negative amounts for expenses, positive for income
4. Include a variety of categories for better testing

## Category Mapping

When importing, you can test auto-categorization with these patterns:

| Pattern                                  | Category         |
| ---------------------------------------- | ---------------- |
| "Grocery", "Whole Foods", "Trader Joes"  | Groceries        |
| "Gas", "Shell", "BP", "Chevron"          | Transportation   |
| "Electric", "Water", "Internet", "Phone" | Utilities        |
| "Restaurant", "Coffee", "Starbucks"      | Dining Out       |
| "Netflix", "Spotify", "Movie"            | Entertainment    |
| "Pharmacy", "CVS", "Doctor"              | Healthcare       |
| "Gym", "Fitness"                         | Health & Fitness |
| "Rent"                                   | Housing          |
| "Insurance"                              | Insurance        |

## Tips

- Use realistic merchant names for better AI analysis testing
- Include both regular and irregular expenses
- Add occasional large purchases to test anomaly detection
- Vary amounts to test budget variance calculations
