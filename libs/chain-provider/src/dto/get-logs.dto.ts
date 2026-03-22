export interface GetLogsDto {
  fromBlock: number;
  toBlock: number;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}
