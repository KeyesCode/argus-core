export interface LogDto {
  address: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  data: string;
  topics: string[];
  removed: boolean;
}
