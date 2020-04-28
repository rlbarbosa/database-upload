import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';

import { getRepository, getCustomRepository, In } from 'typeorm';
import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

interface LoadCSVResponse {
  transactions: CSVTransaction[];
  categories: string[];
}

class ImportTransactionsService {
  async execute(fileName: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const csvFilePath = path.resolve(uploadConfig.directory, fileName);
    const { transactions, categories } = await this.loadTransactionsCSV(
      csvFilePath,
    );

    const uniqueCategories = categories.filter(
      (category, index, self) => self.indexOf(category) === index,
    );

    const existentCategories = await categoriesRepository.find({
      where: { title: In(uniqueCategories) },
    });

    const existentCategoriesTitle = existentCategories.map(
      category => category.title,
    );

    const addNewCategories = uniqueCategories.filter(
      category => !existentCategoriesTitle.includes(category),
    );

    const newCategories = categoriesRepository.create(
      addNewCategories.map(title => ({ title })),
    );

    if (addNewCategories && addNewCategories.length)
      await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(csvFilePath);

    return createdTransactions;
  }

  private async loadTransactionsCSV(
    csvFilePath: string,
  ): Promise<LoadCSVResponse> {
    return new Promise<LoadCSVResponse>(resolve => {
      const transactions: CSVTransaction[] = [];
      const categories: string[] = [];

      const readCSVStream = fs.createReadStream(csvFilePath);
      const parseStream = csvParse({
        from_line: 2,
        ltrim: true,
        rtrim: true,
      });

      const parsedCSV = readCSVStream.pipe(parseStream);

      parsedCSV.on('data', (line: string[]) => {
        const [title, type, value, category] = line;

        if (!(title && type && value && category)) return;
        if (!['income', 'outcome'].includes(type)) return;

        categories.push(category);

        const parsedType = type === 'income' ? 'income' : 'outcome';
        const parsedValue = parseFloat(value);

        transactions.push({
          title,
          type: parsedType,
          value: parsedValue,
          category,
        });
      });

      parsedCSV.on('end', () => resolve({ transactions, categories }));
    });
  }
}

export default ImportTransactionsService;
