import { describe, it, expect } from 'vitest';
import {
  calculateEnvelopeBalance,
  isEnvelopeOverspent,
  calculateUtilization,
  getEnvelopeStatus,
} from '../src/envelopes';
import type { Envelope, Transaction } from '../src/types';

describe('Envelope Functions', () => {
  const mockEnvelope: Envelope = {
    id: 'env-1',
    name: 'Groceries',
    budgetAmount: 500,
    currentAmount: 500,
    period: 'monthly',
    categoryIds: ['cat-1'],
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'txn-1',
      date: new Date('2024-01-05'),
      description: 'Walmart',
      amount: -100,
      categoryId: 'cat-1',
      accountId: 'acc-1',
    },
    {
      id: 'txn-2',
      date: new Date('2024-01-10'),
      description: 'Target',
      amount: -50,
      categoryId: 'cat-1',
      accountId: 'acc-1',
    },
  ];

  it('should calculate envelope balance correctly', () => {
    const balance = calculateEnvelopeBalance(mockEnvelope, mockTransactions);
    expect(balance).toBe(350); // 500 - (100 + 50)
  });

  it('should detect overspent envelopes', () => {
    const overspentTransactions: Transaction[] = [
      ...mockTransactions,
      {
        id: 'txn-3',
        date: new Date('2024-01-15'),
        description: 'Costco',
        amount: -400,
        categoryId: 'cat-1',
        accountId: 'acc-1',
      },
    ];

    expect(isEnvelopeOverspent(mockEnvelope, overspentTransactions)).toBe(true);
    expect(isEnvelopeOverspent(mockEnvelope, mockTransactions)).toBe(false);
  });

  it('should calculate utilization percentage', () => {
    const utilization = calculateUtilization(mockEnvelope, mockTransactions);
    expect(utilization).toBe(30); // (150 / 500) * 100
  });

  it('should determine envelope status', () => {
    expect(getEnvelopeStatus(mockEnvelope, mockTransactions)).toBe('healthy');

    const warningTransactions: Transaction[] = [
      {
        id: 'txn-4',
        date: new Date('2024-01-20'),
        description: 'Store',
        amount: -420,
        categoryId: 'cat-1',
        accountId: 'acc-1',
      },
    ];

    expect(getEnvelopeStatus(mockEnvelope, warningTransactions)).toBe(
      'warning'
    );
  });
});
