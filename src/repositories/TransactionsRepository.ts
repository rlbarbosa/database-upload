import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();

    const transactionsBalance = transactions.reduce<Balance>(
      (balance: Balance, transaction) => {
        if (transaction.type === 'income')
          return {
            ...balance,
            income: balance.income + transaction.value,
          };
        return {
          ...balance,
          outcome: balance.outcome + transaction.value,
        };
      },
      { income: 0, outcome: 0, total: 0 },
    );

    transactionsBalance.total =
      transactionsBalance.income - transactionsBalance.outcome;

    return transactionsBalance;
  }
}

export default TransactionsRepository;
