export interface ApiError {
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}
