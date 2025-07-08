import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ContractRecord {
  _id?: string;
  contractAddress: string;
  network: string;
  deployedAt: Date;
  deployedBy?: string;
  txHash?: string;
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
  };
}

export class DatabaseConfig {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  
  private readonly connectionString: string;
  private readonly databaseName: string;
  private readonly collectionName: string;

  constructor() {
    this.connectionString = process.env.MONGODB_URI || '';
    this.databaseName = process.env.DATABASE_NAME || 'smartcache';
    this.collectionName = process.env.COLLECTION_NAME || 'contracts';

    if (!this.connectionString) {
      throw new Error('MONGODB_URI environment variable is required. Please check your .env file.');
    }
  }

  async connect(): Promise<MongoClient> {
    if (this.client) {
      return this.client;
    }

    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      return this.client;
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getCollection(): Collection<ContractRecord> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection<ContractRecord>(this.collectionName);
  }

  async addContract(contractData: Omit<ContractRecord, '_id'>): Promise<string> {
    const collection = this.getCollection();
    
    // Check if contract already exists
    const existing = await collection.findOne({ contractAddress: contractData.contractAddress });
    if (existing) {
      throw new Error(`Contract address ${contractData.contractAddress} already exists in the cache.`);
    }

    const result = await collection.insertOne(contractData);
    return result.insertedId.toString();
  }

  async getContract(contractAddress: string): Promise<ContractRecord | null> {
    const collection = this.getCollection();
    return await collection.findOne({ contractAddress });
  }

  async getAllContracts(): Promise<ContractRecord[]> {
    const collection = this.getCollection();
    return await collection.find({}).toArray();
  }

  async removeContract(contractAddress: string): Promise<boolean> {
    const collection = this.getCollection();
    const result = await collection.deleteOne({ contractAddress });
    return result.deletedCount > 0;
  }
} 