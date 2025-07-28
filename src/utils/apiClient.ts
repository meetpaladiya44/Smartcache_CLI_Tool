import axios from 'axios';

// Default backend URL - can be overridden with environment variable
const BACKEND_URL = 'https://smartcli.udonswap.org';
// const BACKEND_URL = 'http://localhost:4000';

export interface ListContractsResponse {
  success: boolean;
  contracts?: Array<{
    contractAddress: string;
    network: string;
    deployedBy: string;
    deployedAt: string;
    evictionThresholdDate: string;
    txHash?: string;
    metadata?: object;
    minBidRequired?: string;
    gasSaved?: string;
  }>;
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  // Verify deployer address using Alchemy on backend
  async verifyDeployer(contractAddress: string, deployerAddress: string, network: string): Promise<ApiResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/verify-deployer`, {
        contractAddress,
        deployerAddress,
        network
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        return error.response.data;
      } else if (error.request) {
        return {
          success: false,
          error: 'Unable to connect to SmartCache backend for deployer verification.'
        };
      } else {
        return {
          success: false,
          error: `Deployer verification failed: ${error.message}`
        };
      }
    }
  }

  // Store contract in database via backend
  async storeContract(contractData: any): Promise<ApiResponse & { contractId?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/contracts/store`, contractData, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        return error.response.data;
      } else if (error.request) {
        return {
          success: false,
          error: 'Unable to connect to SmartCache backend for contract storage.'
        };
      } else {
        return {
          success: false,
          error: `Contract storage failed: ${error.message}`
        };
      }
    }
  }

  async listContracts(network?: string): Promise<ListContractsResponse> {
    try {
      const params = network ? { network } : {};
      const response = await axios.get(`${this.baseUrl}/contracts/list`, {
        params,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        return error.response.data;
      } else if (error.request) {
        return {
          success: false,
          error: 'Unable to connect to SmartCache backend. Please ensure the backend service is running.'
        };
      } else {
        return {
          success: false,
          error: `API request failed: ${error.message}`
        };
      }
    }
  }

  async checkBackendHealth(): Promise<{ connected: boolean; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/status`, {
        timeout: 5000
      });
      return { connected: response.status === 200 };
    } catch (error: any) {
      return {
        connected: false,
        error: error.request ? 'Backend service unavailable' : error.message
      };
    }
  }
}

export const apiClient = new ApiClient(); 