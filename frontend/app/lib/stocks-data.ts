export interface StockItem {
  symbol: string;
  name: string;
  company_name: string;
  price: number;
  change: number;
  percent_change: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  sector: string;
  pe_ratio: number;
  market_cap: string;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
}

export const STOCKS_DATA: StockItem[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    company_name: "NVIDIA Corporation",
    price: 135.40,
    change: 4.85,
    percent_change: 3.72,
    open: 131.20,
    high: 136.10,
    low: 130.80,
    volume: 52400000,
    sector: "Technology",
    pe_ratio: 42.1,
    market_cap: "$3.32T",
    fifty_two_week_high: 140.76,
    fifty_two_week_low: 45.12,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    company_name: "Apple Inc.",
    price: 232.15,
    change: 1.45,
    percent_change: 0.63,
    open: 230.90,
    high: 233.50,
    low: 230.20,
    volume: 48200000,
    sector: "Technology",
    pe_ratio: 34.2,
    market_cap: "$3.54T",
    fifty_two_week_high: 237.23,
    fifty_two_week_low: 164.08,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    company_name: "Microsoft Corporation",
    price: 448.90,
    change: 3.20,
    percent_change: 0.72,
    open: 446.10,
    high: 450.40,
    low: 445.50,
    volume: 21100000,
    sector: "Technology",
    pe_ratio: 36.8,
    market_cap: "$3.34T",
    fifty_two_week_high: 468.35,
    fifty_two_week_low: 309.45,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    company_name: "Alphabet Inc.",
    price: 182.75,
    change: -0.85,
    percent_change: -0.46,
    open: 183.90,
    high: 184.60,
    low: 181.80,
    volume: 28900000,
    sector: "Technology",
    pe_ratio: 25.4,
    market_cap: "$2.28T",
    fifty_two_week_high: 191.75,
    fifty_two_week_low: 129.40,
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    company_name: "Amazon.com, Inc.",
    price: 192.50,
    change: 2.10,
    percent_change: 1.10,
    open: 190.80,
    high: 193.70,
    low: 190.20,
    volume: 34200000,
    sector: "Consumer Cyclical",
    pe_ratio: 41.5,
    market_cap: "$2.01T",
    fifty_two_week_high: 201.20,
    fifty_two_week_low: 118.35,
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    company_name: "Tesla, Inc.",
    price: 245.80,
    change: 6.40,
    percent_change: 2.67,
    open: 240.10,
    high: 247.90,
    low: 239.50,
    volume: 67800000,
    sector: "Automotive",
    pe_ratio: 62.4,
    market_cap: "$784B",
    fifty_two_week_high: 271.00,
    fifty_two_week_low: 138.80,
  },
];
