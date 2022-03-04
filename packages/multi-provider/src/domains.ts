/**
 * RPC Pagination information for Polygon
 */
export interface Pagination {
  blocks: number;
  from: number;
}

/**
 * A Domain (and its characteristics)
 */
export interface Domain {
  name: string;
  domain: number;
  paginate?: Pagination;
}
