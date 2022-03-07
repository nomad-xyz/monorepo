/**
 * RPC Pagination information for Polygon
 */
export interface Pagination {
  blocks: number;
  from: number;
}

/**
 * A Domain (and its characteristics). This interface is deliberately vague.
 * We inted MultiProvider users to supply their own defintion of a `Domain`
 * object with any relevant properties.
 */
export interface Domain {
  name: string;
  domain: number;
  paginate?: Pagination;
}
